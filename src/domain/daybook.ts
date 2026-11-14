import { computeAccountsOverview, type DueAccountFlow } from './accounts';
import { addDays } from './dates';
import type {
  Account,
  CurrencyCode,
  DueKind,
  LocalDate,
  LocalTime,
  Transaction,
  Transfer,
} from './types';

/**
 * Day Book: one calendar day read like a paper money log.
 *
 *   Started with  ৳1,000
 *   09:10  Bus            −10   left 990
 *   18:40  Snacks         −40   left 950
 *   Ended with    ৳950
 *
 * "Started with" and "Ended with" are the counted wallet totals (active wallets with
 * includeInTotal) at the end of the previous day and at the end of this day, taken from
 * computeAccountsOverview so they always match the Home screen. Every entry carries its
 * effect on that total (`walletDeltaMinor`), so the running balance adds up exactly:
 * opening + Σ deltas = closing.
 */

export type DayBookEntryKind = 'transaction' | 'transfer' | 'due';

export interface DayBookEntry {
  kind: DayBookEntryKind;
  id: string;
  occurredTime: LocalTime | null;
  /** Minutes since midnight used for ordering (falls back to creation time). */
  sortMinute: number;
  createdAt: number;
  direction: 'in' | 'out' | 'move';
  amountMinor: number;
  /** Effect on the counted wallet total; 0 for moves between counted wallets or entries without a wallet. */
  walletDeltaMinor: number;
  /** Counted total right after this entry, or null when the entry does not touch a counted wallet. */
  runningMinor: number | null;
  transaction?: Transaction;
  transfer?: Transfer;
  due?: DayBookDue;
}

export interface DayBookDue extends DueAccountFlow {
  id: string;
  personId: string;
  occurredTime: LocalTime | null;
  note: string;
  createdAt: number;
}

export interface DayBook {
  date: LocalDate;
  openingMinor: number;
  closingMinor: number;
  inMinor: number;
  outMinor: number;
  /** Money in/out of entries that are not tied to a counted wallet (still listed, not in the running balance). */
  untrackedInMinor: number;
  untrackedOutMinor: number;
  entries: DayBookEntry[];
}

export interface BuildDayBookInput {
  date: LocalDate;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  transfers: readonly Transfer[];
  dues: readonly DayBookDue[];
  currency: CurrencyCode;
}

function minuteOf(time: LocalTime | null, createdAt: number): number {
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
  const d = new Date(createdAt);
  return d.getHours() * 60 + d.getMinutes();
}

const DUE_IN: readonly DueKind[] = ['borrowed', 'received_back'];

export function buildDayBook(input: BuildDayBookInput): DayBook {
  const { date, accounts, transactions, transfers, dues, currency } = input;

  const counted = new Map<string, Account>();
  for (const acc of accounts) {
    if (acc.archivedAt == null && acc.includeInTotal) counted.set(acc.id, acc);
  }
  const countsOn = (accountId: string | null | undefined): boolean => {
    if (!accountId) return false;
    const acc = counted.get(accountId);
    return Boolean(acc && date >= acc.openingDate);
  };

  const opening = computeAccountsOverview({
    accounts,
    transactions,
    transfers,
    dues,
    asOfDate: addDays(date, -1),
    currency,
  }).totalMinor;
  const closing = computeAccountsOverview({
    accounts,
    transactions,
    transfers,
    dues,
    asOfDate: date,
    currency,
  }).totalMinor;

  const entries: DayBookEntry[] = [];

  for (const tx of transactions) {
    if (tx.deletedAt != null || tx.occurredOn !== date || tx.currency !== currency) continue;
    const signed = tx.type === 'income' ? tx.amountMinor : -tx.amountMinor;
    entries.push({
      kind: 'transaction',
      id: tx.id,
      occurredTime: tx.occurredTime,
      sortMinute: minuteOf(tx.occurredTime, tx.createdAt),
      createdAt: tx.createdAt,
      direction: tx.type === 'income' ? 'in' : 'out',
      amountMinor: tx.amountMinor,
      walletDeltaMinor: countsOn(tx.accountId) ? signed : 0,
      runningMinor: null,
      transaction: tx,
    });
  }

  for (const tr of transfers) {
    if (tr.deletedAt != null || tr.occurredOn !== date) continue;
    const delta = (countsOn(tr.toAccountId) ? tr.amountMinor : 0) - (countsOn(tr.fromAccountId) ? tr.amountMinor : 0);
    entries.push({
      kind: 'transfer',
      id: tr.id,
      occurredTime: tr.occurredTime,
      sortMinute: minuteOf(tr.occurredTime, tr.createdAt),
      createdAt: tr.createdAt,
      direction: delta > 0 ? 'in' : delta < 0 ? 'out' : 'move',
      amountMinor: tr.amountMinor,
      walletDeltaMinor: delta,
      runningMinor: null,
      transfer: tr,
    });
  }

  for (const d of dues) {
    if (d.deletedAt != null || d.occurredOn !== date) continue;
    const isIn = DUE_IN.includes(d.kind);
    const signed = isIn ? d.amountMinor : -d.amountMinor;
    entries.push({
      kind: 'due',
      id: d.id,
      occurredTime: d.occurredTime,
      sortMinute: minuteOf(d.occurredTime, d.createdAt),
      createdAt: d.createdAt,
      direction: isIn ? 'in' : 'out',
      amountMinor: d.amountMinor,
      walletDeltaMinor: countsOn(d.accountId) ? signed : 0,
      runningMinor: null,
      due: d,
    });
  }

  entries.sort((a, b) => a.sortMinute - b.sortMinute || a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  let running = opening;
  let inMinor = 0;
  let outMinor = 0;
  let untrackedInMinor = 0;
  let untrackedOutMinor = 0;
  for (const entry of entries) {
    const touchesWallet =
      entry.kind === 'transfer'
        ? countsOn(entry.transfer?.fromAccountId) || countsOn(entry.transfer?.toAccountId)
        : entry.walletDeltaMinor !== 0;
    if (entry.walletDeltaMinor > 0) inMinor += entry.walletDeltaMinor;
    if (entry.walletDeltaMinor < 0) outMinor -= entry.walletDeltaMinor;
    if (!touchesWallet && entry.kind !== 'transfer') {
      if (entry.direction === 'in') untrackedInMinor += entry.amountMinor;
      else untrackedOutMinor += entry.amountMinor;
    }
    running += entry.walletDeltaMinor;
    entry.runningMinor = touchesWallet ? running : null;
  }

  return {
    date,
    openingMinor: opening,
    closingMinor: closing,
    inMinor,
    outMinor,
    untrackedInMinor,
    untrackedOutMinor,
    entries,
  };
}
