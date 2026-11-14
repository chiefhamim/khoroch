export type CurrencyCode = 'BDT' | 'USD' | 'EUR';

export const CURRENCIES: readonly CurrencyCode[] = ['BDT', 'USD', 'EUR'];

export type AppLanguage = 'en' | 'bn';

export const APP_LANGUAGES: readonly AppLanguage[] = ['en', 'bn'];

export function normalizeAppLanguage(
  raw: unknown,
  fallback: AppLanguage = 'en'
): AppLanguage {
  return raw === 'bn' || raw === 'en' ? raw : fallback;
}

export type TransactionType = 'expense' | 'income';

export type TransactionSource = 'manual' | 'quick' | 'voice' | 'sample';

export type CategoryKind = 'expense' | 'income';

/** Local calendar date in 'YYYY-MM-DD' format. Never parse as UTC Date. */
export type LocalDate = string;

/** Local wall-clock time in 'HH:mm' format. */
export type LocalTime = string;

export type ThemePreference = 'system' | 'light' | 'dark' | 'black';

export type AccentTheme = 'forest' | 'ocean' | 'plum' | 'saffron' | 'graphite';

export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

export const WEEK_START_DAYS: readonly WeekStartDay[] = ['saturday', 'sunday', 'monday'];

const WEEK_START_DAY_SET = new Set<string>(WEEK_START_DAYS);

export function normalizeWeekStartDay(
  raw: unknown,
  fallback: WeekStartDay = 'saturday'
): WeekStartDay {
  return typeof raw === 'string' && WEEK_START_DAY_SET.has(raw) ? (raw as WeekStartDay) : fallback;
}

export const ACCENT_THEMES: readonly AccentTheme[] = [
  'forest',
  'ocean',
  'plum',
  'saffron',
  'graphite',
];

const ACCENT_THEME_SET = new Set<string>(ACCENT_THEMES);

export function normalizeAccentTheme(
  raw: unknown,
  fallback: AccentTheme = 'forest'
): AccentTheme {
  return typeof raw === 'string' && ACCENT_THEME_SET.has(raw) ? (raw as AccentTheme) : fallback;
}

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

export type AvatarColorKey = 'accent' | CategoryColorKey;

export const AVATAR_COLOR_KEYS: readonly AvatarColorKey[] = [
  'accent',
  'teal',
  'violet',
  'orange',
  'blue',
  'amber',
  'pink',
  'red',
  'indigo',
];

const CATEGORY_COLOR_KEY_SET = new Set<string>(CATEGORY_COLOR_KEYS);

export function normalizeAvatarColorKey(
  raw: unknown,
  fallback: AvatarColorKey = 'accent'
): AvatarColorKey {
  if (raw === 'accent') return 'accent';
  return typeof raw === 'string' && CATEGORY_COLOR_KEY_SET.has(raw)
    ? (raw as CategoryColorKey)
    : fallback;
}

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
  accountId: string | null;
  transferId: string | null;
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
  accountId?: string | null;
  transferId?: string | null;
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
  accountId?: string | null;
  description?: string;
  note?: string;
  occurredOn?: LocalDate;
  occurredTime?: LocalTime | null;
}

export type AccountKind = 'cash' | 'mobile_wallet' | 'bank' | 'credit_card' | 'other';
export type AccountProvider = 'bkash' | 'nagad' | 'upay' | 'rocket' | 'cellfin';

export const ACCOUNT_KINDS: readonly AccountKind[] = [
  'cash',
  'mobile_wallet',
  'bank',
  'credit_card',
  'other',
];

export const ACCOUNT_PROVIDERS: readonly AccountProvider[] = [
  'bkash',
  'nagad',
  'upay',
  'rocket',
  'cellfin',
];

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  provider: string | null;
  colorKey: string;
  monogram: string | null;
  last4: string | null;
  openingBalanceMinor: number;
  openingDate: LocalDate;
  includeInTotal: boolean;
  sortOrder: number;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewAccount {
  id: string;
  name: string;
  kind: AccountKind;
  provider?: string | null;
  colorKey: string;
  monogram?: string | null;
  last4?: string | null;
  openingBalanceMinor?: number;
  openingDate: LocalDate;
  includeInTotal?: boolean;
  sortOrder?: number;
  archivedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface AccountPatch {
  name?: string;
  kind?: AccountKind;
  provider?: string | null;
  colorKey?: string;
  monogram?: string | null;
  last4?: string | null;
  openingBalanceMinor?: number;
  openingDate?: LocalDate;
  includeInTotal?: boolean;
  sortOrder?: number;
  archivedAt?: number | null;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  feeMinor: number;
  occurredOn: LocalDate;
  occurredTime: LocalTime | null;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface NewTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  feeMinor?: number;
  currency?: CurrencyCode;
  occurredOn: LocalDate;
  occurredTime?: LocalTime | null;
  note?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface TransferPatch {
  fromAccountId?: string;
  toAccountId?: string;
  amountMinor?: number;
  feeMinor?: number;
  occurredOn?: LocalDate;
  occurredTime?: LocalTime | null;
  note?: string;
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

export const HOME_SECTION_IDS = [
  'wallets',
  'dues',
  'spending_chart',
  'top_categories',
  'recent',
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export interface HomeSectionConfig {
  id: HomeSectionId;
  visible: boolean;
}

export const DEFAULT_HOME_SECTIONS: readonly HomeSectionConfig[] = HOME_SECTION_IDS.map(
  (id) => ({ id, visible: true })
);

const HOME_SECTION_ID_SET = new Set<string>(HOME_SECTION_IDS);

export function cloneDefaultHomeSections(): HomeSectionConfig[] {
  return DEFAULT_HOME_SECTIONS.map((s) => ({ ...s }));
}

export function normalizeHomeSections(raw: unknown): HomeSectionConfig[] {
  if (!Array.isArray(raw)) return cloneDefaultHomeSections();
  const seen = new Set<HomeSectionId>();
  const result: HomeSectionConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { id?: unknown; visible?: unknown };
    if (typeof rec.id !== 'string' || !HOME_SECTION_ID_SET.has(rec.id)) continue;
    const id = rec.id as HomeSectionId;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      visible: typeof rec.visible === 'boolean' ? rec.visible : true,
    });
  }
  for (const def of DEFAULT_HOME_SECTIONS) {
    if (!seen.has(def.id)) {
      result.push({ ...def });
    }
  }
  return result;
}

export interface Settings {
  onboardingDone: boolean;
  name: string;
  avatarColorKey: AvatarColorKey;
  currency: CurrencyCode;
  language: AppLanguage;
  monthStartDay: number;
  theme: ThemePreference;
  accent: AccentTheme;
  reminder: ReminderSettings;
  hideAmountsOnOpen: boolean;
  showPoisha: boolean;
  compactNumbers: boolean;
  weekStartsOn: WeekStartDay;
  homeSections: HomeSectionConfig[];
  appLockEnabled: boolean;
  appLockTimeoutSec: number;
  sampleDataLoaded: boolean;
  notificationPermissionDenied: boolean;
  lastBackupAt: number | null;
  speechDisclosureAccepted: boolean;
  lastUsedAccountId: string | null;
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
  accountId?: string | null;
  accountIds?: string[];
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

export type PersonHonorific = 'none' | 'bhai' | 'apu';

export type DueKind = 'lent' | 'borrowed' | 'received_back' | 'paid_back';

export interface Person {
  id: string;
  name: string;
  colorKey: CategoryColorKey;
  honorific: PersonHonorific;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewPerson {
  id: string;
  name: string;
  colorKey: CategoryColorKey;
  honorific?: PersonHonorific;
  archivedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface PersonPatch {
  name?: string;
  colorKey?: CategoryColorKey;
  honorific?: PersonHonorific;
  archivedAt?: number | null;
}

export interface DueEntry {
  id: string;
  personId: string;
  kind: DueKind;
  amountMinor: number;
  accountId: string | null;
  occurredOn: LocalDate;
  occurredTime: LocalTime | null;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface NewDueEntry {
  id: string;
  personId: string;
  kind: DueKind;
  amountMinor: number;
  accountId?: string | null;
  occurredOn: LocalDate;
  occurredTime?: LocalTime | null;
  note?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface DueEntryPatch {
  personId?: string;
  kind?: DueKind;
  amountMinor?: number;
  accountId?: string | null;
  occurredOn?: LocalDate;
  occurredTime?: LocalTime | null;
  note?: string;
}
