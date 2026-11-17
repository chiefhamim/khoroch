import { buildDefaultCategories } from '@/domain/categories';
import { normalizeCategoryColorKey } from '@/theme/categoryColors';
import {
  assertValidAccountInput,
  assertValidCategoryInput,
  assertValidNewDueEntry,
  assertValidNewTransaction,
  assertValidNewTransfer,
  assertValidPersonInput,
  isValidBudgetAmount,
} from '@/domain/validation';
import {
  normalizeAppLanguage,
  normalizeAvatarColorKey,
  normalizeAvatarPresetId,
  normalizeBanglaFontKey,
  normalizeExpenseColorKey,
  normalizeHomeSections,
  normalizeBillReminderSettings,
  normalizeDailyWage,
  normalizeDailyWageLast,
  normalizePinnedAmounts,
  normalizeIncomeColorKey,
  normalizeReminderSettings,
  normalizeWeekStartDay,
  normalizeWeeklyBudgetMinor,
  type Account,
  type AccountPatch,
  type Budget,
  type Category,
  type CurrencyCode,
  type DayReviewRecord,
  type DueEntry,
  type DueEntryPatch,
  type LocalDate,
  type NewAccount,
  type NewDueEntry,
  type NewPendingDraft,
  type NewPerson,
  type NewRecurringBill,
  type NewTransaction,
  type NewTransfer,
  type PendingDraft,
  type PendingDraftStatus,
  type Person,
  type PersonPatch,
  type RecurringBill,
  type RecurringBillPatch,
  type Settings,
  type Transaction,
  type TransactionPatch,
  type Transfer,
  type TransferPatch,
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
    language: normalizeAppLanguage(s.language, DEFAULT_SETTINGS.language),
    banglaFont: normalizeBanglaFontKey(s.banglaFont, DEFAULT_SETTINGS.banglaFont),
    avatarColorKey: normalizeAvatarColorKey(s.avatarColorKey, DEFAULT_SETTINGS.avatarColorKey),
    avatarId: normalizeAvatarPresetId(s.avatarId, DEFAULT_SETTINGS.avatarId),
    incomeColor: normalizeIncomeColorKey(s.incomeColor, DEFAULT_SETTINGS.incomeColor),
    expenseColor: normalizeExpenseColorKey(s.expenseColor, DEFAULT_SETTINGS.expenseColor),
    weekStartsOn: normalizeWeekStartDay(s.weekStartsOn, DEFAULT_SETTINGS.weekStartsOn),
    periodKind: s.periodKind === 'week' ? 'week' : 'month',
    weekStartDay:
      Number.isInteger(s.weekStartDay) && s.weekStartDay >= 0 && s.weekStartDay <= 6
        ? s.weekStartDay
        : DEFAULT_SETTINGS.weekStartDay,
    weeklyBudgetMinor: normalizeWeeklyBudgetMinor(s.weeklyBudgetMinor),
    homeSections: normalizeHomeSections(s.homeSections),
    reminder: normalizeReminderSettings(s.reminder, DEFAULT_SETTINGS.reminder),
    pinnedAmounts: normalizePinnedAmounts(s.pinnedAmounts),
    dailyWage: normalizeDailyWage(s.dailyWage),
    dailyWageLast: normalizeDailyWageLast(s.dailyWageLast),
    billReminders: normalizeBillReminderSettings(s.billReminders),
  };
}

function compareTransferDesc(a: Transfer, b: Transfer): number {
  if (a.occurredOn !== b.occurredOn) {
    return b.occurredOn.localeCompare(a.occurredOn);
  }
  if (a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  return b.id.localeCompare(a.id);
}

function compareAccountAsc(a: Account, b: Account): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.name.localeCompare(b.name);
}

export class MemoryRepo implements Repo {
  private transactions = new Map<string, Transaction>();
  private accounts = new Map<string, Account>();
  private transfers = new Map<string, Transfer>();
  private people = new Map<string, Person>();
  private dueEntries = new Map<string, DueEntry>();
  private categories = new Map<string, Category>();
  private budgets = new Map<string, Budget>();
  private seededBudgetPeriods = new Set<LocalDate>();
  private recurringBills = new Map<string, RecurringBill>();
  private pendingDrafts = new Map<string, PendingDraft>();
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
    const accountId = t.accountId ?? null;
    if (accountId !== null && !this.accounts.has(accountId)) {
      throw new Error(`Unknown accountId "${accountId}" on transaction "${t.id}"`);
    }
    const now = Date.now();
    const record: Transaction = {
      id: t.id,
      type: t.type,
      amountMinor: t.amountMinor,
      currency: t.currency,
      categoryId: t.categoryId ?? null,
      accountId,
      transferId: t.transferId ?? null,
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
    const nextAccountId = patch.accountId !== undefined ? patch.accountId : existing.accountId;
    if (nextAccountId !== null && !this.accounts.has(nextAccountId)) {
      throw new Error(`Unknown accountId "${nextAccountId}" on transaction "${id}"`);
    }
    const updated: Transaction = {
      ...existing,
      ...patch,
      accountId: nextAccountId,
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

  async listAllActiveTransactions(): Promise<Transaction[]> {
    const rows: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.deletedAt == null) {
        rows.push({ ...tx });
      }
    }
    rows.sort(compareTxDesc);
    return rows;
  }

  async listTransactionsByAccount(
    accountId: string | null,
    opts?: { fromIncl?: LocalDate; toExcl?: LocalDate }
  ): Promise<Transaction[]> {
    const rows: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.deletedAt != null) continue;
      if (tx.accountId !== accountId) continue;
      if (opts?.fromIncl && tx.occurredOn < opts.fromIncl) continue;
      if (opts?.toExcl && tx.occurredOn >= opts.toExcl) continue;
      rows.push({ ...tx });
    }
    rows.sort(compareTxDesc);
    return rows;
  }

  private matchesTxQuery(tx: Transaction, q: TxQuery, searchNorm: string): boolean {
    if (tx.deletedAt != null) return false;
    if (q.type && tx.type !== q.type) return false;
    if (q.categoryIds && q.categoryIds.length > 0) {
      if (!tx.categoryId || !q.categoryIds.includes(tx.categoryId)) return false;
    } else if (q.categoryId !== undefined && tx.categoryId !== q.categoryId) {
      return false;
    }
    if (q.accountIds && q.accountIds.length > 0) {
      if (!tx.accountId || !q.accountIds.includes(tx.accountId)) return false;
    } else if (q.accountId !== undefined && tx.accountId !== q.accountId) {
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

  async listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]> {
    const includeArchived = opts?.includeArchived ?? false;
    return Array.from(this.accounts.values())
      .filter((a) => includeArchived || a.archivedAt == null)
      .map((a) => ({ ...a }))
      .sort(compareAccountAsc);
  }

  async getAccount(id: string): Promise<Account | null> {
    const acc = this.accounts.get(id);
    return acc ? { ...acc } : null;
  }

  async insertAccount(a: NewAccount): Promise<void> {
    assertValidAccountInput(a);
    if (this.accounts.has(a.id)) {
      return;
    }
    const now = Date.now();
    const record: Account = {
      id: a.id,
      name: a.name.trim(),
      kind: a.kind,
      provider: a.provider ?? null,
      colorKey: a.colorKey.trim(),
      monogram: a.monogram !== undefined && a.monogram !== null ? a.monogram.trim() || null : null,
      last4: a.last4 ?? null,
      defaultFeeBp: a.defaultFeeBp ?? null,
      openingBalanceMinor: a.openingBalanceMinor ?? 0,
      openingDate: a.openingDate,
      includeInTotal: a.includeInTotal ?? true,
      sortOrder: a.sortOrder ?? 0,
      archivedAt: a.archivedAt ?? null,
      createdAt: a.createdAt ?? now,
      updatedAt: a.updatedAt ?? now,
    };
    this.accounts.set(record.id, record);
  }

  async updateAccount(id: string, patch: AccountPatch): Promise<void> {
    const existing = this.accounts.get(id);
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
    this.accounts.set(id, merged);
  }

  async archiveAccount(id: string): Promise<void> {
    const existing = this.accounts.get(id);
    if (!existing) return;
    const now = Date.now();
    this.accounts.set(id, {
      ...existing,
      archivedAt: existing.archivedAt ?? now,
      updatedAt: now,
    });
  }

  async unarchiveAccount(id: string): Promise<void> {
    const existing = this.accounts.get(id);
    if (!existing) return;
    this.accounts.set(id, {
      ...existing,
      archivedAt: null,
      updatedAt: Date.now(),
    });
  }

  async createTransfer(t: NewTransfer): Promise<void> {
    assertValidNewTransfer(t);
    if (this.transfers.has(t.id)) {
      return;
    }
    if (!this.accounts.has(t.fromAccountId)) {
      throw new Error(`Unknown fromAccountId "${t.fromAccountId}" on transfer "${t.id}"`);
    }
    if (!this.accounts.has(t.toAccountId)) {
      throw new Error(`Unknown toAccountId "${t.toAccountId}" on transfer "${t.id}"`);
    }
    const feeMinor = t.feeMinor ?? 0;
    const now = Date.now();
    const record: Transfer = {
      id: t.id,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      amountMinor: t.amountMinor,
      feeMinor,
      occurredOn: t.occurredOn,
      occurredTime: t.occurredTime ?? null,
      note: t.note ?? '',
      createdAt: t.createdAt ?? now,
      updatedAt: t.updatedAt ?? now,
      deletedAt: null,
    };

    const prevTransfers = new Map(
      Array.from(this.transfers.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevTransactions = new Map(
      Array.from(this.transactions.entries()).map(([k, v]) => [k, { ...v }])
    );

    try {
      this.transfers.set(record.id, record);
      if (feeMinor > 0) {
        const feeTx: Transaction = {
          id: `${record.id}:fee`,
          type: 'expense',
          amountMinor: feeMinor,
          currency: t.currency ?? this.settings.currency,
          categoryId: 'fees',
          accountId: record.fromAccountId,
          transferId: record.id,
          description: 'Transfer fee',
          note: '',
          occurredOn: record.occurredOn,
          occurredTime: record.occurredTime,
          source: 'manual',
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          deletedAt: null,
        };
        assertValidNewTransaction(feeTx);
        this.transactions.set(feeTx.id, feeTx);
      }
    } catch (err) {
      this.transfers = prevTransfers;
      this.transactions = prevTransactions;
      throw err;
    }
  }

  async updateTransfer(id: string, patch: TransferPatch): Promise<void> {
    const existing = this.transfers.get(id);
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

    if (!this.accounts.has(merged.fromAccountId)) {
      throw new Error(`Unknown fromAccountId "${merged.fromAccountId}" on transfer "${id}"`);
    }
    if (!this.accounts.has(merged.toAccountId)) {
      throw new Error(`Unknown toAccountId "${merged.toAccountId}" on transfer "${id}"`);
    }

    const prevTransfers = new Map(
      Array.from(this.transfers.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevTransactions = new Map(
      Array.from(this.transactions.entries()).map(([k, v]) => [k, { ...v }])
    );

    try {
      this.transfers.set(id, merged);

      const linkedRows = Array.from(this.transactions.values())
        .filter((tx) => tx.transferId === id)
        .sort((a, b) => {
          const aDel = a.deletedAt == null ? 0 : 1;
          const bDel = b.deletedAt == null ? 0 : 1;
          return aDel - bDel || a.createdAt - b.createdAt;
        });

      if (merged.feeMinor === 0) {
        for (const tx of linkedRows) {
          if (tx.deletedAt == null) {
            this.transactions.set(tx.id, { ...tx, deletedAt: now, updatedAt: now });
          }
        }
      } else if (linkedRows.length > 0) {
        const primaryFee = linkedRows[0];
        const updatedFee: Transaction = {
          ...primaryFee,
          type: 'expense',
          amountMinor: merged.feeMinor,
          categoryId: 'fees',
          accountId: merged.fromAccountId,
          occurredOn: merged.occurredOn,
          occurredTime: merged.occurredTime,
          deletedAt: null,
          updatedAt: now,
        };
        assertValidNewTransaction(updatedFee);
        this.transactions.set(primaryFee.id, updatedFee);
      } else {
        const newFee: Transaction = {
          id: `${id}:fee`,
          type: 'expense',
          amountMinor: merged.feeMinor,
          currency: this.settings.currency,
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
          deletedAt: null,
        };
        assertValidNewTransaction(newFee);
        this.transactions.set(newFee.id, newFee);
      }
    } catch (err) {
      this.transfers = prevTransfers;
      this.transactions = prevTransactions;
      throw err;
    }
  }

  async softDeleteTransfer(id: string): Promise<void> {
    const existing = this.transfers.get(id);
    const now = Date.now();
    if (existing && existing.deletedAt == null) {
      this.transfers.set(id, { ...existing, deletedAt: now, updatedAt: now });
    }
    for (const [txId, tx] of this.transactions.entries()) {
      if (tx.transferId === id && tx.deletedAt == null) {
        this.transactions.set(txId, { ...tx, deletedAt: now, updatedAt: now });
      }
    }
  }

  async getTransfer(id: string): Promise<Transfer | null> {
    const tr = this.transfers.get(id);
    return tr ? { ...tr } : null;
  }

  async listTransfers(opts?: {
    accountId?: string;
    fromIncl?: LocalDate;
    toExcl?: LocalDate;
    includeDeleted?: boolean;
  }): Promise<Transfer[]> {
    const includeDeleted = opts?.includeDeleted ?? false;
    const rows: Transfer[] = [];
    for (const tr of this.transfers.values()) {
      if (!includeDeleted && tr.deletedAt != null) continue;
      if (opts?.accountId && tr.fromAccountId !== opts.accountId && tr.toAccountId !== opts.accountId) {
        continue;
      }
      if (opts?.fromIncl && tr.occurredOn < opts.fromIncl) continue;
      if (opts?.toExcl && tr.occurredOn >= opts.toExcl) continue;
      rows.push({ ...tr });
    }
    rows.sort(compareTransferDesc);
    return rows;
  }

  async listAllTransfersForBackup(): Promise<Transfer[]> {
    return Array.from(this.transfers.values())
      .map((tr) => ({ ...tr }))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  async listPeople(opts?: { includeArchived?: boolean }): Promise<Person[]> {
    const includeArchived = opts?.includeArchived ?? false;
    return Array.from(this.people.values())
      .filter((p) => includeArchived || p.archivedAt == null)
      .map((p) => ({ ...p }))
      .sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  }

  async getPerson(id: string): Promise<Person | null> {
    const found = this.people.get(id);
    return found ? { ...found } : null;
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
    this.people.set(p.id, {
      id: p.id,
      name: p.name.trim(),
      colorKey,
      honorific,
      archivedAt: p.archivedAt ?? null,
      createdAt: p.createdAt ?? now,
      updatedAt: p.updatedAt ?? now,
    });
  }

  async updatePerson(id: string, patch: PersonPatch): Promise<void> {
    const existing = this.people.get(id);
    if (!existing) return;
    const merged: Person = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      colorKey:
        patch.colorKey !== undefined ? normalizeCategoryColorKey(patch.colorKey) : existing.colorKey,
      honorific: patch.honorific !== undefined ? patch.honorific : existing.honorific,
      archivedAt: patch.archivedAt !== undefined ? patch.archivedAt : existing.archivedAt,
      updatedAt: Date.now(),
    };
    assertValidPersonInput(merged);
    this.people.set(id, merged);
  }

  async archivePerson(id: string): Promise<void> {
    const existing = this.people.get(id);
    if (!existing) return;
    const now = Date.now();
    this.people.set(id, {
      ...existing,
      archivedAt: existing.archivedAt ?? now,
      updatedAt: now,
    });
  }

  async unarchivePerson(id: string): Promise<void> {
    const existing = this.people.get(id);
    if (!existing) return;
    this.people.set(id, {
      ...existing,
      archivedAt: null,
      updatedAt: Date.now(),
    });
  }

  async listDueEntries(opts?: {
    personId?: string;
    accountId?: string;
    includeDeleted?: boolean;
  }): Promise<DueEntry[]> {
    const includeDeleted = opts?.includeDeleted ?? false;
    const rows: DueEntry[] = [];
    for (const d of this.dueEntries.values()) {
      if (!includeDeleted && d.deletedAt != null) continue;
      if (opts?.personId && d.personId !== opts.personId) continue;
      if (opts?.accountId && d.accountId !== opts.accountId) continue;
      rows.push({ ...d });
    }
    rows.sort((a, b) => {
      if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      return b.id.localeCompare(a.id);
    });
    return rows;
  }

  async getDueEntry(id: string): Promise<DueEntry | null> {
    const found = this.dueEntries.get(id);
    return found ? { ...found } : null;
  }

  async insertDueEntry(d: NewDueEntry): Promise<void> {
    assertValidNewDueEntry(d);
    const now = Date.now();
    this.dueEntries.set(d.id, {
      id: d.id,
      personId: d.personId,
      kind: d.kind,
      amountMinor: d.amountMinor,
      accountId: d.accountId ?? null,
      occurredOn: d.occurredOn,
      occurredTime: d.occurredTime ?? null,
      dueOn: d.dueOn ?? null,
      note: d.note ?? '',
      createdAt: d.createdAt ?? now,
      updatedAt: d.updatedAt ?? now,
      deletedAt: null,
    });
  }

  async updateDueEntry(id: string, patch: DueEntryPatch): Promise<void> {
    const existing = this.dueEntries.get(id);
    if (!existing || existing.deletedAt != null) return;
    const merged: DueEntry = {
      ...existing,
      personId: patch.personId !== undefined ? patch.personId : existing.personId,
      kind: patch.kind !== undefined ? patch.kind : existing.kind,
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : existing.amountMinor,
      accountId: patch.accountId !== undefined ? patch.accountId : existing.accountId,
      occurredOn: patch.occurredOn !== undefined ? patch.occurredOn : existing.occurredOn,
      occurredTime: patch.occurredTime !== undefined ? patch.occurredTime : existing.occurredTime,
      dueOn: patch.dueOn !== undefined ? patch.dueOn : existing.dueOn,
      note: patch.note !== undefined ? patch.note : existing.note,
      updatedAt: Date.now(),
    };
    assertValidNewDueEntry(merged);
    this.dueEntries.set(id, merged);
  }

  async softDeleteDueEntry(id: string): Promise<void> {
    const existing = this.dueEntries.get(id);
    if (!existing || existing.deletedAt != null) return;
    const now = Date.now();
    this.dueEntries.set(id, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
  }

  async listAllDueEntriesForBackup(): Promise<DueEntry[]> {
    return Array.from(this.dueEntries.values())
      .map((d) => ({ ...d }))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
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
          : k === 'homeSections'
            ? normalizeHomeSections(v)
            : k === 'language'
              ? normalizeAppLanguage(v, DEFAULT_SETTINGS.language)
              : k === 'banglaFont'
                ? normalizeBanglaFontKey(v, DEFAULT_SETTINGS.banglaFont)
                : k === 'avatarId'
                  ? normalizeAvatarPresetId(v, DEFAULT_SETTINGS.avatarId)
                  : k === 'incomeColor'
                    ? normalizeIncomeColorKey(v, DEFAULT_SETTINGS.incomeColor)
                    : k === 'expenseColor'
                      ? normalizeExpenseColorKey(v, DEFAULT_SETTINGS.expenseColor)
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
    this.pendingDrafts.clear();
    this.recurringBills.clear();
    this.dueEntries.clear();
    this.people.clear();
    this.transactions.clear();
    this.transfers.clear();
    this.accounts.clear();
    this.budgets.clear();
    this.seededBudgetPeriods.clear();
    this.dayReviews.clear();
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.categories.clear();
    for (const cat of buildDefaultCategories(Date.now())) {
      this.categories.set(cat.id, { ...cat });
    }
  }

  async listRecurringBills(opts?: { includeInactive?: boolean }): Promise<RecurringBill[]> {
    const includeInactive = opts?.includeInactive ?? false;
    return Array.from(this.recurringBills.values())
      .filter((b) => includeInactive || b.isActive)
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name));
  }

  async insertRecurringBill(b: NewRecurringBill): Promise<void> {
    if (this.recurringBills.has(b.id)) return;
    const now = Date.now();
    this.recurringBills.set(b.id, {
      id: b.id,
      name: b.name.trim(),
      kind: b.kind,
      amountMinor: b.amountMinor,
      dayOfMonth: b.dayOfMonth,
      categoryId: b.categoryId ?? null,
      accountId: b.accountId ?? null,
      totalInstallments: b.totalInstallments ?? null,
      paidInstallments: b.paidInstallments ?? 0,
      lastPaidPeriod: b.lastPaidPeriod ?? null,
      isActive: b.isActive ?? true,
      createdAt: b.createdAt ?? now,
      updatedAt: b.updatedAt ?? now,
    });
  }

  async updateRecurringBill(id: string, patch: RecurringBillPatch): Promise<void> {
    const existing = this.recurringBills.get(id);
    if (!existing) throw new Error(`Recurring bill "${id}" not found`);
    this.recurringBills.set(id, {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.amountMinor !== undefined ? { amountMinor: patch.amountMinor } : {}),
      ...(patch.dayOfMonth !== undefined ? { dayOfMonth: patch.dayOfMonth } : {}),
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.accountId !== undefined ? { accountId: patch.accountId } : {}),
      ...(patch.totalInstallments !== undefined ? { totalInstallments: patch.totalInstallments } : {}),
      ...(patch.paidInstallments !== undefined ? { paidInstallments: patch.paidInstallments } : {}),
      ...(patch.lastPaidPeriod !== undefined ? { lastPaidPeriod: patch.lastPaidPeriod } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: Date.now(),
    });
  }

  async deleteRecurringBill(id: string): Promise<void> {
    this.recurringBills.delete(id);
  }

  async recordBillPaid(input: {
    billId: string;
    periodStart: LocalDate;
    transaction: NewTransaction | null;
  }): Promise<'recorded' | 'already_paid'> {
    const existing = this.recurringBills.get(input.billId);
    if (!existing) throw new Error(`Recurring bill "${input.billId}" not found`);
    if (existing.lastPaidPeriod != null && existing.lastPaidPeriod >= input.periodStart) {
      return 'already_paid';
    }
    const nextPaid = existing.paidInstallments + 1;
    const doneEmi =
      existing.kind === 'emi' &&
      existing.totalInstallments !== null &&
      nextPaid >= existing.totalInstallments;
    // Stamp synchronously (before any await) so a concurrent call sees it; undo if the insert fails.
    this.recurringBills.set(input.billId, {
      ...existing,
      lastPaidPeriod: input.periodStart,
      paidInstallments: nextPaid,
      isActive: doneEmi ? false : existing.isActive,
      updatedAt: Date.now(),
    });
    try {
      if (input.transaction) await this.insertTransaction(input.transaction);
    } catch (e) {
      this.recurringBills.set(input.billId, existing);
      throw e;
    }
    return 'recorded';
  }

  async listPendingDrafts(opts?: { status?: PendingDraftStatus }): Promise<PendingDraft[]> {
    const status = opts?.status;
    return Array.from(this.pendingDrafts.values())
      .filter((d) => !status || d.status === status)
      .sort(
        (a, b) =>
          b.occurredOn.localeCompare(a.occurredOn) ||
          (b.occurredTime ?? '').localeCompare(a.occurredTime ?? '') ||
          b.createdAt - a.createdAt
      );
  }

  async upsertPendingDrafts(drafts: NewPendingDraft[]): Promise<number> {
    let inserted = 0;
    const seenFp = new Set(Array.from(this.pendingDrafts.values()).map((d) => d.fingerprint));
    const now = Date.now();
    for (const d of drafts) {
      if (seenFp.has(d.fingerprint) || this.pendingDrafts.has(d.id)) continue;
      seenFp.add(d.fingerprint);
      this.pendingDrafts.set(d.id, {
        id: d.id,
        source: d.source,
        fingerprint: d.fingerprint,
        draftKind: d.draftKind ?? 'transaction',
        type: d.type,
        amountMinor: d.amountMinor,
        feeMinor: d.feeMinor ?? 0,
        categoryId: d.categoryId ?? null,
        accountId: d.accountId ?? null,
        fromAccountId: d.fromAccountId ?? null,
        toAccountId: d.toAccountId ?? null,
        description: d.description ?? '',
        rawText: d.rawText,
        trxId: d.trxId ?? null,
        occurredOn: d.occurredOn,
        occurredTime: d.occurredTime ?? null,
        status: 'pending',
        createdAt: d.createdAt ?? now,
      });
      inserted += 1;
    }
    return inserted;
  }

  async updatePendingDraftStatus(id: string, status: PendingDraftStatus): Promise<void> {
    const existing = this.pendingDrafts.get(id);
    if (!existing) return;
    this.pendingDrafts.set(id, {
      ...existing,
      status,
      rawText: status === 'pending' ? existing.rawText : '',
    });
  }

  async clearPendingDrafts(status?: PendingDraftStatus): Promise<void> {
    if (!status) {
      this.pendingDrafts.clear();
      return;
    }
    for (const [id, d] of this.pendingDrafts.entries()) {
      if (d.status === status) {
        this.pendingDrafts.delete(id);
      }
    }
  }

  async replaceAllDataFromBackup(data: BackupDataSnapshot): Promise<void> {
    const prevTransactions = new Map(
      Array.from(this.transactions.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevAccounts = new Map(
      Array.from(this.accounts.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevTransfers = new Map(
      Array.from(this.transfers.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevPeople = new Map(
      Array.from(this.people.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevDueEntries = new Map(
      Array.from(this.dueEntries.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevCategories = new Map(
      Array.from(this.categories.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevBudgets = new Map(
      Array.from(this.budgets.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevRecurring = new Map(
      Array.from(this.recurringBills.entries()).map(([k, v]) => [k, { ...v }])
    );
    const prevSeeded = new Set(this.seededBudgetPeriods);
    const prevDayReviews = new Map(this.dayReviews);
    const prevSettings = cloneSettings(this.settings);

    try {
      this.pendingDrafts.clear();
      this.recurringBills.clear();
      this.dueEntries.clear();
      this.people.clear();
      this.transactions.clear();
      this.transfers.clear();
      this.accounts.clear();
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

      for (const acc of data.accounts) {
        assertValidAccountInput(acc);
        this.accounts.set(acc.id, { ...acc });
      }

      for (const tr of data.transfers) {
        assertValidNewTransfer(tr);
        if (!this.accounts.has(tr.fromAccountId)) {
          throw new Error(`Unknown fromAccountId "${tr.fromAccountId}" on transfer "${tr.id}"`);
        }
        if (!this.accounts.has(tr.toAccountId)) {
          throw new Error(`Unknown toAccountId "${tr.toAccountId}" on transfer "${tr.id}"`);
        }
        this.transfers.set(tr.id, { ...tr });
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
        this.people.set(person.id, {
          ...person,
          name: person.name.trim(),
          colorKey,
          honorific,
        });
      }

      for (const due of data.due_entries) {
        assertValidNewDueEntry(due);
        if (!this.people.has(due.personId)) {
          throw new Error(`Unknown personId "${due.personId}" on due entry "${due.id}"`);
        }
        if (due.accountId !== null && !this.accounts.has(due.accountId)) {
          throw new Error(`Unknown accountId "${due.accountId}" on due entry "${due.id}"`);
        }
        this.dueEntries.set(due.id, { ...due });
      }

      for (const tx of data.transactions) {
        assertValidNewTransaction(tx);
        if (tx.categoryId !== null && !this.categories.has(tx.categoryId)) {
          throw new Error(`Unknown categoryId "${tx.categoryId}" on transaction "${tx.id}"`);
        }
        if (tx.accountId !== null && !this.accounts.has(tx.accountId)) {
          throw new Error(`Unknown accountId "${tx.accountId}" on transaction "${tx.id}"`);
        }
        if (tx.transferId !== null && !this.transfers.has(tx.transferId)) {
          throw new Error(`Unknown transferId "${tx.transferId}" on transaction "${tx.id}"`);
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

      for (const rb of data.recurring_bills ?? []) {
        this.recurringBills.set(rb.id, { ...rb });
      }

      for (const dr of data.day_reviews) {
        this.dayReviews.set(dr.day, dr.reviewedAt);
      }

      this.settings = cloneSettings(data.settings);
    } catch (err) {
      this.recurringBills = prevRecurring;
      this.dueEntries = prevDueEntries;
      this.people = prevPeople;
      this.transactions = prevTransactions;
      this.accounts = prevAccounts;
      this.transfers = prevTransfers;
      this.categories = prevCategories;
      this.budgets = prevBudgets;
      this.seededBudgetPeriods = prevSeeded;
      this.dayReviews = prevDayReviews;
      this.settings = prevSettings;
      throw err;
    }
  }
}
