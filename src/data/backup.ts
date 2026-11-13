import { DEFAULT_CATEGORIES } from '@/domain/categories';
import { formatLocalDate, isValidLocalDate } from '@/domain/dates';
import { MAX_AMOUNT_MINOR } from '@/domain/money';
import {
  ACCENT_THEMES,
  CATEGORY_COLOR_KEYS,
  normalizeAccentTheme,
  normalizeReminderDays,
  type AccentTheme,
  type Budget,
  type Category,
  type CategoryColorKey,
  type CurrencyCode,
  type DayReviewRecord,
  type LocalDate,
  type Settings,
  type ThemePreference,
  type Transaction,
  type TransactionSource,
} from '@/domain/types';
import {
  isValidCurrency,
  isValidLocalTime,
  isValidMonthStartDay,
  MAX_PROFILE_NAME_LENGTH,
  validateCategoryInput,
  validateNewTransaction,
} from '@/domain/validation';
import type { BackupDataSnapshot, Repo } from './repo';

export const BACKUP_APP_ID = 'budget-app';
export const BACKUP_SCHEMA_VERSION = 2;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024; // 20 MB

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const VALID_COLOR_KEY_SET: ReadonlySet<string> = new Set<string>(CATEGORY_COLOR_KEYS);
const VALID_THEMES: ReadonlySet<string> = new Set<ThemePreference>(['system', 'light', 'dark', 'black']);
const VALID_ACCENTS: ReadonlySet<string> = new Set<AccentTheme>(ACCENT_THEMES);
const VALID_SOURCES: ReadonlySet<string> = new Set<TransactionSource>(['manual', 'quick', 'voice', 'sample']);
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
    currency: s.currency,
    monthStartDay: s.monthStartDay,
    theme: s.theme,
    accent: normalizeAccentTheme(s.accent),
    reminder: {
      enabled: Boolean(s.reminder.enabled),
      time: s.reminder.time,
      days: normalizeReminderDays(s.reminder.days),
    },
    sampleDataLoaded: Boolean(s.sampleDataLoaded),
    notificationPermissionDenied: Boolean(s.notificationPermissionDenied),
    lastBackupAt: s.lastBackupAt ?? null,
    speechDisclosureAccepted: Boolean(s.speechDisclosureAccepted),
  };
}

export async function exportBackupPayload(
  repo: Repo,
  exportedAt: string = new Date().toISOString()
): Promise<BackupFilePayload> {
  const [categories, transactions, budgets, settings, dayReviews] = await Promise.all([
    repo.listCategories({ includeArchived: true }),
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
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        categoryId: tx.categoryId,
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

function validateTransactionRow(
  raw: unknown,
  index: number,
  categoryIds: ReadonlySet<string>
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

  return {
    onboardingDone: obj.onboardingDone,
    name: obj.name,
    currency: obj.currency,
    monthStartDay: obj.monthStartDay,
    theme: obj.theme as ThemePreference,
    accent: (obj.accent ?? 'forest') as AccentTheme,
    reminder: {
      enabled: reminderObj.enabled,
      time: reminderObj.time,
      days: normalizeReminderDays(reminderObj.days),
    },
    sampleDataLoaded: Boolean(obj.sampleDataLoaded),
    notificationPermissionDenied: Boolean(obj.notificationPermissionDenied),
    lastBackupAt: (obj.lastBackupAt ?? null) as number | null,
    speechDisclosureAccepted: Boolean(obj.speechDisclosureAccepted),
  };
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
  if (root.app !== BACKUP_APP_ID) {
    throw new Error('This file is not a Budget App backup.');
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
      `Made by a newer version (schema ${root.schema}). Update Budget App before restoring this file.`
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

  const transactions: Transaction[] = [];
  const txIds = new Set<string>();
  for (let i = 0; i < dataObj.transactions.length; i += 1) {
    const tx = validateTransactionRow(dataObj.transactions[i], i, categoryIds);
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

  return {
    app: BACKUP_APP_ID,
    schema: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      categories,
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
    budgetCount: payload.data.budgets.length,
    reviewCount: payload.data.day_reviews.length,
    summaryLine,
  };
}

export async function restoreBackupPayload(repo: Repo, payload: BackupFilePayload): Promise<void> {
  await repo.replaceAllDataFromBackup(payload.data);
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
