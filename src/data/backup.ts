import { DEFAULT_CATEGORIES, DEFAULT_CATEGORY_BY_ID } from '@/domain/categories';
import { pruneWageLast } from '@/domain/dailyWage';
import { formatLocalDate, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { MAX_AMOUNT_MINOR } from '@/domain/money';
import { normalizeCategoryColorKey } from '@/theme/categoryColors';
import {
  ACCENT_THEMES,
  CATEGORY_COLOR_KEYS,
  normalizeAccentTheme,
  normalizeAppLanguage,
  normalizeAvatarColorKey,
  normalizeAvatarPresetId,
  normalizeBanglaFontKey,
  normalizeExpenseColorKey,
  normalizeHomeSections,
  isValidBillReminderSettings,
  normalizeBillReminderSettings,
  normalizeDailyWage,
  normalizePinnedAmounts,
  normalizeIncomeColorKey,
  normalizeReminderDays,
  normalizePeriodKind,
  normalizePeriodWeekStartDay,
  normalizeWeeklyBudgetMinor,
  isValidPeriodKind,
  isValidPeriodWeekStartDay,
  normalizeWeekStartDay,
  WEEK_START_DAYS,
  type AccentTheme,
  type Account,
  type Budget,
  type Category,
  type CategoryColorKey,
  type CurrencyCode,
  type DayReviewRecord,
  type DueEntry,
  type LocalDate,
  type Person,
  type PersonHonorific,
  type RecurringBill,
  type RecurringBillKind,
  type Settings,
  type ThemePreference,
  type Transaction,
  type TransactionSource,
  type Transfer,
} from '@/domain/types';
import {
  isValidCurrency,
  isValidLocalTime,
  isValidBudgetAmount,
  isValidMonthStartDay,
  MAX_PROFILE_NAME_LENGTH,
  validateAccountInput,
  validateCategoryInput,
  validateNewDueEntry,
  validateNewTransaction,
  validateNewTransfer,
  validatePersonInput,
} from '@/domain/validation';
import type { BackupDataSnapshot, Repo } from './repo';

export const BACKUP_APP_ID = 'khoroch';
const ACCEPTED_BACKUP_APP_IDS: ReadonlySet<string> = new Set([BACKUP_APP_ID, 'budget-app', 'lenden']);
export const BACKUP_SCHEMA_VERSION = 7;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024; // 20 MB

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const VALID_COLOR_KEY_SET: ReadonlySet<string> = new Set<string>(CATEGORY_COLOR_KEYS);
const VALID_THEMES: ReadonlySet<string> = new Set<ThemePreference>(['system', 'light', 'dark', 'black']);
const VALID_ACCENTS: ReadonlySet<string> = new Set<AccentTheme>(ACCENT_THEMES);
const VALID_WEEK_STARTS: ReadonlySet<string> = new Set<string>(WEEK_START_DAYS);
const VALID_SOURCES: ReadonlySet<string> = new Set<TransactionSource>(['manual', 'quick', 'voice', 'capture', 'sample']);
const DEFAULT_CAT_MAP = new Map(DEFAULT_CATEGORIES.map((d) => [d.id, d]));

export interface BackupFilePayload {
  app: typeof BACKUP_APP_ID;
  schema: number;
  exportedAt: string;
  data: BackupDataSnapshot;
}

export interface BackupPreview {
  dateRangeLabel: string;
  transactionCount: number;
  deletedTransactionCount: number;
  categoryCount: number;
  accountCount: number;
  transferCount: number;
  personCount: number;
  dueCount: number;
  budgetCount: number;
  reviewCount: number;
  summaryLine: string;
}

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function assertBackupWithinSizeLimit(byteSize: number): void {
  if (!Number.isFinite(byteSize) || byteSize < 0) {
    throw new Error('Could not verify backup file size.');
  }
  if (byteSize > MAX_BACKUP_BYTES) {
    throw new Error('Backup file is larger than 20 MB and cannot be imported.');
  }
}

function sanitizeSettingsForExport(s: Settings): Settings {
  // Explicit allow-list ensures no device paths or notification IDs can ever be serialized.
  return {
    onboardingDone: Boolean(s.onboardingDone),
    name: s.name,
    avatarColorKey: normalizeAvatarColorKey(s.avatarColorKey),
    avatarId: normalizeAvatarPresetId(s.avatarId),
    currency: s.currency,
    language: normalizeAppLanguage(s.language),
    banglaFont: normalizeBanglaFontKey(s.banglaFont),
    monthStartDay: s.monthStartDay,
    periodKind: normalizePeriodKind(s.periodKind),
    weekStartDay: normalizePeriodWeekStartDay(s.weekStartDay),
    weeklyBudgetMinor: normalizeWeeklyBudgetMinor(s.weeklyBudgetMinor),
    theme: s.theme,
    accent: normalizeAccentTheme(s.accent),
    incomeColor: normalizeIncomeColorKey(s.incomeColor),
    expenseColor: normalizeExpenseColorKey(s.expenseColor),
    reminder: {
      enabled: Boolean(s.reminder.enabled),
      time: s.reminder.time,
      days: normalizeReminderDays(s.reminder.days),
    },
    hideAmountsOnOpen: Boolean(s.hideAmountsOnOpen),
    showPoisha: Boolean(s.showPoisha),
    compactNumbers: Boolean(s.compactNumbers),
    hapticsEnabled: s.hapticsEnabled === undefined ? true : Boolean(s.hapticsEnabled),
    weekStartsOn: normalizeWeekStartDay(s.weekStartsOn),
    homeSections: normalizeHomeSections(s.homeSections),
    appLockEnabled: Boolean(s.appLockEnabled),
    appLockTimeoutSec:
      typeof s.appLockTimeoutSec === 'number' &&
      Number.isInteger(s.appLockTimeoutSec) &&
      s.appLockTimeoutSec >= 0
        ? s.appLockTimeoutSec
        : 0,
    sampleDataLoaded: Boolean(s.sampleDataLoaded),
    notificationPermissionDenied: Boolean(s.notificationPermissionDenied),
    lastBackupAt: s.lastBackupAt ?? null,
    speechDisclosureAccepted: Boolean(s.speechDisclosureAccepted),
    lastUsedAccountId:
      typeof s.lastUsedAccountId === 'string' && s.lastUsedAccountId.trim().length > 0
        ? s.lastUsedAccountId
        : null,
    pinnedAmounts: normalizePinnedAmounts(s.pinnedAmounts),
    dailyWage: normalizeDailyWage(s.dailyWage),
    billReminders: normalizeBillReminderSettings(s.billReminders),
    // Entry ids are device-local and may not exist after a restore, so this is never exported.
    dailyWageLast: null,
  };
}

export async function exportBackupPayload(
  repo: Repo,
  exportedAt: string = new Date().toISOString()
): Promise<BackupFilePayload> {
  const [
    categories,
    accounts,
    transfers,
    people,
    dueEntries,
    recurringBills,
    transactions,
    budgets,
    settings,
    dayReviews,
  ] = await Promise.all([
    repo.listCategories({ includeArchived: true }),
    repo.listAccounts({ includeArchived: true }),
    repo.listAllTransfersForBackup(),
    repo.listPeople({ includeArchived: true }),
    repo.listAllDueEntriesForBackup(),
    repo.listRecurringBills({ includeInactive: true }),
    repo.listAllTransactionsForBackup(),
    repo.getAllBudgets(),
    repo.getSettings(),
    repo.listAllDayReviews(),
  ]);

  return {
    app: BACKUP_APP_ID,
    schema: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        colorKey: c.colorKey,
        kind: c.kind,
        sortOrder: c.sortOrder,
        isSelected: Boolean(c.isSelected),
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        provider: a.provider,
        colorKey: a.colorKey,
        monogram: a.monogram,
        last4: a.last4,
        defaultFeeBp: a.defaultFeeBp ?? null,
        openingBalanceMinor: a.openingBalanceMinor,
        openingDate: a.openingDate,
        includeInTotal: Boolean(a.includeInTotal),
        sortOrder: a.sortOrder,
        archivedAt: a.archivedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      transfers: transfers.map((tr) => ({
        id: tr.id,
        fromAccountId: tr.fromAccountId,
        toAccountId: tr.toAccountId,
        amountMinor: tr.amountMinor,
        feeMinor: tr.feeMinor,
        occurredOn: tr.occurredOn,
        occurredTime: tr.occurredTime,
        note: tr.note,
        createdAt: tr.createdAt,
        updatedAt: tr.updatedAt,
        deletedAt: tr.deletedAt,
      })),
      people: people.map((p) => ({
        id: p.id,
        name: p.name,
        colorKey: p.colorKey,
        honorific: p.honorific,
        archivedAt: p.archivedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      due_entries: dueEntries.map((d) => ({
        id: d.id,
        personId: d.personId,
        kind: d.kind,
        amountMinor: d.amountMinor,
        accountId: d.accountId,
        occurredOn: d.occurredOn,
        occurredTime: d.occurredTime,
        dueOn: d.dueOn,
        note: d.note,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        deletedAt: d.deletedAt,
      })),
      recurring_bills: recurringBills.map((rb) => ({ ...rb })),
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        transferId: tx.transferId,
        description: tx.description,
        note: tx.note,
        occurredOn: tx.occurredOn,
        occurredTime: tx.occurredTime,
        source: tx.source,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        deletedAt: tx.deletedAt,
      })),
      budgets: budgets.map((b) => ({
        periodStart: b.periodStart,
        categoryId: b.categoryId,
        amountMinor: b.amountMinor,
        updatedAt: b.updatedAt,
      })),
      settings: sanitizeSettingsForExport(settings),
      day_reviews: dayReviews.map((dr) => ({
        day: dr.day,
        reviewedAt: dr.reviewedAt,
      })),
    },
  };
}

export async function exportBackupJson(
  repo: Repo,
  exportedAt?: string
): Promise<string> {
  const payload = await exportBackupPayload(repo, exportedAt);
  return JSON.stringify(payload, null, 2);
}

function asPlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: expected a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function assertFiniteInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new Error(`${label}: expected an integer number.`);
  }
  return value;
}

function validateCategoryRow(raw: unknown, index: number, schema: number): Category {
  const obj = asPlainObject(raw, `Category row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Category row #${index + 1} (${idLabel})`;

  const check = validateCategoryInput({
    id: obj.id,
    name: obj.name,
    kind: obj.kind,
    icon: obj.icon,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  const id = obj.id as string;
  const def = DEFAULT_CAT_MAP.get(id);
  let icon = (obj.icon as string).trim();
  let colorKey: CategoryColorKey;

  if (schema < 2) {
    if (def && icon === def.v1Icon) {
      icon = def.icon;
    }
    if (typeof obj.colorKey === 'string' && VALID_COLOR_KEY_SET.has(obj.colorKey)) {
      colorKey = obj.colorKey as CategoryColorKey;
    } else {
      colorKey = def?.colorKey ?? 'gray';
    }
  } else {
    if (typeof obj.colorKey !== 'string' || !VALID_COLOR_KEY_SET.has(obj.colorKey)) {
      throw new Error(`${label}: invalid colorKey.`);
    }
    colorKey = obj.colorKey as CategoryColorKey;
  }

  const sortOrder =
    obj.sortOrder === undefined ? 0 : assertFiniteInteger(obj.sortOrder, `${label} sortOrder`);
  if (typeof obj.isSelected !== 'boolean') {
    throw new Error(`${label}: isSelected must be boolean.`);
  }
  const archivedAt =
    obj.archivedAt === null || obj.archivedAt === undefined
      ? null
      : assertFiniteInteger(obj.archivedAt, `${label} archivedAt`);
  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);

  return {
    id,
    name: (obj.name as string).trim(),
    icon,
    colorKey,
    kind: obj.kind as Category['kind'],
    sortOrder,
    isSelected: obj.isSelected,
    archivedAt,
    createdAt,
  };
}

function validateAccountRow(raw: unknown, index: number): Account {
  const obj = asPlainObject(raw, `Account row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Account row #${index + 1} (${idLabel})`;

  const check = validateAccountInput({
    id: obj.id,
    name: obj.name,
    kind: obj.kind,
    provider: obj.provider,
    colorKey: obj.colorKey,
    monogram: obj.monogram,
    last4: obj.last4,
    defaultFeeBp: obj.defaultFeeBp,
    openingBalanceMinor: obj.openingBalanceMinor ?? 0,
    openingDate: obj.openingDate,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  if (typeof obj.includeInTotal !== 'boolean') {
    throw new Error(`${label}: includeInTotal must be boolean.`);
  }
  const sortOrder =
    obj.sortOrder === undefined ? 0 : assertFiniteInteger(obj.sortOrder, `${label} sortOrder`);
  const archivedAt =
    obj.archivedAt === null || obj.archivedAt === undefined
      ? null
      : assertFiniteInteger(obj.archivedAt, `${label} archivedAt`);
  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);

  return {
    id: obj.id as string,
    name: (obj.name as string).trim(),
    kind: obj.kind as Account['kind'],
    provider: (obj.provider ?? null) as string | null,
    colorKey: (obj.colorKey as string).trim(),
    monogram:
      obj.monogram !== undefined && obj.monogram !== null
        ? (obj.monogram as string).trim() || null
        : null,
    last4: (obj.last4 ?? null) as string | null,
    defaultFeeBp: (obj.defaultFeeBp ?? null) as number | null,
    openingBalanceMinor: (obj.openingBalanceMinor ?? 0) as number,
    openingDate: obj.openingDate as LocalDate,
    includeInTotal: obj.includeInTotal,
    sortOrder,
    archivedAt,
    createdAt,
    updatedAt,
  };
}

function validateTransferRow(
  raw: unknown,
  index: number,
  accountIds: ReadonlySet<string>
): Transfer {
  const obj = asPlainObject(raw, `Transfer row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Transfer row #${index + 1} (${idLabel})`;

  const feeMinor = obj.feeMinor ?? 0;
  const note = obj.note ?? '';
  const check = validateNewTransfer({
    id: obj.id,
    fromAccountId: obj.fromAccountId,
    toAccountId: obj.toAccountId,
    amountMinor: obj.amountMinor,
    feeMinor,
    occurredOn: obj.occurredOn,
    occurredTime: obj.occurredTime,
    note,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  const fromId = obj.fromAccountId as string;
  const toId = obj.toAccountId as string;
  if (!accountIds.has(fromId)) {
    throw new Error(`${label}: missing fromAccount "${fromId}".`);
  }
  if (!accountIds.has(toId)) {
    throw new Error(`${label}: missing toAccount "${toId}".`);
  }

  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);
  const deletedAt =
    obj.deletedAt === null || obj.deletedAt === undefined
      ? null
      : assertFiniteInteger(obj.deletedAt, `${label} deletedAt`);

  return {
    id: obj.id as string,
    fromAccountId: fromId,
    toAccountId: toId,
    amountMinor: obj.amountMinor as number,
    feeMinor: feeMinor as number,
    occurredOn: obj.occurredOn as LocalDate,
    occurredTime: (obj.occurredTime ?? null) as string | null,
    note: note as string,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

function validatePersonRow(raw: unknown, index: number): Person {
  const obj = asPlainObject(raw, `Person row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Person row #${index + 1} (${idLabel})`;

  const honorific = obj.honorific ?? 'none';
  const check = validatePersonInput({
    id: obj.id,
    name: obj.name,
    colorKey: obj.colorKey,
    honorific,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  const archivedAt =
    obj.archivedAt === null || obj.archivedAt === undefined
      ? null
      : assertFiniteInteger(obj.archivedAt, `${label} archivedAt`);
  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);

  return {
    id: obj.id as string,
    name: (obj.name as string).trim(),
    colorKey: normalizeCategoryColorKey(obj.colorKey as string),
    honorific: honorific as PersonHonorific,
    archivedAt,
    createdAt,
    updatedAt,
  };
}

function validateDueEntryRow(
  raw: unknown,
  index: number,
  personIds: ReadonlySet<string>,
  accountIds: ReadonlySet<string>
): DueEntry {
  const obj = asPlainObject(raw, `Due row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Due row #${index + 1} (${idLabel})`;

  const note = obj.note ?? '';
  const check = validateNewDueEntry({
    id: obj.id,
    personId: obj.personId,
    kind: obj.kind,
    amountMinor: obj.amountMinor,
    accountId: obj.accountId,
    occurredOn: obj.occurredOn,
    occurredTime: obj.occurredTime,
    dueOn: obj.dueOn,
    note,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  const personId = obj.personId as string;
  if (!personIds.has(personId)) {
    throw new Error(`${label}: missing person "${personId}".`);
  }

  if (
    obj.accountId !== null &&
    obj.accountId !== undefined &&
    (typeof obj.accountId !== 'string' || !accountIds.has(obj.accountId))
  ) {
    throw new Error(`${label}: missing account "${String(obj.accountId)}".`);
  }

  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);
  const deletedAt =
    obj.deletedAt === null || obj.deletedAt === undefined
      ? null
      : assertFiniteInteger(obj.deletedAt, `${label} deletedAt`);

  return {
    id: obj.id as string,
    personId,
    kind: obj.kind as DueEntry['kind'],
    amountMinor: obj.amountMinor as number,
    accountId: (obj.accountId ?? null) as string | null,
    occurredOn: obj.occurredOn as LocalDate,
    occurredTime: (obj.occurredTime ?? null) as string | null,
    dueOn: (obj.dueOn ?? null) as LocalDate | null,
    note: note as string,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

function validateTransactionRow(
  raw: unknown,
  index: number,
  categoryIds: ReadonlySet<string>,
  accountIds: ReadonlySet<string>,
  transferIds: ReadonlySet<string>
): Transaction {
  const obj = asPlainObject(raw, `Transaction row #${index + 1}`);
  const idLabel = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `index ${index}`;
  const label = `Transaction row #${index + 1} (${idLabel})`;

  if (
    obj.categoryId !== null &&
    obj.categoryId !== undefined &&
    (typeof obj.categoryId !== 'string' || !categoryIds.has(obj.categoryId))
  ) {
    throw new Error(`${label}: missing category "${String(obj.categoryId)}".`);
  }
  if (
    obj.accountId !== null &&
    obj.accountId !== undefined &&
    (typeof obj.accountId !== 'string' || !accountIds.has(obj.accountId))
  ) {
    throw new Error(`${label}: missing account "${String(obj.accountId)}".`);
  }
  if (
    obj.transferId !== null &&
    obj.transferId !== undefined &&
    (typeof obj.transferId !== 'string' || !transferIds.has(obj.transferId))
  ) {
    throw new Error(`${label}: missing transfer "${String(obj.transferId)}".`);
  }

  const description = obj.description ?? '';
  const note = obj.note ?? '';
  const check = validateNewTransaction({
    id: typeof obj.id === 'string' ? obj.id : '',
    type: obj.type,
    amountMinor: obj.amountMinor,
    currency: obj.currency,
    occurredOn: obj.occurredOn,
    occurredTime: obj.occurredTime,
    categoryId: obj.categoryId,
    description,
    note,
  });
  if (!check.valid) {
    throw new Error(`${label}: ${check.errors.join(', ')}`);
  }

  const sourceRaw = obj.source ?? 'manual';
  if (typeof sourceRaw !== 'string' || !VALID_SOURCES.has(sourceRaw)) {
    throw new Error(`${label}: invalid source "${String(obj.source)}".`);
  }

  const createdAt = assertFiniteInteger(obj.createdAt, `${label} createdAt`);
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);
  const deletedAt =
    obj.deletedAt === null || obj.deletedAt === undefined
      ? null
      : assertFiniteInteger(obj.deletedAt, `${label} deletedAt`);

  return {
    id: obj.id as string,
    type: obj.type as Transaction['type'],
    amountMinor: obj.amountMinor as number,
    currency: obj.currency as CurrencyCode,
    categoryId: (obj.categoryId ?? null) as string | null,
    accountId: (obj.accountId ?? null) as string | null,
    transferId: (obj.transferId ?? null) as string | null,
    description: description as string,
    note: note as string,
    occurredOn: obj.occurredOn as LocalDate,
    occurredTime: (obj.occurredTime ?? null) as string | null,
    source: sourceRaw as TransactionSource,
    createdAt,
    updatedAt,
    deletedAt,
  };
}

function validateBudgetRow(
  raw: unknown,
  index: number,
  categoryIds: ReadonlySet<string>
): Budget {
  const obj = asPlainObject(raw, `Budget row #${index + 1}`);
  const periodLabel = typeof obj.periodStart === 'string' ? obj.periodStart : `index ${index}`;
  const label = `Budget row #${index + 1} (${periodLabel})`;

  if (typeof obj.periodStart !== 'string' || !isValidLocalDate(obj.periodStart)) {
    throw new Error(`${label}: invalid periodStart date.`);
  }
  if (typeof obj.categoryId !== 'string') {
    throw new Error(`${label}: invalid categoryId.`);
  }
  if (obj.categoryId !== '' && !categoryIds.has(obj.categoryId)) {
    throw new Error(`${label}: missing category "${obj.categoryId}".`);
  }
  if (
    typeof obj.amountMinor !== 'number' ||
    !Number.isInteger(obj.amountMinor) ||
    obj.amountMinor < 0 ||
    obj.amountMinor > MAX_AMOUNT_MINOR
  ) {
    throw new Error(`${label}: invalid budget amount.`);
  }
  const updatedAt = assertFiniteInteger(obj.updatedAt, `${label} updatedAt`);

  return {
    periodStart: obj.periodStart,
    categoryId: obj.categoryId,
    amountMinor: obj.amountMinor,
    updatedAt,
  };
}

function validateDayReviewRow(raw: unknown, index: number): DayReviewRecord {
  const obj = asPlainObject(raw, `Day review row #${index + 1}`);
  const dayLabel = typeof obj.day === 'string' ? obj.day : `index ${index}`;
  const label = `Day review row #${index + 1} (${dayLabel})`;

  if (typeof obj.day !== 'string' || !isValidLocalDate(obj.day)) {
    throw new Error(`${label}: invalid date.`);
  }
  const reviewedAt = assertFiniteInteger(obj.reviewedAt, `${label} reviewedAt`);
  return {
    day: obj.day,
    reviewedAt,
  };
}

function validateSettingsObject(raw: unknown): Settings {
  const obj = asPlainObject(raw, 'Settings');
  if (typeof obj.onboardingDone !== 'boolean') {
    throw new Error('Settings: onboardingDone must be boolean.');
  }
  if (typeof obj.name !== 'string' || obj.name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new Error('Settings: invalid profile name.');
  }
  if (!isValidCurrency(obj.currency)) {
    throw new Error('Settings: invalid currency.');
  }
  if (!isValidMonthStartDay(obj.monthStartDay)) {
    throw new Error('Settings: invalid monthStartDay (must be integer 1..28).');
  }
  if (typeof obj.theme !== 'string' || !VALID_THEMES.has(obj.theme)) {
    throw new Error('Settings: invalid theme.');
  }
  // The three weekly-period keys are optional: an old backup has none and imports as monthly.
  if (obj.periodKind !== undefined && !isValidPeriodKind(obj.periodKind)) {
    throw new Error('Settings: invalid periodKind (must be month or week).');
  }
  if (obj.weekStartDay !== undefined && !isValidPeriodWeekStartDay(obj.weekStartDay)) {
    throw new Error('Settings: invalid weekStartDay (must be integer 0..6).');
  }
  if (
    obj.weeklyBudgetMinor !== undefined &&
    obj.weeklyBudgetMinor !== null &&
    !isValidBudgetAmount(obj.weeklyBudgetMinor)
  ) {
    throw new Error('Settings: invalid weeklyBudgetMinor.');
  }

  const reminderObj = asPlainObject(obj.reminder, 'Settings.reminder');
  if (typeof reminderObj.enabled !== 'boolean') {
    throw new Error('Settings.reminder: enabled must be boolean.');
  }
  if (typeof reminderObj.time !== 'string' || !isValidLocalTime(reminderObj.time)) {
    throw new Error('Settings.reminder: invalid time.');
  }
  if (
    reminderObj.days !== 'everyday' &&
    reminderObj.days !== 'weekdays' &&
    !Array.isArray(reminderObj.days)
  ) {
    throw new Error('Settings.reminder: invalid days.');
  }
  if (Array.isArray(reminderObj.days)) {
    for (let i = 0; i < reminderObj.days.length; i += 1) {
      const d = reminderObj.days[i];
      if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) {
        throw new Error(`Settings.reminder: invalid day value at index ${i}.`);
      }
    }
  }

  if (
    obj.lastBackupAt !== undefined &&
    obj.lastBackupAt !== null &&
    (!Number.isInteger(obj.lastBackupAt) || !Number.isFinite(obj.lastBackupAt as number))
  ) {
    throw new Error('Settings: invalid lastBackupAt.');
  }

  if (obj.accent !== undefined && (typeof obj.accent !== 'string' || !VALID_ACCENTS.has(obj.accent))) {
    throw new Error('Settings: invalid accent.');
  }
  if (
    obj.weekStartsOn !== undefined &&
    (typeof obj.weekStartsOn !== 'string' || !VALID_WEEK_STARTS.has(obj.weekStartsOn))
  ) {
    throw new Error('Settings: invalid weekStartsOn.');
  }
  if (
    obj.avatarColorKey !== undefined &&
    (typeof obj.avatarColorKey !== 'string' ||
      (obj.avatarColorKey !== 'accent' && !VALID_COLOR_KEY_SET.has(obj.avatarColorKey)))
  ) {
    throw new Error('Settings: invalid avatarColorKey.');
  }
  if (obj.homeSections !== undefined && !Array.isArray(obj.homeSections)) {
    throw new Error('Settings: invalid homeSections.');
  }
  if (
    obj.appLockTimeoutSec !== undefined &&
    (typeof obj.appLockTimeoutSec !== 'number' ||
      !Number.isInteger(obj.appLockTimeoutSec) ||
      obj.appLockTimeoutSec < 0)
  ) {
    throw new Error('Settings: invalid appLockTimeoutSec.');
  }
  if (
    obj.dailyWage !== undefined &&
    obj.dailyWage !== null &&
    normalizeDailyWage(obj.dailyWage) === null
  ) {
    throw new Error('Settings: invalid dailyWage.');
  }
  if (obj.billReminders !== undefined && !isValidBillReminderSettings(obj.billReminders)) {
    throw new Error('Settings: invalid billReminders.');
  }

  return {
    onboardingDone: obj.onboardingDone,
    name: obj.name,
    avatarColorKey: normalizeAvatarColorKey(obj.avatarColorKey),
    avatarId: normalizeAvatarPresetId(obj.avatarId),
    currency: obj.currency,
    language: normalizeAppLanguage(obj.language, 'en'),
    banglaFont: normalizeBanglaFontKey(obj.banglaFont, 'noto_sans_bengali'),
    monthStartDay: obj.monthStartDay,
    // Old backups have none of these: they import as monthly with no weekly budget.
    periodKind: normalizePeriodKind(obj.periodKind),
    weekStartDay: normalizePeriodWeekStartDay(obj.weekStartDay),
    weeklyBudgetMinor: normalizeWeeklyBudgetMinor(obj.weeklyBudgetMinor),
    theme: obj.theme as ThemePreference,
    accent: (obj.accent ?? 'forest') as AccentTheme,
    incomeColor: normalizeIncomeColorKey(obj.incomeColor, 'emerald'),
    expenseColor: normalizeExpenseColorKey(obj.expenseColor, 'ink'),
    reminder: {
      enabled: reminderObj.enabled,
      time: reminderObj.time,
      days: normalizeReminderDays(reminderObj.days),
    },
    hideAmountsOnOpen: Boolean(obj.hideAmountsOnOpen),
    showPoisha: Boolean(obj.showPoisha),
    compactNumbers: Boolean(obj.compactNumbers),
    hapticsEnabled: obj.hapticsEnabled === undefined ? true : Boolean(obj.hapticsEnabled),
    weekStartsOn: normalizeWeekStartDay(obj.weekStartsOn),
    homeSections: normalizeHomeSections(obj.homeSections),
    appLockEnabled: Boolean(obj.appLockEnabled),
    appLockTimeoutSec:
      typeof obj.appLockTimeoutSec === 'number' ? obj.appLockTimeoutSec : 0,
    sampleDataLoaded: Boolean(obj.sampleDataLoaded),
    notificationPermissionDenied: Boolean(obj.notificationPermissionDenied),
    lastBackupAt: (obj.lastBackupAt ?? null) as number | null,
    speechDisclosureAccepted: Boolean(obj.speechDisclosureAccepted),
    lastUsedAccountId:
      typeof obj.lastUsedAccountId === 'string' && obj.lastUsedAccountId.trim().length > 0
        ? obj.lastUsedAccountId
        : null,
    pinnedAmounts: normalizePinnedAmounts(obj.pinnedAmounts),
    dailyWage: normalizeDailyWage(obj.dailyWage),
    // Old backups have no key: reminders import as off.
    billReminders: normalizeBillReminderSettings(obj.billReminders),
    // Always reset on import: an id from another backup may not match any entry here.
    dailyWageLast: null,
  };
}

/**
 * Drops wallets that duplicate another wallet (same name, kind and provider) and that no entry,
 * transfer or due refers to. The wallet that carries the history is always kept.
 */
export function dropUnusedDuplicateWallets(
  accounts: Account[],
  transactions: readonly { accountId: string | null }[],
  transfers: readonly { fromAccountId: string; toAccountId: string }[],
  dueEntries: readonly { accountId?: string | null }[]
): Account[] {
  const used = new Set<string>();
  for (const tx of transactions) if (tx.accountId) used.add(tx.accountId);
  for (const tr of transfers) {
    used.add(tr.fromAccountId);
    used.add(tr.toAccountId);
  }
  for (const due of dueEntries) if (due.accountId) used.add(due.accountId);

  const keyOf = (a: Account) => `${a.name.trim().toLowerCase()}|${a.kind}|${a.provider ?? ''}`;
  const groups = new Map<string, Account[]>();
  for (const a of accounts) {
    const key = keyOf(a);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const drop = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = group.find((a) => used.has(a.id)) ?? group[0];
    for (const a of group) {
      if (a.id !== keep.id && !used.has(a.id)) drop.add(a.id);
    }
  }
  return drop.size === 0 ? accounts : accounts.filter((a) => !drop.has(a.id));
}

export function parseAndValidateBackup(
  rawText: string,
  byteSizeOverride?: number
): BackupFilePayload {
  if (byteSizeOverride !== undefined) {
    assertBackupWithinSizeLimit(byteSizeOverride);
  }
  assertBackupWithinSizeLimit(utf8ByteLength(rawText));

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  const root = asPlainObject(parsed, 'Backup');
  if (typeof root.app !== 'string' || !ACCEPTED_BACKUP_APP_IDS.has(root.app)) {
    throw new Error('This file is not a Khoroch backup.');
  }
  if (
    typeof root.schema !== 'number' ||
    !Number.isInteger(root.schema) ||
    root.schema < 1
  ) {
    throw new Error('Backup schema version is invalid.');
  }
  if (root.schema > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Made by a newer version (schema ${root.schema}). Update Khoroch before restoring this file.`
    );
  }
  const exportedAt =
    typeof root.exportedAt === 'string' && root.exportedAt.trim()
      ? root.exportedAt
      : new Date().toISOString();

  const dataObj = asPlainObject(root.data, 'Backup.data');
  if (!Array.isArray(dataObj.categories)) {
    throw new Error('Backup.data.categories must be an array.');
  }
  const accountsRaw =
    dataObj.accounts === undefined && root.schema < 3 ? [] : dataObj.accounts;
  if (!Array.isArray(accountsRaw)) {
    throw new Error('Backup.data.accounts must be an array.');
  }
  const transfersRaw =
    dataObj.transfers === undefined && root.schema < 3 ? [] : dataObj.transfers;
  if (!Array.isArray(transfersRaw)) {
    throw new Error('Backup.data.transfers must be an array.');
  }
  const peopleRaw =
    dataObj.people === undefined && root.schema < 4 ? [] : dataObj.people;
  if (!Array.isArray(peopleRaw)) {
    throw new Error('Backup.data.people must be an array.');
  }
  const dueEntriesRaw =
    dataObj.due_entries === undefined && root.schema < 4 ? [] : dataObj.due_entries;
  if (!Array.isArray(dueEntriesRaw)) {
    throw new Error('Backup.data.due_entries must be an array.');
  }
  if (!Array.isArray(dataObj.transactions)) {
    throw new Error('Backup.data.transactions must be an array.');
  }
  if (!Array.isArray(dataObj.budgets)) {
    throw new Error('Backup.data.budgets must be an array.');
  }
  const dayReviewsRaw =
    dataObj.day_reviews === undefined && root.schema === 1 ? [] : dataObj.day_reviews;
  if (!Array.isArray(dayReviewsRaw)) {
    throw new Error('Backup.data.day_reviews must be an array.');
  }

  const categories: Category[] = [];
  const categoryIds = new Set<string>();
  for (let i = 0; i < dataObj.categories.length; i += 1) {
    const cat = validateCategoryRow(dataObj.categories[i], i, root.schema);
    if (categoryIds.has(cat.id)) {
      throw new Error(`Category row #${i + 1} (${cat.id}): duplicate category id.`);
    }
    categoryIds.add(cat.id);
    categories.push(cat);
  }
  if (root.schema < 3 && !categoryIds.has('fees')) {
    const feesDef = DEFAULT_CATEGORY_BY_ID.fees;
    if (feesDef) {
      categoryIds.add(feesDef.id);
      categories.push({
        id: feesDef.id,
        name: feesDef.name,
        icon: feesDef.icon,
        colorKey: feesDef.colorKey,
        kind: feesDef.kind,
        sortOrder: feesDef.sortOrder,
        isSelected: true,
        archivedAt: null,
        createdAt: 0,
      });
    }
  }

  const accounts: Account[] = [];
  const accountIds = new Set<string>();
  for (let i = 0; i < accountsRaw.length; i += 1) {
    const acc = validateAccountRow(accountsRaw[i], i);
    if (accountIds.has(acc.id)) {
      throw new Error(`Account row #${i + 1} (${acc.id}): duplicate account id.`);
    }
    accountIds.add(acc.id);
    accounts.push(acc);
  }

  const transfers: Transfer[] = [];
  const transferIds = new Set<string>();
  for (let i = 0; i < transfersRaw.length; i += 1) {
    const tr = validateTransferRow(transfersRaw[i], i, accountIds);
    if (transferIds.has(tr.id)) {
      throw new Error(`Transfer row #${i + 1} (${tr.id}): duplicate transfer id.`);
    }
    transferIds.add(tr.id);
    transfers.push(tr);
  }

  const people: Person[] = [];
  const personIds = new Set<string>();
  for (let i = 0; i < peopleRaw.length; i += 1) {
    const person = validatePersonRow(peopleRaw[i], i);
    if (personIds.has(person.id)) {
      throw new Error(`Person row #${i + 1} (${person.id}): duplicate person id.`);
    }
    personIds.add(person.id);
    people.push(person);
  }

  const dueEntries: DueEntry[] = [];
  const dueIds = new Set<string>();
  for (let i = 0; i < dueEntriesRaw.length; i += 1) {
    const due = validateDueEntryRow(dueEntriesRaw[i], i, personIds, accountIds);
    if (dueIds.has(due.id)) {
      throw new Error(`Due row #${i + 1} (${due.id}): duplicate due id.`);
    }
    dueIds.add(due.id);
    dueEntries.push(due);
  }

  const transactions: Transaction[] = [];
  const txIds = new Set<string>();
  for (let i = 0; i < dataObj.transactions.length; i += 1) {
    const tx = validateTransactionRow(
      dataObj.transactions[i],
      i,
      categoryIds,
      accountIds,
      transferIds
    );
    if (txIds.has(tx.id)) {
      throw new Error(`Transaction row #${i + 1} (${tx.id}): duplicate transaction id.`);
    }
    txIds.add(tx.id);
    transactions.push(tx);
  }

  const budgets: Budget[] = [];
  const budgetKeys = new Set<string>();
  for (let i = 0; i < dataObj.budgets.length; i += 1) {
    const budget = validateBudgetRow(dataObj.budgets[i], i, categoryIds);
    const key = `${budget.periodStart}::${budget.categoryId}`;
    if (budgetKeys.has(key)) {
      throw new Error(
        `Budget row #${i + 1} (${budget.periodStart}): duplicate budget key.`
      );
    }
    budgetKeys.add(key);
    budgets.push(budget);
  }

  const dayReviews: DayReviewRecord[] = [];
  const reviewDays = new Set<string>();
  for (let i = 0; i < dayReviewsRaw.length; i += 1) {
    const dr = validateDayReviewRow(dayReviewsRaw[i], i);
    if (reviewDays.has(dr.day)) {
      throw new Error(`Day review row #${i + 1} (${dr.day}): duplicate day review.`);
    }
    reviewDays.add(dr.day);
    dayReviews.push(dr);
  }

  const settings = validateSettingsObject(dataObj.settings);
  if (settings.lastUsedAccountId && !accountIds.has(settings.lastUsedAccountId)) {
    settings.lastUsedAccountId = null;
  }

  const recurringRaw = Array.isArray(dataObj.recurring_bills) ? dataObj.recurring_bills : [];
  const recurringBills: RecurringBill[] = [];
  for (let i = 0; i < recurringRaw.length; i += 1) {
    const raw = recurringRaw[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.name !== 'string') continue;
    const kind: RecurringBillKind =
      obj.kind === 'emi' || obj.kind === 'subscription' || obj.kind === 'salary'
        ? obj.kind
        : 'bill';
    const amountMinor = typeof obj.amountMinor === 'number' && obj.amountMinor > 0 ? Math.trunc(obj.amountMinor) : 0;
    const dayOfMonth =
      typeof obj.dayOfMonth === 'number' && obj.dayOfMonth >= 1 && obj.dayOfMonth <= 31
        ? Math.trunc(obj.dayOfMonth)
        : 1;
    if (amountMinor <= 0) continue;
    recurringBills.push({
      id: obj.id,
      name: obj.name.trim() || 'Bill',
      kind,
      amountMinor,
      dayOfMonth,
      categoryId: typeof obj.categoryId === 'string' && categoryIds.has(obj.categoryId) ? obj.categoryId : null,
      accountId: typeof obj.accountId === 'string' && accountIds.has(obj.accountId) ? obj.accountId : null,
      totalInstallments: typeof obj.totalInstallments === 'number' && obj.totalInstallments > 0 ? Math.trunc(obj.totalInstallments) : null,
      paidInstallments: typeof obj.paidInstallments === 'number' && obj.paidInstallments >= 0 ? Math.trunc(obj.paidInstallments) : 0,
      lastPaidPeriod: typeof obj.lastPaidPeriod === 'string' ? obj.lastPaidPeriod : null,
      isActive: typeof obj.isActive === 'boolean' ? obj.isActive : true,
      createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : Date.now(),
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
    });
  }

  return {
    app: BACKUP_APP_ID,
    schema: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      categories,
      accounts: dropUnusedDuplicateWallets(accounts, transactions, transfers, dueEntries),
      transfers,
      people,
      due_entries: dueEntries,
      recurring_bills: recurringBills,
      transactions,
      budgets,
      settings,
      day_reviews: dayReviews,
    },
  };
}

function formatShortDayMonth(date: LocalDate, includeYear: boolean): string {
  const [yStr, mStr, dStr] = date.split('-');
  const day = Number.parseInt(dStr, 10);
  const monthIdx = Number.parseInt(mStr, 10) - 1;
  const month = MONTH_SHORT[monthIdx] ?? mStr;
  return includeYear ? `${day} ${month} ${yStr}` : `${day} ${month}`;
}

export function buildBackupPreview(payload: BackupFilePayload): BackupPreview {
  const activeTxs = payload.data.transactions.filter((t) => t.deletedAt === null);
  const deletedTransactionCount = payload.data.transactions.length - activeTxs.length;
  const activeCategoryCount = payload.data.categories.filter((c) => c.archivedAt === null).length;
  const activeAccountCount = payload.data.accounts.filter((a) => a.archivedAt === null).length;
  const activeTransferCount = payload.data.transfers.filter((tr) => tr.deletedAt === null).length;
  const activePersonCount = payload.data.people.filter((p) => p.archivedAt === null).length;
  const activeDueCount = payload.data.due_entries.filter((d) => d.deletedAt === null).length;

  let dateRangeLabel = 'No transactions';
  if (activeTxs.length > 0) {
    let minDate = activeTxs[0].occurredOn;
    let maxDate = activeTxs[0].occurredOn;
    for (const tx of activeTxs) {
      if (tx.occurredOn < minDate) minDate = tx.occurredOn;
      if (tx.occurredOn > maxDate) maxDate = tx.occurredOn;
    }
    const multiYear = minDate.slice(0, 4) !== maxDate.slice(0, 4);
    const startLabel = formatShortDayMonth(minDate, multiYear);
    const endLabel = formatShortDayMonth(maxDate, multiYear);
    dateRangeLabel = minDate === maxDate ? startLabel : `${startLabel} – ${endLabel}`;
  }

  const txWord = activeTxs.length === 1 ? '1 transaction' : `${activeTxs.length} transactions`;
  const catWord =
    activeCategoryCount === 1 ? '1 category' : `${activeCategoryCount} categories`;
  const summaryLine =
    activeTxs.length > 0
      ? `${dateRangeLabel} · ${txWord} · ${catWord}`
      : `No transactions · ${catWord}`;

  return {
    dateRangeLabel,
    transactionCount: activeTxs.length,
    deletedTransactionCount,
    categoryCount: activeCategoryCount,
    accountCount: activeAccountCount,
    transferCount: activeTransferCount,
    personCount: activePersonCount,
    dueCount: activeDueCount,
    budgetCount: payload.data.budgets.length,
    reviewCount: payload.data.day_reviews.length,
    summaryLine,
  };
}

/**
 * Restores a backup. The app lock is never changed by an import: whether the lock is on is
 * decided by the credential in secure storage on this device, so a backup (old, edited or from
 * another phone) cannot switch it off or change its timeout. Those two settings keep their
 * current values on this device. Exporting them is harmless and unchanged.
 */
export async function restoreBackupPayload(
  repo: Repo,
  payload: BackupFilePayload,
  today: LocalDate = todayLocalDate()
): Promise<void> {
  const current = await repo.getSettings();
  await repo.replaceAllDataFromBackup({
    ...payload.data,
    settings: {
      ...payload.data.settings,
      appLockEnabled: current.appLockEnabled,
      appLockTimeoutSec: current.appLockTimeoutSec,
    },
  });
  // The worked-today pointer is device-local and never in a backup. Keep the local ids that exist
  // as live entries dated today in the restored data, and drop the rest.
  const local = current.dailyWageLast;
  if (local === null) return;
  try {
    const found = await Promise.all(local.ids.map((id) => repo.getTransaction(id)));
    const kept = pruneWageLast(local, found, today);
    await repo.setSetting('dailyWageLast', kept);
  } catch {
    // The restore itself succeeded. Without the pointer the button simply offers the wage again.
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function epochMsToLocalDate(ms: number): LocalDate {
  const date = new Date(ms);
  return formatLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function isBackupDue(
  lastBackupAt: number | null,
  nowMs: number = Date.now()
): boolean {
  if (lastBackupAt === null) return true;
  return nowMs - lastBackupAt >= THIRTY_DAYS_MS;
}
