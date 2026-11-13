import { addDays } from './dates';
import { formatBalanceWithDue } from './money';
import type {
  Account,
  AccountKind,
  AccountProvider,
  CurrencyCode,
  LocalDate,
  Transaction,
  Transfer,
} from './types';

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

export type WalletPresetKey =
  | 'cash'
  | 'bkash'
  | 'nagad'
  | 'upay'
  | 'rocket'
  | 'cellfin'
  | 'bank'
  | 'credit_card'
  | 'other';

export interface WalletPreset {
  key: WalletPresetKey;
  name: string;
  kind: AccountKind;
  provider: AccountProvider | null;
  colorKey: string;
  monogram: string | null;
  iconName: 'wallet' | 'landmark' | 'credit-card' | 'shapes';
  supportsLast4: boolean;
  defaultIncludeInTotal: boolean;
}

export const WALLET_PRESETS: readonly WalletPreset[] = [
  {
    key: 'cash',
    name: 'Cash',
    kind: 'cash',
    provider: null,
    colorKey: WALLET_BRAND_HEX.cash,
    monogram: null,
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'bkash',
    name: 'bKash',
    kind: 'mobile_wallet',
    provider: 'bkash',
    colorKey: WALLET_BRAND_HEX.bkash,
    monogram: 'bK',
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'nagad',
    name: 'Nagad',
    kind: 'mobile_wallet',
    provider: 'nagad',
    colorKey: WALLET_BRAND_HEX.nagad,
    monogram: 'N',
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'upay',
    name: 'Upay',
    kind: 'mobile_wallet',
    provider: 'upay',
    colorKey: WALLET_BRAND_HEX.upay,
    monogram: 'U',
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'rocket',
    name: 'Rocket',
    kind: 'mobile_wallet',
    provider: 'rocket',
    colorKey: WALLET_BRAND_HEX.rocket,
    monogram: 'R',
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'cellfin',
    name: 'CellFin',
    kind: 'mobile_wallet',
    provider: 'cellfin',
    colorKey: WALLET_BRAND_HEX.cellfin,
    monogram: 'CF',
    iconName: 'wallet',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
  {
    key: 'bank',
    name: 'Bank',
    kind: 'bank',
    provider: null,
    colorKey: WALLET_BRAND_HEX.bank,
    monogram: null,
    iconName: 'landmark',
    supportsLast4: true,
    defaultIncludeInTotal: true,
  },
  {
    key: 'credit_card',
    name: 'Card',
    kind: 'credit_card',
    provider: null,
    colorKey: WALLET_BRAND_HEX.credit_card,
    monogram: null,
    iconName: 'credit-card',
    supportsLast4: true,
    defaultIncludeInTotal: true,
  },
  {
    key: 'other',
    name: 'Other',
    kind: 'other',
    provider: null,
    colorKey: WALLET_BRAND_HEX.other,
    monogram: null,
    iconName: 'shapes',
    supportsLast4: false,
    defaultIncludeInTotal: true,
  },
];

export const WALLET_COLOR_PALETTE: readonly string[] = [
  WALLET_BRAND_HEX.bkash,
  WALLET_BRAND_HEX.nagad,
  WALLET_BRAND_HEX.upay,
  WALLET_BRAND_HEX.rocket,
  WALLET_BRAND_HEX.cellfin,
  WALLET_BRAND_HEX.cash,
  WALLET_BRAND_HEX.bank,
  WALLET_BRAND_HEX.credit_card,
  WALLET_BRAND_HEX.other,
  '#0B6B4B',
  '#5B2C82',
  '#B45309',
];

export function getWalletIconName(
  kind: AccountKind
): 'wallet' | 'landmark' | 'credit-card' | 'shapes' {
  switch (kind) {
    case 'bank':
      return 'landmark';
    case 'credit_card':
      return 'credit-card';
    case 'other':
      return 'shapes';
    case 'cash':
    case 'mobile_wallet':
    default:
      return 'wallet';
  }
}

export function resolveWalletColorHex(account: Pick<Account, 'kind' | 'provider' | 'colorKey'>): string {
  const key = account.colorKey.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(key)) return key;
  if (account.provider && WALLET_BRAND_HEX[account.provider]) {
    return WALLET_BRAND_HEX[account.provider];
  }
  return WALLET_BRAND_HEX[account.kind] ?? WALLET_BRAND_HEX.other;
}

export function formatWalletSubtitle(account: Pick<Account, 'name' | 'last4'>): string {
  if (account.last4) {
    return `${account.name} ending ${account.last4}`;
  }
  return account.name;
}

export interface WalletBalancePoint {
  date: LocalDate;
  balanceMinor: number;
}

export interface ComputeAccountBalanceSeriesInput {
  account: Pick<Account, 'id' | 'openingBalanceMinor' | 'openingDate'>;
  transactions: readonly Transaction[];
  transfers: readonly Transfer[];
  dues?: readonly DueAccountFlow[];
  fromDate: LocalDate;
  toDate: LocalDate;
  currency?: CurrencyCode;
}

/**
 * Builds daily end-of-day balances from `max(fromDate, openingDate)` through `toDate`.
 * Returns a single point at `openingDate` when `openingDate > toDate` so the chart never renders empty.
 */
export function computeAccountBalanceSeries(
  input: ComputeAccountBalanceSeriesInput
): WalletBalancePoint[] {
  const {
    account,
    transactions,
    transfers,
    dues = [],
    fromDate,
    toDate,
    currency,
  } = input;

  if (account.openingDate > toDate) {
    return [{ date: account.openingDate, balanceMinor: account.openingBalanceMinor }];
  }

  const startDate = fromDate > account.openingDate ? fromDate : account.openingDate;
  const deltaByDate = new Map<LocalDate, number>();
  let running = account.openingBalanceMinor;

  const applyDelta = (date: LocalDate, delta: number) => {
    if (date < account.openingDate || date > toDate) return;
    if (date < startDate) {
      running += delta;
    } else {
      deltaByDate.set(date, (deltaByDate.get(date) ?? 0) + delta);
    }
  };

  for (const tx of transactions) {
    if (tx.deletedAt != null || tx.accountId !== account.id) continue;
    if (currency && tx.currency !== currency) continue;
    applyDelta(tx.occurredOn, tx.type === 'income' ? tx.amountMinor : -tx.amountMinor);
  }

  for (const tr of transfers) {
    if (tr.deletedAt != null) continue;
    if (tr.fromAccountId === account.id) {
      applyDelta(tr.occurredOn, -tr.amountMinor);
    }
    if (tr.toAccountId === account.id) {
      applyDelta(tr.occurredOn, tr.amountMinor);
    }
  }

  for (const d of dues) {
    if (d.deletedAt != null || d.accountId !== account.id) continue;
    const sign = d.kind === 'borrowed' || d.kind === 'received_back' ? 1 : -1;
    applyDelta(d.occurredOn, sign * d.amountMinor);
  }

  const points: WalletBalancePoint[] = [];
  let cursor = startDate;
  while (cursor <= toDate) {
    running += deltaByDate.get(cursor) ?? 0;
    points.push({ date: cursor, balanceMinor: running });
    cursor = addDays(cursor, 1);
  }

  return points;
}
