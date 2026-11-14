import type { SQLiteDatabase } from 'expo-sqlite';
import {
  assertValidAccountInput,
  assertValidCategoryInput,
  assertValidNewDueEntry,
  assertValidNewTransaction,
  assertValidNewTransfer,
  assertValidPersonInput,
  isValidBudgetAmount,
  isValidCurrency,
} from '@/domain/validation';
import {
  normalizeAccentTheme,
  normalizeAppLanguage,
  normalizeAvatarColorKey,
  normalizeHomeSections,
  normalizeReminderSettings,
  normalizeWeekStartDay,
  type Account,
  type AccountKind,
  type AccountPatch,
  type Budget,
  type Category,
  type CurrencyCode,
  type DayReviewRecord,
  type DueEntry,
  type DueEntryPatch,
  type DueKind,
  type LocalDate,
  type NewAccount,
  type NewDueEntry,
  type NewPerson,
  type NewTransaction,
  type NewTransfer,
  type Person,
  type PersonHonorific,
  type PersonPatch,
  type Settings,
  type Transaction,
  type TransactionPatch,
  type TransactionSource,
  type TransactionType,
  type Transfer,
  type TransferPatch,
  type TxPage,
  type TxQuery,
  type TxQuerySummary,
  type TxSearchResult,
} from '@/domain/types';
import { normalizeCategoryColorKey } from '@/theme/categoryColors';
import { seedDefaultCategoriesSqlite } from './migrations';
import { DEFAULT_SETTINGS, type BackupDataSnapshot, type Repo } from './repo';

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  category_id: string | null;
  account_id: string | null;
  transfer_id: string | null;
  description: string;
  note: string;
  occurred_on: string;
  occurred_time: string | null;
  source: TransactionSource;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface AccountRow {
  id: string;
  name: string;
  kind: AccountKind;
  provider: string | null;
  color_key: string;
  monogram: string | null;
  last4: string | null;
  opening_balance_minor: number;
  opening_date: string;
  include_in_total: number;
  sort_order: number;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

interface TransferRow {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: number;
  fee_minor: number;
  occurred_on: string;
  occurred_time: string | null;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface PersonRow {
  id: string;
  name: string;
  color_key: string;
  honorific: PersonHonorific | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

interface DueEntryRow {
  id: string;
  person_id: string;
  kind: DueKind;
  amount_minor: number;
  account_id: string | null;
  occurred_on: string;
  occurred_time: string | null;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color_key: string | null;
  kind: 'expense' | 'income';
  sort_order: number;
  is_selected: number;
  archived_at: number | null;
  created_at: number;
}

interface BudgetRow {
  period_start: string;
  category_id: string;
  amount_minor: number;
  updated_at: number;
}

const SETTING_DB_KEYS: Record<keyof Settings, string> = {
  onboardingDone: 'onboarding_done',
  name: 'name',
  avatarColorKey: 'avatar_color_key',
  currency: 'currency',
  language: 'language',
  monthStartDay: 'month_start_day',
  theme: 'theme',
  accent: 'theme_accent',
  reminder: 'reminder',
  hideAmountsOnOpen: 'hide_amounts_on_open',
  showPoisha: 'show_poisha',
  compactNumbers: 'compact_numbers',
  weekStartsOn: 'week_starts_on',
  homeSections: 'home_sections',
  appLockEnabled: 'app_lock_enabled',
  appLockTimeoutSec: 'app_lock_timeout_sec',
  sampleDataLoaded: 'sample_data_loaded',
  notificationPermissionDenied: 'notification_permission_denied',
  lastBackupAt: 'last_backup_at',
  speechDisclosureAccepted: 'speech_disclosure_accepted',
  lastUsedAccountId: 'last_used_account_id',
};

const BUDGET_SEEDED_KEY = '_budget_periods_seeded';

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    currency: row.currency,
    categoryId: row.category_id,
    accountId: row.account_id ?? null,
    transferId: row.transfer_id ?? null,
    description: row.description,
    note: row.note,
    occurredOn: row.occurred_on,
    occurredTime: row.occurred_time,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapAccountRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    provider: row.provider,
    colorKey: row.color_key,
    monogram: row.monogram,
    last4: row.last4,
    openingBalanceMinor: row.opening_balance_minor,
    openingDate: row.opening_date,
    includeInTotal: row.include_in_total === 1,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransferRow(row: TransferRow): Transfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    amountMinor: row.amount_minor,
    feeMinor: row.fee_minor,
    occurredOn: row.occurred_on,
    occurredTime: row.occurred_time,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapPersonRow(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    colorKey: normalizeCategoryColorKey(row.color_key),
    honorific: row.honorific ?? 'none',
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDueEntryRow(row: DueEntryRow): DueEntry {
  return {
    id: row.id,
    personId: row.person_id,
    kind: row.kind,
    amountMinor: row.amount_minor,
    accountId: row.account_id ?? null,
    occurredOn: row.occurred_on,
    occurredTime: row.occurred_time,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    colorKey: normalizeCategoryColorKey(row.color_key),
    kind: row.kind,
    sortOrder: row.sort_order,
    isSelected: row.is_selected === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

function mapBudgetRow(row: BudgetRow): Budget {
  return {
    periodStart: row.period_start,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    updatedAt: row.updated_at,
  };
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function parseCursor(cursor?: string): { occurredOn: string; createdAt: number; id: string } | null {
  if (!cursor) return null;
  const firstSep = cursor.indexOf('|');
  const secondSep = firstSep === -1 ? -1 : cursor.indexOf('|', firstSep + 1);
  if (firstSep === -1 || secondSep === -1) return null;
  const occurredOn = cursor.slice(0, firstSep);
  const createdAt = Number.parseInt(cursor.slice(firstSep + 1, secondSep), 10);
  const id = cursor.slice(secondSep + 1);
  if (!occurredOn || !Number.isFinite(createdAt) || !id) return null;
  return { occurredOn, createdAt, id };
}

export class SqliteRepo implements Repo {
  constructor(private readonly db: SQLiteDatabase) {}

  async insertTransaction(t: NewTransaction): Promise<void> {
    assertValidNewTransaction(t);
    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR IGNORE INTO transactions
       (id, type, amount_minor, currency, category_id, account_id, transfer_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        t.id,
        t.type,
        t.amountMinor,
        t.currency,
        t.categoryId ?? null,
        t.accountId ?? null,
        t.transferId ?? null,
        t.description ?? '',
        t.note ?? '',
        t.occurredOn,
        t.occurredTime ?? null,
        t.source ?? 'manual',
        t.createdAt ?? now,
        t.updatedAt ?? now,
      ]
    );
  }

  async insertTransactionsBatch(txs: NewTransaction[]): Promise<void> {
    if (txs.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      const now = Date.now();
      for (const t of txs) {
        assertValidNewTransaction(t);
        await this.db.runAsync(
          `INSERT OR IGNORE INTO transactions
           (id, type, amount_minor, currency, category_id, account_id, transfer_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            t.id,
            t.type,
            t.amountMinor,
            t.currency,
            t.categoryId ?? null,
            t.accountId ?? null,
            t.transferId ?? null,
            t.description ?? '',
            t.note ?? '',
            t.occurredOn,
            t.occurredTime ?? null,
            t.source ?? 'manual',
            t.createdAt ?? now,
            t.updatedAt ?? now,
          ]
        );
      }
    });
  }

  async clearSampleTransactions(): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions WHERE source = 'sample'`);
  }

  async updateTransaction(id: string, patch: TransactionPatch): Promise<void> {
    const existing = await this.getTransaction(id);
    if (!existing) return;
    const merged: Transaction = {
      ...existing,
      ...patch,
      accountId: patch.accountId !== undefined ? patch.accountId : existing.accountId,
      updatedAt: Date.now(),
    };
    assertValidNewTransaction(merged);
    await this.db.runAsync(
      `UPDATE transactions
       SET type = ?, amount_minor = ?, category_id = ?, account_id = ?, description = ?, note = ?, occurred_on = ?, occurred_time = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.type,
        merged.amountMinor,
        merged.categoryId ?? null,
        merged.accountId ?? null,
        merged.description,
        merged.note,
        merged.occurredOn,
        merged.occurredTime ?? null,
        merged.updatedAt,
        id,
      ]
    );
  }

  async softDeleteTransaction(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id]
    );
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const row = await this.db.getFirstAsync<TransactionRow>(
      `SELECT * FROM transactions WHERE id = ?`,
      [id]
    );
    return row ? mapTransactionRow(row) : null;
  }

  async listTransactionsInRange(fromIncl: LocalDate, toExcl: LocalDate): Promise<Transaction[]> {
    const rows = await this.db.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions
       WHERE deleted_at IS NULL AND occurred_on >= ? AND occurred_on < ?
       ORDER BY occurred_on DESC, created_at DESC, id DESC`,
      [fromIncl, toExcl]
    );
    return rows.map(mapTransactionRow);
  }

  async listAllTransactionsForBackup(): Promise<Transaction[]> {
    const rows = await this.db.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions ORDER BY created_at ASC, id ASC`
    );
    return rows.map(mapTransactionRow);
  }

  async listAllActiveTransactions(): Promise<Transaction[]> {
    const rows = await this.db.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions
       WHERE deleted_at IS NULL
       ORDER BY occurred_on DESC, created_at DESC, id DESC`
    );
    return rows.map(mapTransactionRow);
  }

  async listTransactionsByAccount(
    accountId: string | null,
    opts?: { fromIncl?: LocalDate; toExcl?: LocalDate }
  ): Promise<Transaction[]> {
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (accountId === null) {
      clauses.push('account_id IS NULL');
    } else {
      clauses.push('account_id = ?');
      params.push(accountId);
    }
    if (opts?.fromIncl) {
      clauses.push('occurred_on >= ?');
      params.push(opts.fromIncl);
    }
    if (opts?.toExcl) {
      clauses.push('occurred_on < ?');
      params.push(opts.toExcl);
    }
    const rows = await this.db.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions
       WHERE ${clauses.join(' AND ')}
       ORDER BY occurred_on DESC, created_at DESC, id DESC`,
      params
    );
    return rows.map(mapTransactionRow);
  }

  private buildSearchFilter(q: TxQuery): { clauses: string[]; params: (string | number)[] } {
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (q.type) {
      clauses.push('type = ?');
      params.push(q.type);
    }
    if (q.categoryIds && q.categoryIds.length > 0) {
      const placeholders = q.categoryIds.map(() => '?').join(', ');
      clauses.push(`category_id IN (${placeholders})`);
      params.push(...q.categoryIds);
    } else if (q.categoryId !== undefined) {
      clauses.push('category_id = ?');
      params.push(q.categoryId);
    }
    if (q.accountIds && q.accountIds.length > 0) {
      const placeholders = q.accountIds.map(() => '?').join(', ');
      clauses.push(`account_id IN (${placeholders})`);
      params.push(...q.accountIds);
    } else if (q.accountId === null) {
      clauses.push('account_id IS NULL');
    } else if (q.accountId !== undefined) {
      clauses.push('account_id = ?');
      params.push(q.accountId);
    }
    if (q.fromIncl) {
      clauses.push('occurred_on >= ?');
      params.push(q.fromIncl);
    }
    if (q.toExcl) {
      clauses.push('occurred_on < ?');
      params.push(q.toExcl);
    }
    if (q.minAmountMinor !== undefined) {
      clauses.push('amount_minor >= ?');
      params.push(q.minAmountMinor);
    }
    if (q.maxAmountMinor !== undefined) {
      clauses.push('amount_minor <= ?');
      params.push(q.maxAmountMinor);
    }
    const searchNorm = q.search?.trim();
    if (searchNorm) {
      const pattern = `%${escapeLike(searchNorm.toLowerCase())}%`;
      clauses.push("(LOWER(description) LIKE ? ESCAPE '\\' OR LOWER(note) LIKE ? ESCAPE '\\')");
      params.push(pattern, pattern);
    }

    return { clauses, params };
  }

  async searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult> {
    const { clauses, params } = this.buildSearchFilter(q);

    const cursorKey = parseCursor(page.cursor);
    if (cursorKey) {
      clauses.push(
        '(occurred_on < ? OR (occurred_on = ? AND created_at < ?) OR (occurred_on = ? AND created_at = ? AND id < ?))'
      );
      params.push(
        cursorKey.occurredOn,
        cursorKey.occurredOn,
        cursorKey.createdAt,
        cursorKey.occurredOn,
        cursorKey.createdAt,
        cursorKey.id
      );
    }

    const limit = Math.max(1, page.limit);
    params.push(limit + 1);

    const rows = await this.db.getAllAsync<TransactionRow>(
      `SELECT * FROM transactions
       WHERE ${clauses.join(' AND ')}
       ORDER BY occurred_on DESC, created_at DESC, id DESC
       LIMIT ?`,
      params
    );

    const hasMore = rows.length > limit;
    const sliced = rows.slice(0, limit).map(mapTransactionRow);
    const last = sliced[sliced.length - 1];
    const next = hasMore && last ? `${last.occurredOn}|${last.createdAt}|${last.id}` : undefined;
    return { rows: sliced, next };
  }

  async summarizeTransactions(q: TxQuery, currency: CurrencyCode): Promise<TxQuerySummary> {
    const { clauses, params } = this.buildSearchFilter(q);
    const row = await this.db.getFirstAsync<{
      count: number;
      expenseMinor: number | null;
      incomeMinor: number | null;
    }>(
      `SELECT
         COUNT(1) AS count,
         COALESCE(SUM(CASE WHEN type = 'expense' AND currency = ? THEN amount_minor ELSE 0 END), 0) AS expenseMinor,
         COALESCE(SUM(CASE WHEN type = 'income' AND currency = ? THEN amount_minor ELSE 0 END), 0) AS incomeMinor
       FROM transactions
       WHERE ${clauses.join(' AND ')}`,
      [currency, currency, ...params]
    );
    return {
      count: row?.count ?? 0,
      expenseMinor: row?.expenseMinor ?? 0,
      incomeMinor: row?.incomeMinor ?? 0,
    };
  }

  async hasAnyTransactions(): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(1) AS cnt FROM transactions WHERE deleted_at IS NULL`
    );
    return (row?.cnt ?? 0) > 0;
  }

  async listRecentDescriptions(limit: number = 8): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ description: string }>(
      `SELECT description FROM transactions
       WHERE deleted_at IS NULL AND TRIM(description) <> ''
       ORDER BY occurred_on DESC, created_at DESC`
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      const trimmed = r.description.trim();
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= limit) break;
    }
    return out;
  }

  private async readCurrencySetting(): Promise<CurrencyCode> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [SETTING_DB_KEYS.currency]
    );
    if (!row) return DEFAULT_SETTINGS.currency;
    try {
      const parsed: unknown = JSON.parse(row.value);
      return isValidCurrency(parsed) ? parsed : DEFAULT_SETTINGS.currency;
    } catch {
      return DEFAULT_SETTINGS.currency;
    }
  }

  async listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]> {
    const includeArchived = opts?.includeArchived ?? false;
    const sql = includeArchived
      ? `SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC, name ASC`
      : `SELECT * FROM accounts WHERE archived_at IS NULL ORDER BY sort_order ASC, created_at ASC, name ASC`;
    const rows = await this.db.getAllAsync<AccountRow>(sql);
    return rows.map(mapAccountRow);
  }

  async getAccount(id: string): Promise<Account | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      `SELECT * FROM accounts WHERE id = ?`,
      [id]
    );
    return row ? mapAccountRow(row) : null;
  }

  async insertAccount(a: NewAccount): Promise<void> {
    assertValidAccountInput(a);
    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR IGNORE INTO accounts
       (id, name, kind, provider, color_key, monogram, last4, opening_balance_minor, opening_date, include_in_total, sort_order, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.name.trim(),
        a.kind,
        a.provider ?? null,
        a.colorKey.trim(),
        a.monogram !== undefined && a.monogram !== null ? a.monogram.trim() || null : null,
        a.last4 ?? null,
        a.openingBalanceMinor ?? 0,
        a.openingDate,
        (a.includeInTotal ?? true) ? 1 : 0,
        a.sortOrder ?? 0,
        a.archivedAt ?? null,
        a.createdAt ?? now,
        a.updatedAt ?? now,
      ]
    );
  }

  async updateAccount(id: string, patch: AccountPatch): Promise<void> {
    const existing = await this.getAccount(id);
    if (!existing) return;
    const merged: Account = {
      ...existing,
      ...patch,
      name: (patch.name ?? existing.name).trim(),
      colorKey: (patch.colorKey ?? existing.colorKey).trim(),
      monogram:
        patch.monogram !== undefined
          ? patch.monogram !== null
            ? patch.monogram.trim() || null
            : null
          : existing.monogram,
      updatedAt: Date.now(),
    };
    assertValidAccountInput(merged);
    await this.db.runAsync(
      `UPDATE accounts
       SET name = ?, kind = ?, provider = ?, color_key = ?, monogram = ?, last4 = ?, opening_balance_minor = ?, opening_date = ?, include_in_total = ?, sort_order = ?, archived_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.name,
        merged.kind,
        merged.provider,
        merged.colorKey,
        merged.monogram,
        merged.last4,
        merged.openingBalanceMinor,
        merged.openingDate,
        merged.includeInTotal ? 1 : 0,
        merged.sortOrder,
        merged.archivedAt,
        merged.updatedAt,
        id,
      ]
    );
  }

  async archiveAccount(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE accounts SET archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
  }

  async unarchiveAccount(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE accounts SET archived_at = NULL, updated_at = ? WHERE id = ?`,
      [now, id]
    );
  }

  async createTransfer(t: NewTransfer): Promise<void> {
    assertValidNewTransfer(t);
    const existing = await this.getTransfer(t.id);
    if (existing) return;

    const feeMinor = t.feeMinor ?? 0;
    const feeCurrency = feeMinor > 0 ? (t.currency ?? (await this.readCurrencySetting())) : DEFAULT_SETTINGS.currency;
    const now = Date.now();
    const createdAt = t.createdAt ?? now;
    const updatedAt = t.updatedAt ?? now;
    const occurredTime = t.occurredTime ?? null;
    const note = t.note ?? '';

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO transfers
         (id, from_account_id, to_account_id, amount_minor, fee_minor, occurred_on, occurred_time, note, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          t.id,
          t.fromAccountId,
          t.toAccountId,
          t.amountMinor,
          feeMinor,
          t.occurredOn,
          occurredTime,
          note,
          createdAt,
          updatedAt,
        ]
      );

      if (feeMinor > 0) {
        const feeTxId = `${t.id}:fee`;
        assertValidNewTransaction({
          id: feeTxId,
          type: 'expense',
          amountMinor: feeMinor,
          currency: feeCurrency,
          categoryId: 'fees',
          accountId: t.fromAccountId,
          transferId: t.id,
          description: 'Transfer fee',
          note: '',
          occurredOn: t.occurredOn,
          occurredTime,
          source: 'manual',
          createdAt,
          updatedAt,
        });
        await this.db.runAsync(
          `INSERT INTO transactions
           (id, type, amount_minor, currency, category_id, account_id, transfer_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
           VALUES (?, 'expense', ?, ?, 'fees', ?, ?, 'Transfer fee', '', ?, ?, 'manual', ?, ?, NULL)`,
          [
            feeTxId,
            feeMinor,
            feeCurrency,
            t.fromAccountId,
            t.id,
            t.occurredOn,
            occurredTime,
            createdAt,
            updatedAt,
          ]
        );
      }
    });
  }

  async updateTransfer(id: string, patch: TransferPatch): Promise<void> {
    const existing = await this.getTransfer(id);
    if (!existing || existing.deletedAt != null) return;

    const now = Date.now();
    const merged: Transfer = {
      ...existing,
      ...patch,
      feeMinor: patch.feeMinor ?? existing.feeMinor,
      occurredTime: patch.occurredTime !== undefined ? patch.occurredTime : existing.occurredTime,
      note: patch.note !== undefined ? patch.note : existing.note,
      updatedAt: now,
    };
    assertValidNewTransfer(merged);

    const fallbackCurrency = merged.feeMinor > 0 ? await this.readCurrencySetting() : DEFAULT_SETTINGS.currency;

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE transfers
         SET from_account_id = ?, to_account_id = ?, amount_minor = ?, fee_minor = ?, occurred_on = ?, occurred_time = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        [
          merged.fromAccountId,
          merged.toAccountId,
          merged.amountMinor,
          merged.feeMinor,
          merged.occurredOn,
          merged.occurredTime,
          merged.note,
          now,
          id,
        ]
      );

      const linkedFees = await this.db.getAllAsync<TransactionRow>(
        `SELECT * FROM transactions
         WHERE transfer_id = ?
         ORDER BY CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC, created_at ASC`,
        [id]
      );

      if (merged.feeMinor === 0) {
        await this.db.runAsync(
          `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE transfer_id = ? AND deleted_at IS NULL`,
          [now, now, id]
        );
      } else if (linkedFees.length > 0) {
        const primary = linkedFees[0];
        await this.db.runAsync(
          `UPDATE transactions
           SET type = 'expense', amount_minor = ?, category_id = 'fees', account_id = ?, occurred_on = ?, occurred_time = ?, deleted_at = NULL, updated_at = ?
           WHERE id = ?`,
          [
            merged.feeMinor,
            merged.fromAccountId,
            merged.occurredOn,
            merged.occurredTime,
            now,
            primary.id,
          ]
        );
      } else {
        const feeTxId = `${id}:fee`;
        assertValidNewTransaction({
          id: feeTxId,
          type: 'expense',
          amountMinor: merged.feeMinor,
          currency: fallbackCurrency,
          categoryId: 'fees',
          accountId: merged.fromAccountId,
          transferId: id,
          description: 'Transfer fee',
          note: '',
          occurredOn: merged.occurredOn,
          occurredTime: merged.occurredTime,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
        });
        await this.db.runAsync(
          `INSERT INTO transactions
           (id, type, amount_minor, currency, category_id, account_id, transfer_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
           VALUES (?, 'expense', ?, ?, 'fees', ?, ?, 'Transfer fee', '', ?, ?, 'manual', ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET
             type = 'expense',
             amount_minor = excluded.amount_minor,
             currency = excluded.currency,
             category_id = 'fees',
             account_id = excluded.account_id,
             transfer_id = excluded.transfer_id,
             occurred_on = excluded.occurred_on,
             occurred_time = excluded.occurred_time,
             deleted_at = NULL,
             updated_at = excluded.updated_at`,
          [
            feeTxId,
            merged.feeMinor,
            fallbackCurrency,
            merged.fromAccountId,
            id,
            merged.occurredOn,
            merged.occurredTime,
            now,
            now,
          ]
        );
      }
    });
  }

  async softDeleteTransfer(id: string): Promise<void> {
    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE transfers SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id]
      );
      await this.db.runAsync(
        `UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE transfer_id = ? AND deleted_at IS NULL`,
        [now, now, id]
      );
    });
  }

  async getTransfer(id: string): Promise<Transfer | null> {
    const row = await this.db.getFirstAsync<TransferRow>(
      `SELECT * FROM transfers WHERE id = ?`,
      [id]
    );
    return row ? mapTransferRow(row) : null;
  }

  async listTransfers(opts?: {
    accountId?: string;
    fromIncl?: LocalDate;
    toExcl?: LocalDate;
    includeDeleted?: boolean;
  }): Promise<Transfer[]> {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (!opts?.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (opts?.accountId) {
      clauses.push('(from_account_id = ? OR to_account_id = ?)');
      params.push(opts.accountId, opts.accountId);
    }
    if (opts?.fromIncl) {
      clauses.push('occurred_on >= ?');
      params.push(opts.fromIncl);
    }
    if (opts?.toExcl) {
      clauses.push('occurred_on < ?');
      params.push(opts.toExcl);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.getAllAsync<TransferRow>(
      `SELECT * FROM transfers ${whereSql} ORDER BY occurred_on DESC, created_at DESC, id DESC`,
      params
    );
    return rows.map(mapTransferRow);
  }

  async listAllTransfersForBackup(): Promise<Transfer[]> {
    const rows = await this.db.getAllAsync<TransferRow>(
      `SELECT * FROM transfers ORDER BY created_at ASC, id ASC`
    );
    return rows.map(mapTransferRow);
  }

  async listPeople(opts?: { includeArchived?: boolean }): Promise<Person[]> {
    const includeArchived = opts?.includeArchived ?? false;
    const rows = await this.db.getAllAsync<PersonRow>(
      includeArchived
        ? `SELECT * FROM people ORDER BY created_at ASC, name COLLATE NOCASE ASC`
        : `SELECT * FROM people WHERE archived_at IS NULL ORDER BY created_at ASC, name COLLATE NOCASE ASC`
    );
    return rows.map(mapPersonRow);
  }

  async getPerson(id: string): Promise<Person | null> {
    const row = await this.db.getFirstAsync<PersonRow>(
      `SELECT * FROM people WHERE id = ?`,
      [id]
    );
    return row ? mapPersonRow(row) : null;
  }

  async insertPerson(p: NewPerson): Promise<void> {
    const honorific = p.honorific ?? 'none';
    const colorKey = normalizeCategoryColorKey(p.colorKey);
    assertValidPersonInput({
      id: p.id,
      name: p.name,
      colorKey,
      honorific,
    });
    const now = Date.now();
    await this.db.runAsync(
      `INSERT INTO people (id, name, color_key, honorific, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name.trim(),
        colorKey,
        honorific,
        p.archivedAt ?? null,
        p.createdAt ?? now,
        p.updatedAt ?? now,
      ]
    );
  }

  async updatePerson(id: string, patch: PersonPatch): Promise<void> {
    const existing = await this.getPerson(id);
    if (!existing) return;
    const nextColor = patch.colorKey !== undefined ? normalizeCategoryColorKey(patch.colorKey) : existing.colorKey;
    const merged: Person = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      colorKey: nextColor,
      honorific: patch.honorific !== undefined ? patch.honorific : existing.honorific,
      archivedAt: patch.archivedAt !== undefined ? patch.archivedAt : existing.archivedAt,
      updatedAt: Date.now(),
    };
    assertValidPersonInput(merged);
    await this.db.runAsync(
      `UPDATE people SET name = ?, color_key = ?, honorific = ?, archived_at = ?, updated_at = ? WHERE id = ?`,
      [merged.name, merged.colorKey, merged.honorific, merged.archivedAt, merged.updatedAt, id]
    );
  }

  async archivePerson(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE people SET archived_at = COALESCE(archived_at, ?), updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
  }

  async unarchivePerson(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE people SET archived_at = NULL, updated_at = ? WHERE id = ?`,
      [now, id]
    );
  }

  async listDueEntries(opts?: {
    personId?: string;
    accountId?: string;
    includeDeleted?: boolean;
  }): Promise<DueEntry[]> {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (!opts?.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (opts?.personId) {
      clauses.push('person_id = ?');
      params.push(opts.personId);
    }
    if (opts?.accountId) {
      clauses.push('account_id = ?');
      params.push(opts.accountId);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.db.getAllAsync<DueEntryRow>(
      `SELECT * FROM due_entries ${whereSql} ORDER BY occurred_on DESC, created_at DESC, id DESC`,
      params
    );
    return rows.map(mapDueEntryRow);
  }

  async getDueEntry(id: string): Promise<DueEntry | null> {
    const row = await this.db.getFirstAsync<DueEntryRow>(
      `SELECT * FROM due_entries WHERE id = ?`,
      [id]
    );
    return row ? mapDueEntryRow(row) : null;
  }

  async insertDueEntry(d: NewDueEntry): Promise<void> {
    assertValidNewDueEntry(d);
    const now = Date.now();
    await this.db.runAsync(
      `INSERT INTO due_entries
       (id, person_id, kind, amount_minor, account_id, occurred_on, occurred_time, note, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        d.id,
        d.personId,
        d.kind,
        d.amountMinor,
        d.accountId ?? null,
        d.occurredOn,
        d.occurredTime ?? null,
        d.note ?? '',
        d.createdAt ?? now,
        d.updatedAt ?? now,
      ]
    );
  }

  async updateDueEntry(id: string, patch: DueEntryPatch): Promise<void> {
    const existing = await this.getDueEntry(id);
    if (!existing || existing.deletedAt != null) return;
    const merged: DueEntry = {
      ...existing,
      personId: patch.personId !== undefined ? patch.personId : existing.personId,
      kind: patch.kind !== undefined ? patch.kind : existing.kind,
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : existing.amountMinor,
      accountId: patch.accountId !== undefined ? patch.accountId : existing.accountId,
      occurredOn: patch.occurredOn !== undefined ? patch.occurredOn : existing.occurredOn,
      occurredTime: patch.occurredTime !== undefined ? patch.occurredTime : existing.occurredTime,
      note: patch.note !== undefined ? patch.note : existing.note,
      updatedAt: Date.now(),
    };
    assertValidNewDueEntry(merged);
    await this.db.runAsync(
      `UPDATE due_entries
       SET person_id = ?, kind = ?, amount_minor = ?, account_id = ?, occurred_on = ?, occurred_time = ?, note = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        merged.personId,
        merged.kind,
        merged.amountMinor,
        merged.accountId,
        merged.occurredOn,
        merged.occurredTime,
        merged.note,
        merged.updatedAt,
        id,
      ]
    );
  }

  async softDeleteDueEntry(id: string): Promise<void> {
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE due_entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id]
    );
  }

  async listAllDueEntriesForBackup(): Promise<DueEntry[]> {
    const rows = await this.db.getAllAsync<DueEntryRow>(
      `SELECT * FROM due_entries ORDER BY created_at ASC, id ASC`
    );
    return rows.map(mapDueEntryRow);
  }

  async listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]> {
    const includeArchived = opts?.includeArchived ?? false;
    const sql = includeArchived
      ? `SELECT * FROM categories ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order ASC, name ASC`;
    const rows = await this.db.getAllAsync<CategoryRow>(sql);
    return rows.map(mapCategoryRow);
  }

  async upsertCategory(c: Category): Promise<void> {
    assertValidCategoryInput(c);
    const colorKey = normalizeCategoryColorKey(c.colorKey);
    await this.db.runAsync(
      `INSERT INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         color_key = excluded.color_key,
         kind = excluded.kind,
         sort_order = excluded.sort_order,
         is_selected = excluded.is_selected,
         archived_at = excluded.archived_at`,
      [
        c.id,
        c.name,
        c.icon,
        colorKey,
        c.kind,
        c.sortOrder,
        c.isSelected ? 1 : 0,
        c.archivedAt,
        c.createdAt,
      ]
    );
  }

  async archiveCategory(id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE categories SET archived_at = COALESCE(archived_at, ?) WHERE id = ?`,
      [Date.now(), id]
    );
  }

  async getBudgets(periodStart: LocalDate): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetRow>(
      `SELECT * FROM budgets WHERE period_start = ?`,
      [periodStart]
    );
    return rows.map(mapBudgetRow);
  }

  async getAllBudgets(): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetRow>(
      `SELECT * FROM budgets ORDER BY period_start DESC`
    );
    return rows.map(mapBudgetRow);
  }

  async setBudget(periodStart: LocalDate, categoryId: string, amountMinor: number): Promise<void> {
    if (!isValidBudgetAmount(amountMinor)) {
      throw new Error(`Invalid budget amount: ${amountMinor}`);
    }
    await this.db.runAsync(
      `INSERT INTO budgets (period_start, category_id, amount_minor, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(period_start, category_id) DO UPDATE SET
         amount_minor = excluded.amount_minor,
         updated_at = excluded.updated_at`,
      [periodStart, categoryId, amountMinor, Date.now()]
    );
  }

  async deleteBudget(periodStart: LocalDate, categoryId: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM budgets WHERE period_start = ? AND category_id = ?`,
      [periodStart, categoryId]
    );
  }

  async ensureBudgetsForPeriod(
    periodStart: LocalDate,
    previousPeriodStart: LocalDate
  ): Promise<void> {
    const seededRow = await this.db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [BUDGET_SEEDED_KEY]
    );
    let seededPeriods: string[] = [];
    if (seededRow) {
      try {
        const parsed: unknown = JSON.parse(seededRow.value);
        if (Array.isArray(parsed)) {
          seededPeriods = parsed.filter((item): item is string => typeof item === 'string');
        }
      } catch {
        // S8: tolerate malformed settings JSON and fall back cleanly.
        seededPeriods = [];
      }
    }
    const seededSet = new Set<string>(seededPeriods);
    if (seededSet.has(periodStart)) return;

    const existing = await this.getBudgets(periodStart);
    if (existing.length > 0) {
      seededSet.add(periodStart);
      await this.db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [BUDGET_SEEDED_KEY, JSON.stringify(Array.from(seededSet))]
      );
      return;
    }

    const prev = await this.getBudgets(previousPeriodStart);
    if (prev.length === 0) return;

    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      for (const b of prev) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO budgets (period_start, category_id, amount_minor, updated_at)
           VALUES (?, ?, ?, ?)`,
          [periodStart, b.categoryId, b.amountMinor, now]
        );
      }
      seededSet.add(periodStart);
      await this.db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [BUDGET_SEEDED_KEY, JSON.stringify(Array.from(seededSet))]
      );
    });
  }

  async getSettings(): Promise<Settings> {
    const rows = await this.db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings`
    );
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const parseJson = <T>(dbKey: string, fallback: T): T => {
      const raw = map.get(dbKey);
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    return {
      onboardingDone: parseJson(SETTING_DB_KEYS.onboardingDone, DEFAULT_SETTINGS.onboardingDone),
      name: parseJson(SETTING_DB_KEYS.name, DEFAULT_SETTINGS.name),
      avatarColorKey: normalizeAvatarColorKey(
        parseJson<unknown>(SETTING_DB_KEYS.avatarColorKey, DEFAULT_SETTINGS.avatarColorKey),
        DEFAULT_SETTINGS.avatarColorKey
      ),
      currency: parseJson(SETTING_DB_KEYS.currency, DEFAULT_SETTINGS.currency),
      language: normalizeAppLanguage(
        parseJson<unknown>(SETTING_DB_KEYS.language, DEFAULT_SETTINGS.language),
        DEFAULT_SETTINGS.language
      ),
      monthStartDay: parseJson(SETTING_DB_KEYS.monthStartDay, DEFAULT_SETTINGS.monthStartDay),
      theme: parseJson(SETTING_DB_KEYS.theme, DEFAULT_SETTINGS.theme),
      accent: normalizeAccentTheme(
        parseJson<unknown>(SETTING_DB_KEYS.accent, DEFAULT_SETTINGS.accent),
        DEFAULT_SETTINGS.accent
      ),
      reminder: normalizeReminderSettings(
        parseJson<unknown>(SETTING_DB_KEYS.reminder, DEFAULT_SETTINGS.reminder),
        DEFAULT_SETTINGS.reminder
      ),
      hideAmountsOnOpen: Boolean(
        parseJson(SETTING_DB_KEYS.hideAmountsOnOpen, DEFAULT_SETTINGS.hideAmountsOnOpen)
      ),
      showPoisha: Boolean(parseJson(SETTING_DB_KEYS.showPoisha, DEFAULT_SETTINGS.showPoisha)),
      compactNumbers: Boolean(
        parseJson(SETTING_DB_KEYS.compactNumbers, DEFAULT_SETTINGS.compactNumbers)
      ),
      weekStartsOn: normalizeWeekStartDay(
        parseJson<unknown>(SETTING_DB_KEYS.weekStartsOn, DEFAULT_SETTINGS.weekStartsOn),
        DEFAULT_SETTINGS.weekStartsOn
      ),
      homeSections: normalizeHomeSections(
        parseJson<unknown>(SETTING_DB_KEYS.homeSections, DEFAULT_SETTINGS.homeSections)
      ),
      appLockEnabled: Boolean(
        parseJson(SETTING_DB_KEYS.appLockEnabled, DEFAULT_SETTINGS.appLockEnabled)
      ),
      appLockTimeoutSec: (() => {
        const parsed = parseJson<unknown>(
          SETTING_DB_KEYS.appLockTimeoutSec,
          DEFAULT_SETTINGS.appLockTimeoutSec
        );
        return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 0
          ? parsed
          : DEFAULT_SETTINGS.appLockTimeoutSec;
      })(),
      sampleDataLoaded: parseJson(SETTING_DB_KEYS.sampleDataLoaded, DEFAULT_SETTINGS.sampleDataLoaded),
      notificationPermissionDenied: parseJson(
        SETTING_DB_KEYS.notificationPermissionDenied,
        DEFAULT_SETTINGS.notificationPermissionDenied
      ),
      lastBackupAt: parseJson(SETTING_DB_KEYS.lastBackupAt, DEFAULT_SETTINGS.lastBackupAt),
      speechDisclosureAccepted: parseJson(
        SETTING_DB_KEYS.speechDisclosureAccepted,
        DEFAULT_SETTINGS.speechDisclosureAccepted
      ),
      lastUsedAccountId: parseJson(
        SETTING_DB_KEYS.lastUsedAccountId,
        DEFAULT_SETTINGS.lastUsedAccountId
      ),
    };
  }

  async setSetting<K extends keyof Settings>(k: K, v: Settings[K]): Promise<void> {
    const dbKey = SETTING_DB_KEYS[k];
    await this.db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [dbKey, JSON.stringify(v)]
    );
  }

  async markDayReviewed(day: LocalDate): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO day_reviews (day, reviewed_at) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET reviewed_at = excluded.reviewed_at`,
      [day, Date.now()]
    );
  }

  async isDayReviewed(day: LocalDate): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ day: string }>(
      `SELECT day FROM day_reviews WHERE day = ?`,
      [day]
    );
    return row !== null;
  }

  async listAllDayReviews(): Promise<DayReviewRecord[]> {
    const rows = await this.db.getAllAsync<{ day: string; reviewed_at: number }>(
      `SELECT day, reviewed_at FROM day_reviews ORDER BY day ASC`
    );
    return rows.map((r) => ({ day: r.day, reviewedAt: r.reviewed_at }));
  }

  async deleteAllData(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM due_entries;
        DELETE FROM people;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM accounts;
        DELETE FROM budgets;
        DELETE FROM day_reviews;
        DELETE FROM settings;
        DELETE FROM categories;
      `);
      await seedDefaultCategoriesSqlite(this.db, Date.now());
    });

    // S9: reclaim deleted pages and truncate WAL outside the transaction.
    try {
      await this.db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // Ignore in environments without WAL mode.
    }
    await this.db.execAsync('VACUUM;');
  }

  async replaceAllDataFromBackup(data: BackupDataSnapshot): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM due_entries;
        DELETE FROM people;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM accounts;
        DELETE FROM budgets;
        DELETE FROM day_reviews;
        DELETE FROM settings;
        DELETE FROM categories;
      `);

      for (const cat of data.categories) {
        assertValidCategoryInput(cat);
        const colorKey = normalizeCategoryColorKey(cat.colorKey);
        await this.db.runAsync(
          `INSERT INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.icon,
            colorKey,
            cat.kind,
            cat.sortOrder,
            cat.isSelected ? 1 : 0,
            cat.archivedAt,
            cat.createdAt,
          ]
        );
      }

      for (const acc of data.accounts) {
        assertValidAccountInput(acc);
        await this.db.runAsync(
          `INSERT INTO accounts
           (id, name, kind, provider, color_key, monogram, last4, opening_balance_minor, opening_date, include_in_total, sort_order, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            acc.id,
            acc.name.trim(),
            acc.kind,
            acc.provider ?? null,
            acc.colorKey.trim(),
            acc.monogram ?? null,
            acc.last4 ?? null,
            acc.openingBalanceMinor,
            acc.openingDate,
            acc.includeInTotal ? 1 : 0,
            acc.sortOrder,
            acc.archivedAt,
            acc.createdAt,
            acc.updatedAt,
          ]
        );
      }

      for (const tr of data.transfers) {
        assertValidNewTransfer(tr);
        await this.db.runAsync(
          `INSERT INTO transfers
           (id, from_account_id, to_account_id, amount_minor, fee_minor, occurred_on, occurred_time, note, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tr.id,
            tr.fromAccountId,
            tr.toAccountId,
            tr.amountMinor,
            tr.feeMinor,
            tr.occurredOn,
            tr.occurredTime ?? null,
            tr.note,
            tr.createdAt,
            tr.updatedAt,
            tr.deletedAt,
          ]
        );
      }

      for (const person of data.people) {
        const colorKey = normalizeCategoryColorKey(person.colorKey);
        const honorific = person.honorific ?? 'none';
        assertValidPersonInput({
          id: person.id,
          name: person.name,
          colorKey,
          honorific,
        });
        await this.db.runAsync(
          `INSERT INTO people (id, name, color_key, honorific, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            person.id,
            person.name.trim(),
            colorKey,
            honorific,
            person.archivedAt,
            person.createdAt,
            person.updatedAt,
          ]
        );
      }

      for (const due of data.due_entries) {
        assertValidNewDueEntry(due);
        await this.db.runAsync(
          `INSERT INTO due_entries
           (id, person_id, kind, amount_minor, account_id, occurred_on, occurred_time, note, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            due.id,
            due.personId,
            due.kind,
            due.amountMinor,
            due.accountId ?? null,
            due.occurredOn,
            due.occurredTime ?? null,
            due.note,
            due.createdAt,
            due.updatedAt,
            due.deletedAt,
          ]
        );
      }

      for (const tx of data.transactions) {
        assertValidNewTransaction(tx);
        await this.db.runAsync(
          `INSERT INTO transactions
           (id, type, amount_minor, currency, category_id, account_id, transfer_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id,
            tx.type,
            tx.amountMinor,
            tx.currency,
            tx.categoryId ?? null,
            tx.accountId ?? null,
            tx.transferId ?? null,
            tx.description,
            tx.note,
            tx.occurredOn,
            tx.occurredTime ?? null,
            tx.source,
            tx.createdAt,
            tx.updatedAt,
            tx.deletedAt,
          ]
        );
      }

      for (const b of data.budgets) {
        if (!isValidBudgetAmount(b.amountMinor)) {
          throw new Error(`Invalid budget amount: ${b.amountMinor}`);
        }
        await this.db.runAsync(
          `INSERT INTO budgets (period_start, category_id, amount_minor, updated_at)
           VALUES (?, ?, ?, ?)`,
          [b.periodStart, b.categoryId, b.amountMinor, b.updatedAt]
        );
      }

      for (const dr of data.day_reviews) {
        await this.db.runAsync(
          `INSERT INTO day_reviews (day, reviewed_at) VALUES (?, ?)`,
          [dr.day, dr.reviewedAt]
        );
      }

      const keys = Object.keys(SETTING_DB_KEYS) as (keyof Settings)[];
      for (const key of keys) {
        const dbKey = SETTING_DB_KEYS[key];
        await this.db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)`,
          [dbKey, JSON.stringify(data.settings[key])]
        );
      }
    });
  }
}
