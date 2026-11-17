import { AVATAR_PHOTO_IDS } from './avatarPhotoIds';
import { MAX_AMOUNT_MINOR } from './money';

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

export type TransactionSource = 'manual' | 'quick' | 'voice' | 'capture' | 'sample';

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

export const BANGLA_FONT_KEYS = [
  'noto_sans_bengali',
  'anek_bangla',
  'solaiman_lipi',
  'kalpurush',
  'nikosh',
  'sutuji',
  'hind_siliguri',
] as const;

export type BanglaFontKey = (typeof BANGLA_FONT_KEYS)[number];

const BANGLA_FONT_KEY_SET = new Set<string>(BANGLA_FONT_KEYS);

export function normalizeBanglaFontKey(
  raw: unknown,
  fallback: BanglaFontKey = 'noto_sans_bengali'
): BanglaFontKey {
  return typeof raw === 'string' && BANGLA_FONT_KEY_SET.has(raw)
    ? (raw as BanglaFontKey)
    : fallback;
}

export const INCOME_COLOR_KEYS = [
  'emerald',
  'teal',
  'ocean',
  'violet',
  'gold',
  'ink',
] as const;

export type IncomeColorKey = (typeof INCOME_COLOR_KEYS)[number];

const INCOME_COLOR_KEY_SET = new Set<string>(INCOME_COLOR_KEYS);

export function normalizeIncomeColorKey(
  raw: unknown,
  fallback: IncomeColorKey = 'emerald'
): IncomeColorKey {
  return typeof raw === 'string' && INCOME_COLOR_KEY_SET.has(raw)
    ? (raw as IncomeColorKey)
    : fallback;
}

export const EXPENSE_COLOR_KEYS = [
  'ink',
  'crimson',
  'rose',
  'amber',
  'plum',
  'teal',
] as const;

export type ExpenseColorKey = (typeof EXPENSE_COLOR_KEYS)[number];

const EXPENSE_COLOR_KEY_SET = new Set<string>(EXPENSE_COLOR_KEYS);

export function normalizeExpenseColorKey(
  raw: unknown,
  fallback: ExpenseColorKey = 'ink'
): ExpenseColorKey {
  return typeof raw === 'string' && EXPENSE_COLOR_KEY_SET.has(raw)
    ? (raw as ExpenseColorKey)
    : fallback;
}

export const AVATAR_PRESET_IDS = [
  'initial',
  'prof_exec',
  'prof_glasses',
  'prof_minimal',
  'prof_hijab',
  'sea_palm',
  'sea_lotus',
  'sea_monstera',
  'sea_boat',
  'abs_prism',
  'abs_aura',
  'abs_terracotta',
  'abs_mosaic',
  ...AVATAR_PHOTO_IDS,
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

const AVATAR_PRESET_ID_SET = new Set<string>(AVATAR_PRESET_IDS);

export function normalizeAvatarPresetId(
  raw: unknown,
  fallback: AvatarPresetId = 'initial'
): AvatarPresetId {
  return typeof raw === 'string' && AVATAR_PRESET_ID_SET.has(raw)
    ? (raw as AvatarPresetId)
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

export type AccountKind =
  | 'cash'
  | 'mobile_wallet'
  | 'bank'
  | 'credit_card'
  | 'dps'
  | 'fdr'
  | 'sanchaypatra'
  | 'investment'
  | 'other';
export type AccountProvider = 'bkash' | 'nagad' | 'upay' | 'rocket' | 'cellfin';

export const ACCOUNT_KINDS: readonly AccountKind[] = [
  'cash',
  'mobile_wallet',
  'bank',
  'credit_card',
  'dps',
  'fdr',
  'sanchaypatra',
  'investment',
  'other',
];

export const SAVINGS_ASSET_KINDS: readonly AccountKind[] = [
  'dps',
  'fdr',
  'sanchaypatra',
  'investment',
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
  /** Default transfer fee rate in basis points of a percent (185 = 1.85%); null or absent means none. */
  defaultFeeBp?: number | null;
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
  defaultFeeBp?: number | null;
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
  defaultFeeBp?: number | null;
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

/** Most amounts a person can pin per transaction type. */
export const MAX_PINNED_AMOUNTS = 4;

/** Pinned quick amounts in integer minor units, per transaction type. */
export interface PinnedAmounts {
  expense: number[];
  income: number[];
}

export function emptyPinnedAmounts(): PinnedAmounts {
  return { expense: [], income: [] };
}

function normalizePinnedList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isSafeInteger(item) || item <= 0) continue;
    if (item > MAX_AMOUNT_MINOR) continue;
    if (out.includes(item)) continue;
    out.push(item);
    if (out.length === MAX_PINNED_AMOUNTS) break;
  }
  return out;
}

export function normalizePinnedAmounts(raw: unknown): PinnedAmounts {
  if (!raw || typeof raw !== 'object') return emptyPinnedAmounts();
  const rec = raw as { expense?: unknown; income?: unknown };
  return { expense: normalizePinnedList(rec.expense), income: normalizePinnedList(rec.income) };
}

/** The amount a person usually earns on a working day, with where it is filed. Null when unset. */
export interface DailyWage {
  amountMinor: number;
  /** Income category the one-tap entry is filed under. */
  categoryId: string;
  /** Wallet the wage is received into, or null for no wallet. */
  accountId: string | null;
}

/** Reads a stored or imported daily wage; anything invalid reads as unset. */
export function normalizeDailyWage(raw: unknown): DailyWage | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as { amountMinor?: unknown; categoryId?: unknown; accountId?: unknown };
  if (
    typeof rec.amountMinor !== 'number' ||
    !Number.isSafeInteger(rec.amountMinor) ||
    rec.amountMinor <= 0 ||
    rec.amountMinor > MAX_AMOUNT_MINOR
  ) {
    return null;
  }
  if (typeof rec.categoryId !== 'string' || rec.categoryId.trim().length === 0) return null;
  const accountId =
    typeof rec.accountId === 'string' && rec.accountId.trim().length > 0 ? rec.accountId : null;
  return { amountMinor: rec.amountMinor, categoryId: rec.categoryId, accountId };
}

/** Every wage entry recorded by the one-tap button on one local day (ids in the order they were added). */
export interface DailyWageLast {
  day: string;
  ids: string[];
}

/**
 * Reads a stored value. The old shape `{ id, day }` reads as a one-element list. Anything that is not
 * a YYYY-MM-DD day plus at least one non-empty id reads as none.
 */
export function normalizeDailyWageLast(raw: unknown): DailyWageLast | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as { id?: unknown; ids?: unknown; day?: unknown };
  if (typeof rec.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.day)) return null;
  const candidates: unknown[] = Array.isArray(rec.ids) ? rec.ids : [rec.id];
  const ids: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0 && !ids.includes(candidate)) {
      ids.push(candidate);
    }
  }
  return ids.length === 0 ? null : { day: rec.day, ids };
}

/** Days before a bill's due date to send the early reminder. 0 means the due day only. */
export const BILL_REMINDER_LEAD_DAYS = [0, 1, 3] as const;
export type BillReminderLeadDays = (typeof BILL_REMINDER_LEAD_DAYS)[number];

/** Bill due reminders: one switch and how early to remind. Off by default. */
export interface BillReminderSettings {
  enabled: boolean;
  leadDays: BillReminderLeadDays;
  /** Keep bill names out of the reminder text. Absent means off; app lock forces it on. */
  hideNames?: boolean;
}

export const DEFAULT_BILL_REMINDERS: BillReminderSettings = { enabled: false, leadDays: 1 };

export function isBillReminderLeadDays(raw: unknown): raw is BillReminderLeadDays {
  return raw === 0 || raw === 1 || raw === 3;
}

/** True only for a complete, well-typed value (used to reject a corrupt backup). */
export function isValidBillReminderSettings(raw: unknown): raw is BillReminderSettings {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as { enabled?: unknown; leadDays?: unknown };
  return typeof rec.enabled === 'boolean' && isBillReminderLeadDays(rec.leadDays);
}

/** Reads a stored or imported value; anything missing or invalid reads as the defaults (off, 1 day). */
export function normalizeBillReminderSettings(raw: unknown): BillReminderSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BILL_REMINDERS };
  const rec = raw as { enabled?: unknown; leadDays?: unknown; hideNames?: unknown };
  return {
    enabled: rec.enabled === true,
    leadDays: isBillReminderLeadDays(rec.leadDays) ? rec.leadDays : DEFAULT_BILL_REMINDERS.leadDays,
    ...(rec.hideNames === true ? { hideNames: true } : {}),
  };
}

export interface Settings {
  onboardingDone: boolean;
  name: string;
  avatarColorKey: AvatarColorKey;
  avatarId: AvatarPresetId;
  currency: CurrencyCode;
  language: AppLanguage;
  banglaFont: BanglaFontKey;
  monthStartDay: number;
  theme: ThemePreference;
  accent: AccentTheme;
  incomeColor: IncomeColorKey;
  expenseColor: ExpenseColorKey;
  reminder: ReminderSettings;
  hideAmountsOnOpen: boolean;
  showPoisha: boolean;
  compactNumbers: boolean;
  hapticsEnabled: boolean;
  weekStartsOn: WeekStartDay;
  homeSections: HomeSectionConfig[];
  appLockEnabled: boolean;
  appLockTimeoutSec: number;
  sampleDataLoaded: boolean;
  notificationPermissionDenied: boolean;
  lastBackupAt: number | null;
  speechDisclosureAccepted: boolean;
  lastUsedAccountId: string | null;
  pinnedAmounts: PinnedAmounts;
  /** One-tap "Worked today" income; null until the person sets it. */
  dailyWage: DailyWage | null;
  /** The newest one-tap wage entry (never exported; reset to null by a backup import). */
  dailyWageLast: DailyWageLast | null;
  /** Reminders before a recurring bill or instalment is due, and on the day if still unpaid. */
  billReminders: BillReminderSettings;
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
  /** Optional date the money is expected back (local date, same format as occurredOn). */
  dueOn: LocalDate | null;
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
  dueOn?: LocalDate | null;
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
  dueOn?: LocalDate | null;
  note?: string;
}

export type RecurringBillKind = 'bill' | 'emi' | 'subscription' | 'salary';

export const RECURRING_BILL_KINDS: readonly RecurringBillKind[] = [
  'bill',
  'emi',
  'subscription',
  'salary',
];

export interface RecurringBill {
  id: string;
  name: string;
  kind: RecurringBillKind;
  amountMinor: number;
  dayOfMonth: number;
  categoryId: string | null;
  accountId: string | null;
  totalInstallments: number | null;
  paidInstallments: number;
  lastPaidPeriod: LocalDate | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewRecurringBill {
  id: string;
  name: string;
  kind: RecurringBillKind;
  amountMinor: number;
  dayOfMonth: number;
  categoryId?: string | null;
  accountId?: string | null;
  totalInstallments?: number | null;
  paidInstallments?: number;
  lastPaidPeriod?: LocalDate | null;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface RecurringBillPatch {
  name?: string;
  kind?: RecurringBillKind;
  amountMinor?: number;
  dayOfMonth?: number;
  categoryId?: string | null;
  accountId?: string | null;
  totalInstallments?: number | null;
  paidInstallments?: number;
  lastPaidPeriod?: LocalDate | null;
  isActive?: boolean;
}

export type CaptureSource =
  | 'notification'
  | 'statement_pdf'
  | 'statement_csv'
  | 'ocr_receipt'
  | 'share_text';

export type PendingDraftStatus = 'pending' | 'approved' | 'dismissed';

export interface PendingDraft {
  id: string;
  source: CaptureSource;
  fingerprint: string;
  draftKind: 'transaction' | 'transfer';
  type: TransactionType;
  amountMinor: number;
  feeMinor: number;
  categoryId: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  description: string;
  rawText: string;
  trxId: string | null;
  occurredOn: LocalDate;
  occurredTime: LocalTime | null;
  status: PendingDraftStatus;
  createdAt: number;
}

export interface NewPendingDraft {
  id: string;
  source: CaptureSource;
  fingerprint: string;
  draftKind?: 'transaction' | 'transfer';
  type: TransactionType;
  amountMinor: number;
  feeMinor?: number;
  categoryId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  description?: string;
  rawText: string;
  trxId?: string | null;
  occurredOn: LocalDate;
  occurredTime?: LocalTime | null;
  createdAt?: number;
}
