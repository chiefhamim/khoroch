import { buildDefaultCategories } from '@/domain/categories';
import { assertValidNewTransaction, isValidBudgetAmount } from '@/domain/validation';
import type {
  Budget,
  Category,
  LocalDate,
  NewTransaction,
  Settings,
  Transaction,
  TransactionPatch,
  TxPage,
  TxQuery,
  TxSearchResult,
} from '@/domain/types';
import { DEFAULT_SETTINGS, type Repo } from './repo';

function compareTxDesc(a: Transaction, b: Transaction): number {
  if (a.occurredOn !== b.occurredOn) {
    return b.occurredOn.localeCompare(a.occurredOn);
  }
  if (a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return b.id.localeCompare(a.id);
}

interface CursorKey {
  occurredOn: LocalDate;
  createdAt: number;
  id: string;
}

function encodeCursor(tx: Transaction): string {
  return `${tx.occurredOn}|${tx.createdAt}|${tx.id}`;
}

function parseCursor(cursor?: string): CursorKey | null {
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

function isAfterCursor(tx: Transaction, c: CursorKey): boolean {
  if (tx.occurredOn !== c.occurredOn) return tx.occurredOn < c.occurredOn;
  if (tx.createdAt !== c.createdAt) return tx.createdAt < c.createdAt;
  return tx.id < c.id;
}

function cloneSettings(s: Settings): Settings {
  return {
    ...s,
    reminder: { ...s.reminder },
  };
}

export class MemoryRepo implements Repo {
  private transactions = new Map<string, Transaction>();
  private categories = new Map<string, Category>();
  private budgets = new Map<string, Budget>();
  private seededBudgetPeriods = new Set<LocalDate>();
  private settings: Settings = cloneSettings(DEFAULT_SETTINGS);
  private dayReviews = new Map<LocalDate, number>();

  constructor(nowMs: number = Date.now()) {
    for (const cat of buildDefaultCategories(nowMs)) {
      this.categories.set(cat.id, { ...cat });
    }
  }

  private budgetKey(periodStart: LocalDate, categoryId: string): string {
    return `${periodStart}::${categoryId}`;
  }

  async insertTransaction(t: NewTransaction): Promise<void> {
    assertValidNewTransaction(t);
    if (this.transactions.has(t.id)) {
      return; // INSERT OR IGNORE semantics
    }
    const now = Date.now();
    const record: Transaction = {
      id: t.id,
      type: t.type,
      amountMinor: t.amountMinor,
      currency: t.currency,
      categoryId: t.categoryId ?? null,
      description: t.description ?? '',
      note: t.note ?? '',
      occurredOn: t.occurredOn,
      occurredTime: t.occurredTime ?? null,
      source: t.source ?? 'manual',
      createdAt: t.createdAt ?? now,
      updatedAt: t.updatedAt ?? now,
      deletedAt: null,
    };
    this.transactions.set(record.id, record);
  }

  async updateTransaction(id: string, patch: TransactionPatch): Promise<void> {
    const existing = this.transactions.get(id);
    if (!existing) return;
    const updated: Transaction = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    assertValidNewTransaction(updated);
    this.transactions.set(id, updated);
  }

  async softDeleteTransaction(id: string): Promise<void> {
    const existing = this.transactions.get(id);
    if (!existing || existing.deletedAt != null) return;
    const now = Date.now();
    this.transactions.set(id, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const tx = this.transactions.get(id);
    return tx ? { ...tx } : null;
  }

  async listTransactionsInRange(fromIncl: LocalDate, toExcl: LocalDate): Promise<Transaction[]> {
    const rows: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.deletedAt != null) continue;
      if (tx.occurredOn >= fromIncl && tx.occurredOn < toExcl) {
        rows.push({ ...tx });
      }
    }
    rows.sort(compareTxDesc);
    return rows;
  }

  async searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult> {
    const searchNorm = q.search?.trim().toLowerCase() ?? '';
    const cursorKey = parseCursor(page.cursor);

    const filtered: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.deletedAt != null) continue;
      if (q.type && tx.type !== q.type) continue;
      if (q.categoryId !== undefined && tx.categoryId !== q.categoryId) continue;
      if (q.fromIncl && tx.occurredOn < q.fromIncl) continue;
      if (q.toExcl && tx.occurredOn >= q.toExcl) continue;
      if (q.minAmountMinor !== undefined && tx.amountMinor < q.minAmountMinor) continue;
      if (q.maxAmountMinor !== undefined && tx.amountMinor > q.maxAmountMinor) continue;
      if (searchNorm.length > 0) {
        const hay = `${tx.description} ${tx.note}`.toLowerCase();
        if (!hay.includes(searchNorm)) continue;
      }
      filtered.push({ ...tx });
    }

    filtered.sort(compareTxDesc);
    const afterCursor = cursorKey ? filtered.filter((tx) => isAfterCursor(tx, cursorKey)) : filtered;

    const limit = Math.max(1, page.limit);
    const hasMore = afterCursor.length > limit;
    const rows = afterCursor.slice(0, limit);
    const next = hasMore && rows.length > 0 ? encodeCursor(rows[rows.length - 1]) : undefined;
    return { rows, next };
  }

  async hasAnyTransactions(): Promise<boolean> {
    for (const tx of this.transactions.values()) {
      if (tx.deletedAt == null) return true;
    }
    return false;
  }

  async listRecentDescriptions(limit: number = 8): Promise<string[]> {
    const rows = Array.from(this.transactions.values())
      .filter((tx) => tx.deletedAt == null && tx.description.trim().length > 0)
      .sort(compareTxDesc);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const tx of rows) {
      const trimmed = tx.description.trim();
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
    return Array.from(this.categories.values())
      .filter((c) => includeArchived || c.archivedAt == null)
      .map((c) => ({ ...c }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async upsertCategory(c: Category): Promise<void> {
    this.categories.set(c.id, { ...c });
  }

  async archiveCategory(id: string): Promise<void> {
    const existing = this.categories.get(id);
    if (!existing) return;
    this.categories.set(id, {
      ...existing,
      archivedAt: existing.archivedAt ?? Date.now(),
    });
  }

  async getBudgets(periodStart: LocalDate): Promise<Budget[]> {
    const out: Budget[] = [];
    for (const b of this.budgets.values()) {
      if (b.periodStart === periodStart) {
        out.push({ ...b });
      }
    }
    return out;
  }

  async getAllBudgets(): Promise<Budget[]> {
    return Array.from(this.budgets.values()).map((b) => ({ ...b }));
  }

  async setBudget(periodStart: LocalDate, categoryId: string, amountMinor: number): Promise<void> {
    if (!isValidBudgetAmount(amountMinor)) {
      throw new Error(`Invalid budget amount: ${amountMinor}`);
    }
    this.budgets.set(this.budgetKey(periodStart, categoryId), {
      periodStart,
      categoryId,
      amountMinor,
      updatedAt: Date.now(),
    });
  }

  async deleteBudget(periodStart: LocalDate, categoryId: string): Promise<void> {
    this.budgets.delete(this.budgetKey(periodStart, categoryId));
  }

  async ensureBudgetsForPeriod(
    periodStart: LocalDate,
    previousPeriodStart: LocalDate
  ): Promise<void> {
    if (this.seededBudgetPeriods.has(periodStart)) return;
    const existing = await this.getBudgets(periodStart);
    if (existing.length > 0) {
      this.seededBudgetPeriods.add(periodStart);
      return;
    }

    const prev = await this.getBudgets(previousPeriodStart);
    if (prev.length === 0) return;

    const now = Date.now();
    for (const b of prev) {
      this.budgets.set(this.budgetKey(periodStart, b.categoryId), {
        periodStart,
        categoryId: b.categoryId,
        amountMinor: b.amountMinor,
        updatedAt: now,
      });
    }
    this.seededBudgetPeriods.add(periodStart);
  }

  async getSettings(): Promise<Settings> {
    return cloneSettings(this.settings);
  }

  async setSetting<K extends keyof Settings>(k: K, v: Settings[K]): Promise<void> {
    this.settings = {
      ...this.settings,
      [k]: k === 'reminder' ? { ...(v as Settings['reminder']) } : v,
    };
  }

  async markDayReviewed(day: LocalDate): Promise<void> {
    this.dayReviews.set(day, Date.now());
  }

  async isDayReviewed(day: LocalDate): Promise<boolean> {
    return this.dayReviews.has(day);
  }

  async deleteAllData(): Promise<void> {
    this.transactions.clear();
    this.budgets.clear();
    this.seededBudgetPeriods.clear();
    this.dayReviews.clear();
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.categories.clear();
    for (const cat of buildDefaultCategories(Date.now())) {
      this.categories.set(cat.id, { ...cat });
    }
  }
}
