export type CurrencyCode = 'BDT' | 'USD' | 'EUR';

export const CURRENCIES: readonly CurrencyCode[] = ['BDT', 'USD', 'EUR'];

export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'quick' | 'voice' | 'sample';

export type CategoryKind = 'expense' | 'income';

/** Local calendar date in 'YYYY-MM-DD' format. Never parse as UTC Date. */
export type LocalDate = string;

/** Local wall-clock time in 'HH:mm' format. */
export type LocalTime = string;

export type ThemePreference = 'system' | 'light' | 'dark';

export type ReminderDays = 'everyday' | 'weekdays';

export const CATEGORY_COLOR_KEYS = [
  'orange',
  'green',
  'blue',
  'pink',
  'violet',
  'amber',
  'red',
  'grape',
  'indigo',
  'cyan',
  'teal',
  'lime',
  'gray',
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLOR_KEYS)[number];

export interface Category {
  id: string;
  name: string;
  icon: string;
  colorKey: CategoryColorKey;
  kind: CategoryKind;
  sortOrder: number;
  isSelected: boolean;
  archivedAt: number | null;
  createdAt: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId: string | null;
  description: string;
  note: string;
  occurredOn: LocalDate;
  occurredTime: LocalTime | null;
  source: TransactionSource;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface NewTransaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId: string | null;
  description?: string;
  note?: string;
  occurredOn: LocalDate;
  occurredTime?: LocalTime | null;
  source?: TransactionSource;
  createdAt?: number;
  updatedAt?: number;
}

export interface TransactionPatch {
  type?: TransactionType;
  amountMinor?: number;
  categoryId?: string | null;
  description?: string;
  note?: string;
  occurredOn?: LocalDate;
  occurredTime?: LocalTime | null;
}

export interface Budget {
  periodStart: LocalDate;
  categoryId: string; // '' = overall budget
  amountMinor: number;
  updatedAt: number;
}

export interface ReminderSettings {
  enabled: boolean;
  time: LocalTime;
  days: ReminderDays;
}

export interface Settings {
  onboardingDone: boolean;
  name: string;
  currency: CurrencyCode;
  monthStartDay: number;
  theme: ThemePreference;
  reminder: ReminderSettings;
  sampleDataLoaded: boolean;
  notificationPermissionDenied: boolean;
}

export interface Period {
  start: LocalDate;
  endExcl: LocalDate;
  lengthDays: number;
}

export type BudgetStatus =
  | 'no_budget'
  | 'ok'
  | 'info'
  | 'attention'
  | 'reached'
  | 'over';

export interface TxQuery {
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  fromIncl?: LocalDate;
  toExcl?: LocalDate;
  minAmountMinor?: number;
  maxAmountMinor?: number;
}

export interface TxPage {
  limit: number;
  cursor?: string;
}

export interface TxSearchResult {
  rows: Transaction[];
  next?: string;
}
