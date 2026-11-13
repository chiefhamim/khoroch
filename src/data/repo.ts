import {
  ALL_REMINDER_DAYS,
  type Budget,
  type Category,
  type CurrencyCode,
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

export interface Repo {
  // Transactions
  insertTransaction(t: NewTransaction): Promise<void>;
  insertTransactionsBatch(txs: NewTransaction[]): Promise<void>;
  clearSampleTransactions(): Promise<void>;
  updateTransaction(id: string, patch: TransactionPatch): Promise<void>;
  softDeleteTransaction(id: string): Promise<void>;
  getTransaction(id: string): Promise<Transaction | null>;
  listTransactionsInRange(fromIncl: LocalDate, toExcl: LocalDate): Promise<Transaction[]>;
  searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult>;
  summarizeTransactions(q: TxQuery, currency: CurrencyCode): Promise<TxQuerySummary>;
  hasAnyTransactions(): Promise<boolean>;
  listRecentDescriptions(limit?: number): Promise<string[]>;

  // Categories
  listCategories(opts?: { includeArchived?: boolean }): Promise<Category[]>;
  upsertCategory(c: Category): Promise<void>;
  archiveCategory(id: string): Promise<void>;

  // Budgets
  getBudgets(periodStart: LocalDate): Promise<Budget[]>;
  getAllBudgets(): Promise<Budget[]>;
  setBudget(periodStart: LocalDate, categoryId: string, amountMinor: number): Promise<void>;
  deleteBudget(periodStart: LocalDate, categoryId: string): Promise<void>;
  ensureBudgetsForPeriod(periodStart: LocalDate, previousPeriodStart: LocalDate): Promise<void>;

  // Settings & daily reviews
  getSettings(): Promise<Settings>;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): Promise<void>;
  markDayReviewed(day: LocalDate): Promise<void>;
  isDayReviewed(day: LocalDate): Promise<boolean>;
  deleteAllData(): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  name: '',
  currency: 'BDT',
  monthStartDay: 1,
  theme: 'system',
  reminder: {
    enabled: false,
    time: '21:00',
    days: [...ALL_REMINDER_DAYS],
  },
  sampleDataLoaded: false,
  notificationPermissionDenied: false,
};
