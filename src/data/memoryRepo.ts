import { buildDefaultCategories } from '@/domain/categories';
import { normalizeCategoryColorKey } from '@/theme/categoryColors';
import {
  assertValidCategoryInput,
  assertValidNewTransaction,
  isValidBudgetAmount,
} from '@/domain/validation';
import {
  normalizeReminderSettings,
  type Budget,
  type Category,
  type CurrencyCode,
  type DayReviewRecord,
  type LocalDate,
  type NewTransaction,
  type Settings,
  type Transaction,
  type TransactionPatch,
  type TxPage,
  type TxQuery,
  type TxQuerySummary,
  type TxSearchResult,
} from '@/domain/types';
import { DEFAULT_SETTINGS, type BackupDataSnapshot, type Repo } from './repo';

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
    reminder: normalizeReminderSettings(s.reminder, DEFAULT_SETTINGS.reminder),
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

  async insertTransactionsBatch(txs: NewTransaction[]): Promise<void> {
    for (const tx of txs) {
      await this.insertTransaction(tx);
    }
  }

  async clearSampleTransactions(): Promise<void> {
    for (const [id, tx] of this.transactions.entries()) {
      if (tx.source === 'sample') {
        this.transactions.delete(id);
      }
    }
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

  async listAllTransactionsForBackup(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .map((tx) => ({ ...tx }))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  private matchesTxQuery(tx: Transaction, q: TxQuery, searchNorm: string): boolean {
    if (tx.deletedAt != null) return false;
    if (q.type && tx.type !== q.type) return false;
    if (q.categoryIds && q.categoryIds.length > 0) {
      if (!tx.categoryId || !q.categoryIds.includes(tx.categoryId)) return false;
    } else if (q.categoryId !== undefined && tx.categoryId !== q.categoryId) {
      return false;
    }
    if (q.fromIncl && tx.occurredOn < q.fromIncl) return false;
    if (q.toExcl && tx.occurredOn >= q.toExcl) return false;
    if (q.minAmountMinor !== undefined && tx.amountMinor < q.minAmountMinor) return false;
    if (q.maxAmountMinor !== undefined && tx.amountMinor > q.maxAmountMinor) return false;
    if (searchNorm.length > 0) {
      const hay = `${tx.description} ${tx.note}`.toLowerCase();
      if (!hay.includes(searchNorm)) return false;
    }
    return true;
  }

  async searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult> {
    const searchNorm = q.search?.trim().toLowerCase() ?? '';
    const cursorKey = parseCursor(page.cursor);

    const filtered: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (this.matchesTxQuery(tx, q, searchNorm)) {
        filtered.push({ ...tx });
      }
    }

    filtered.sort(compareTxDesc);
    const afterCursor = cursorKey ? filtered.filter((tx) => isAfterCursor(tx, cursorKey)) : filtered;

    const limit = Math.max(1, page.limit);
    const hasMore = afterCursor.length > limit;
    const rows = afterCursor.slice(0, limit);
    const next = hasMore && rows.length > 0 ? encodeCursor(rows[rows.length - 1]) : undefined;
    return { rows, next };
  }

  async summarizeTransactions(q: TxQuery, currency: CurrencyCode): Promise<TxQuerySummary> {
    const searchNorm = q.search?.trim().toLowerCase() ?? '';
    let count = 0;
    let expenseMinor = 0;
    let incomeMinor = 0;

    for (const tx of this.transactions.values()) {
      if (!this.matchesTxQuery(tx, q, searchNorm)) continue;
      count += 1;
      if (tx.currency !== currency) continue;
      if (tx.type === 'expense') expenseMinor += tx.amountMinor;
      else if (tx.type === 'income') incomeMinor += tx.amountMinor;
    }

    return { count, expenseMinor, incomeMinor };
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
    assertValidCategoryInput(c);
    this.categories.set(c.id, {
      ...c,
      colorKey: normalizeCategoryColorKey(c.colorKey),
    });
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
      [k]:
        k === 'reminder'
          ? normalizeReminderSettings(v, DEFAULT_SETTINGS.reminder)
          : v,
    };
  }

  async markDayReviewed(day: LocalDate): Promise<void> {
    this.dayReviews.set(day, Date.now());
  }

  async isDayReviewed(day: LocalDate): Promise<boolean> {
    return this.dayReviews.has(day);
  }

  async listAllDayReviews(): Promise<DayReviewRecord[]> {
    return Array.from(this.dayReviews.entries())
      .map(([day, reviewedAt]) => ({ day, reviewedAt }))
      .sort((a, b) => a.day.localeCompare(b.day));
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

  async replaceAllDataFromBackup(data: BackupDataSnapshot): Promise<void> {
    const prevTransactions = new Map(
      Array.from(this.transactions.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevCategories = new Map(
      Array.from(this.categories.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevBudgets = new Map(
      Array.from(this.budgets.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevSeeded = new Set(this.seededBudgetPeriods);
    const prevDayReviews = new Map(this.dayReviews);
    const prevSettings = cloneSettings(this.settings);

    try {
      this.transactions.clear();
      this.categories.clear();
      this.budgets.clear();
      this.seededBudgetPeriods.clear();
      this.dayReviews.clear();

      for (const cat of data.categories) {
        assertValidCategoryInput(cat);
        this.categories.set(cat.id, {
          ...cat,
          colorKey: normalizeCategoryColorKey(cat.colorKey),
        });
      }

      for (const tx of data.transactions) {
        assertValidNewTransaction(tx);
        if (tx.categoryId !== null && !this.categories.has(tx.categoryId)) {
          throw new Error(`Unknown categoryId "${tx.categoryId}" on transaction "${tx.id}"`);
        }
        this.transactions.set(tx.id, { ...tx });
      }

      for (const b of data.budgets) {
        if (!isValidBudgetAmount(b.amountMinor)) {
          throw new Error(`Invalid budget amount: ${b.amountMinor}`);
        }
        if (b.categoryId !== '' && !this.categories.has(b.categoryId)) {
          throw new Error(`Unknown categoryId "${b.categoryId}" on budget "${b.periodStart}"`);
        }
        this.budgets.set(this.budgetKey(b.periodStart, b.categoryId), { ...b });
      }

      for (const dr of data.day_reviews) {
        this.dayReviews.set(dr.day, dr.reviewedAt);
      }

      this.settings = cloneSettings(data.settings);
    } catch (err) {
      this.transactions = prevTransactions;
      this.categories = prevCategories;
      this.budgets = prevBudgets;
      this.seededBudgetPeriods = prevSeeded;
      this.dayReviews = prevDayReviews;
      this.settings = prevSettings;
      throw err;
    }
  }
}
