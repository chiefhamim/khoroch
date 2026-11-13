import { formatBalanceWithDue } from './money';
import type { Account, AccountKind, CurrencyCode, LocalDate, Transaction, Transfer } from './types';

export interface DueAccountFlow {
  kind: 'lent' | 'borrowed' | 'received_back' | 'paid_back';
  amountMinor: number;
  accountId: string | null;
  occurredOn: LocalDate;
  deletedAt: number | null;
}

export interface ComputeAccountBalanceInput {
  account: Pick<Account, 'id' | 'openingBalanceMinor' | 'openingDate'>;
  transactions: readonly Transaction[];
  transfers: readonly Transfer[];
  dues?: readonly DueAccountFlow[];
  asOfDate?: LocalDate;
  currency?: CurrencyCode;
}

export interface AccountBalanceEntry {
  account: Account;
  balanceMinor: number;
  formattedBalance: string;
  isDue: boolean;
}

export interface ComputeAccountsOverviewInput {
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  transfers: readonly Transfer[];
  dues?: readonly DueAccountFlow[];
  asOfDate?: LocalDate;
  currency?: CurrencyCode;
  includeArchived?: boolean;
}

export interface AccountsOverview {
  balances: AccountBalanceEntry[];
  totalMinor: number;
  formattedTotal: string;
  includedCount: number;
  excludedCount: number;
}

export const WALLET_BRAND_HEX: Readonly<Record<string, string>> = {
  bkash: '#E2136E',
  nagad: '#F15A22',
  upay: '#0F4C9C',
  rocket: '#8C3494',
  cellfin: '#0B7A55',
  cash: '#123227',
  bank: '#1E40AF',
  credit_card: '#334155',
  other: '#5F5C54',
};

/**
 * Computes a single wallet's balance (minor units) using exact integer arithmetic:
 * opening + income − expense − transfers_out + transfers_in ± due flows,
 * counting only non-deleted entries on or after `account.openingDate` (and <= `asOfDate` if given).
 * Note: transfer fees are ordinary expense rows on the `from` account, so transfers only count `amountMinor`.
 */
export function computeAccountBalance(input: ComputeAccountBalanceInput): number {
  const { account, transactions, transfers, dues = [], asOfDate, currency } = input;
  let balance = account.openingBalanceMinor;

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.accountId !== account.id) continue;
    if (tx.occurredOn < account.openingDate) continue;
    if (asOfDate && tx.occurredOn > asOfDate) continue;
    if (currency && tx.currency !== currency) continue;
    if (tx.type === 'income') {
      balance += tx.amountMinor;
    } else if (tx.type === 'expense') {
      balance -= tx.amountMinor;
    }
  }

  for (const tr of transfers) {
    if (tr.deletedAt != null) continue;
    if (tr.occurredOn < account.openingDate) continue;
    if (asOfDate && tr.occurredOn > asOfDate) continue;
    if (tr.fromAccountId === account.id) {
      balance -= tr.amountMinor;
    }
    if (tr.toAccountId === account.id) {
      balance += tr.amountMinor;
    }
  }

  for (const d of dues) {
    if (d.deletedAt != null) continue;
    if (d.accountId !== account.id) continue;
    if (d.occurredOn < account.openingDate) continue;
    if (asOfDate && d.occurredOn > asOfDate) continue;
    if (d.kind === 'lent' || d.kind === 'paid_back') {
      balance -= d.amountMinor;
    } else if (d.kind === 'borrowed' || d.kind === 'received_back') {
      balance += d.amountMinor;
    }
  }

  return balance;
}

/**
 * Formats an individual wallet balance: negative credit-card balances render as `"৳5,600 due"`,
 * negative non-card balances render as `"-৳500"`, and non-negative balances preserve exact minor units.
 */
export function formatAccountBalance(
  kind: AccountKind,
  balanceMinor: number,
  currency: CurrencyCode = 'BDT'
): string {
  const safeMinor = Math.trunc(balanceMinor);
  if (safeMinor < 0) {
    if (kind === 'credit_card') {
      return formatBalanceWithDue(safeMinor, currency);
    }
    return `-${formatBalanceWithDue(-safeMinor, currency)}`;
  }
  return formatBalanceWithDue(safeMinor, currency);
}

/**
 * Formats the net total across all active `includeInTotal` wallets without `"due"` labeling.
 */
export function formatAccountsTotal(totalMinor: number, currency: CurrencyCode = 'BDT'): string {
  const safeMinor = Math.trunc(totalMinor);
  if (safeMinor < 0) {
    return `-${formatBalanceWithDue(-safeMinor, currency)}`;
  }
  return formatBalanceWithDue(safeMinor, currency);
}

/**
 * Computes balances for every wallet in O(A + T + R + D) and aggregates the net total across
 * non-archived wallets with `includeInTotal = true`.
 */
export function computeAccountsOverview(input: ComputeAccountsOverviewInput): AccountsOverview {
  const {
    accounts,
    transactions,
    transfers,
    dues = [],
    asOfDate,
    currency = 'BDT',
    includeArchived = false,
  } = input;

  const accountById = new Map<string, Account>();
  const runningById = new Map<string, number>();

  for (const acc of accounts) {
    accountById.set(acc.id, acc);
    runningById.set(acc.id, acc.openingBalanceMinor);
  }

  for (const tx of transactions) {
    if (tx.deletedAt != null || !tx.accountId) continue;
    const acc = accountById.get(tx.accountId);
    if (!acc) continue;
    if (tx.occurredOn < acc.openingDate) continue;
    if (asOfDate && tx.occurredOn > asOfDate) continue;
    if (currency && tx.currency !== currency) continue;
    const prev = runningById.get(acc.id) ?? 0;
    runningById.set(acc.id, tx.type === 'income' ? prev + tx.amountMinor : prev - tx.amountMinor);
  }

  for (const tr of transfers) {
    if (tr.deletedAt != null) continue;
    if (asOfDate && tr.occurredOn > asOfDate) continue;
    const fromAcc = accountById.get(tr.fromAccountId);
    if (fromAcc && tr.occurredOn >= fromAcc.openingDate) {
      runningById.set(fromAcc.id, (runningById.get(fromAcc.id) ?? 0) - tr.amountMinor);
    }
    const toAcc = accountById.get(tr.toAccountId);
    if (toAcc && tr.occurredOn >= toAcc.openingDate) {
      runningById.set(toAcc.id, (runningById.get(toAcc.id) ?? 0) + tr.amountMinor);
    }
  }

  for (const d of dues) {
    if (d.deletedAt != null || !d.accountId) continue;
    const acc = accountById.get(d.accountId);
    if (!acc) continue;
    if (d.occurredOn < acc.openingDate) continue;
    if (asOfDate && d.occurredOn > asOfDate) continue;
    const prev = runningById.get(acc.id) ?? 0;
    if (d.kind === 'lent' || d.kind === 'paid_back') {
      runningById.set(acc.id, prev - d.amountMinor);
    } else if (d.kind === 'borrowed' || d.kind === 'received_back') {
      runningById.set(acc.id, prev + d.amountMinor);
    }
  }

  const ordered = [...accounts]
    .filter((acc) => includeArchived || acc.archivedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt || a.name.localeCompare(b.name));

  let totalMinor = 0;
  let includedCount = 0;
  let excludedCount = 0;

  const balances: AccountBalanceEntry[] = ordered.map((acc) => {
    const balanceMinor = runningById.get(acc.id) ?? acc.openingBalanceMinor;
    if (acc.archivedAt == null) {
      if (acc.includeInTotal) {
        totalMinor += balanceMinor;
        includedCount += 1;
      } else {
        excludedCount += 1;
      }
    }
    return {
      account: acc,
      balanceMinor,
      formattedBalance: formatAccountBalance(acc.kind, balanceMinor, currency),
      isDue: acc.kind === 'credit_card' && balanceMinor < 0,
    };
  });

  return {
    balances,
    totalMinor,
    formattedTotal: formatAccountsTotal(totalMinor, currency),
    includedCount,
    excludedCount,
  };
}
