import type { SQLiteDatabase } from 'expo-sqlite';
import { assertValidNewTransaction, isValidBudgetAmount } from '@/domain/validation';
import type {
  Budget,
  Category,
  CurrencyCode,
  LocalDate,
  NewTransaction,
  Settings,
  Transaction,
  TransactionPatch,
  TransactionSource,
  TransactionType,
  TxPage,
  TxQuery,
  TxSearchResult,
} from '@/domain/types';
import { seedDefaultCategoriesSqlite } from './migrations';
import { DEFAULT_SETTINGS, type Repo } from './repo';

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  category_id: string | null;
  description: string;
  note: string;
  occurred_on: string;
  occurred_time: string | null;
  source: TransactionSource;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
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
  currency: 'currency',
  monthStartDay: 'month_start_day',
  theme: 'theme',
  reminder: 'reminder',
  sampleDataLoaded: 'sample_data_loaded',
  notificationPermissionDenied: 'notification_permission_denied',
};

const BUDGET_SEEDED_KEY = '_budget_periods_seeded';

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    currency: row.currency,
    categoryId: row.category_id,
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

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
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
       (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        t.id,
        t.type,
        t.amountMinor,
        t.currency,
        t.categoryId ?? null,
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
           (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            t.id,
            t.type,
            t.amountMinor,
            t.currency,
            t.categoryId ?? null,
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
      updatedAt: Date.now(),
    };
    assertValidNewTransaction(merged);
    await this.db.runAsync(
      `UPDATE transactions
       SET type = ?, amount_minor = ?, category_id = ?, description = ?, note = ?, occurred_on = ?, occurred_time = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.type,
        merged.amountMinor,
        merged.categoryId ?? null,
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

  async searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult> {
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];

    if (q.type) {
      clauses.push('type = ?');
      params.push(q.type);
    }
    if (q.categoryId !== undefined) {
      clauses.push('category_id = ?');
      params.push(q.categoryId);
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

  async listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]> {
    const includeArchived = opts?.includeArchived ?? false;
    const sql = includeArchived
      ? `SELECT * FROM categories ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order ASC, name ASC`;
    const rows = await this.db.getAllAsync<CategoryRow>(sql);
    return rows.map(mapCategoryRow);
  }

  async upsertCategory(c: Category): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO categories (id, name, icon, kind, sort_order, is_selected, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         kind = excluded.kind,
         sort_order = excluded.sort_order,
         is_selected = excluded.is_selected,
         archived_at = excluded.archived_at`,
      [c.id, c.name, c.icon, c.kind, c.sortOrder, c.isSelected ? 1 : 0, c.archivedAt, c.createdAt]
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
    const seededSet = new Set<string>(
      seededRow ? (JSON.parse(seededRow.value) as string[]) : []
    );
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
      currency: parseJson(SETTING_DB_KEYS.currency, DEFAULT_SETTINGS.currency),
      monthStartDay: parseJson(SETTING_DB_KEYS.monthStartDay, DEFAULT_SETTINGS.monthStartDay),
      theme: parseJson(SETTING_DB_KEYS.theme, DEFAULT_SETTINGS.theme),
      reminder: {
        ...DEFAULT_SETTINGS.reminder,
        ...parseJson(SETTING_DB_KEYS.reminder, DEFAULT_SETTINGS.reminder),
      },
      sampleDataLoaded: parseJson(SETTING_DB_KEYS.sampleDataLoaded, DEFAULT_SETTINGS.sampleDataLoaded),
      notificationPermissionDenied: parseJson(
        SETTING_DB_KEYS.notificationPermissionDenied,
        DEFAULT_SETTINGS.notificationPermissionDenied
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

  async deleteAllData(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        DELETE FROM transactions;
        DELETE FROM budgets;
        DELETE FROM day_reviews;
        DELETE FROM settings;
        DELETE FROM categories;
      `);
      await seedDefaultCategoriesSqlite(this.db, Date.now());
    });
  }
}
