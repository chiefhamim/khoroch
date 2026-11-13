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

/** Day-of-week indices stored as 0 = Sunday .. 6 = Saturday (DESIGN §4). */
export const ALL_REMINDER_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const SUN_THU_REMINDER_DAYS: readonly number[] = [0, 1, 2, 3, 4];
export const MON_FRI_REMINDER_DAYS: readonly number[] = [1, 2, 3, 4, 5];

export type LegacyReminderDays = 'everyday' | 'weekdays';
export type ReminderDays = number[];

export function normalizeReminderDays(raw: unknown): ReminderDays {
  if (raw === 'everyday') return [...ALL_REMINDER_DAYS];
  if (raw === 'weekdays') return [...MON_FRI_REMINDER_DAYS];
  if (Array.isArray(raw)) {
    const valid = new Set<number>();
    for (const item of raw) {
      if (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 6) {
        valid.add(item);
      }
    }
    return Array.from(valid).sort((a, b) => a - b);
  }
  return [...ALL_REMINDER_DAYS];
}

export function normalizeReminderSettings(
  raw: unknown,
  fallback: ReminderSettings
): ReminderSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: fallback.enabled,
      time: fallback.time,
      days: [...fallback.days],
    };
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    time: typeof obj.time === 'string' && obj.time.trim() ? obj.time.trim() : fallback.time,
    days: obj.days !== undefined ? normalizeReminderDays(obj.days) : [...fallback.days],
  };
}

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

export interface DayReviewRecord {
  day: LocalDate;
  reviewedAt: number;
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
  lastBackupAt: number | null;
  speechDisclosureAccepted: boolean;
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
  categoryIds?: string[];
  fromIncl?: LocalDate;
  toExcl?: LocalDate;
  minAmountMinor?: number;
  maxAmountMinor?: number;
}

export interface TxQuerySummary {
  count: number;
  expenseMinor: number;
  incomeMinor: number;
}

export interface TxPage {
  limit: number;
  cursor?: string;
}

export interface TxSearchResult {
  rows: Transaction[];
  next?: string;
}
