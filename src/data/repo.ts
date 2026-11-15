import {
  ALL_REMINDER_DAYS,
  cloneDefaultHomeSections,
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
  type NewPerson,
  type NewTransaction,
  type NewTransfer,
  type Person,
  type PersonPatch,
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

export interface BackupDataSnapshot {
  categories: Category[];
  accounts: Account[];
  transfers: Transfer[];
  people: Person[];
  due_entries: DueEntry[];
  transactions: Transaction[];
  budgets: Budget[];
  settings: Settings;
  day_reviews: DayReviewRecord[];
}

export interface Repo {
  // Transactions
  insertTransaction(t: NewTransaction): Promise<void>;
  insertTransactionsBatch(txs: NewTransaction[]): Promise<void>;
  clearSampleTransactions(): Promise<void>;
  updateTransaction(id: string, patch: TransactionPatch): Promise<void>;
  softDeleteTransaction(id: string): Promise<void>;
  getTransaction(id: string): Promise<Transaction | null>;
  listTransactionsInRange(fromIncl: LocalDate, toExcl: LocalDate): Promise<Transaction[]>;
  listAllActiveTransactions(): Promise<Transaction[]>;
  listTransactionsByAccount(
    accountId: string | null,
    opts?: { fromIncl?: LocalDate; toExcl?: LocalDate }
  ): Promise<Transaction[]>;
  listAllTransactionsForBackup(): Promise<Transaction[]>;
  searchTransactions(q: TxQuery, page: TxPage): Promise<TxSearchResult>;
  summarizeTransactions(q: TxQuery, currency: CurrencyCode): Promise<TxQuerySummary>;
  hasAnyTransactions(): Promise<boolean>;
  listRecentDescriptions(limit?: number): Promise<string[]>;

  // Accounts (wallets)
  listAccounts(opts?: { includeArchived?: boolean }): Promise<Account[]>;
  getAccount(id: string): Promise<Account | null>;
  insertAccount(a: NewAccount): Promise<void>;
  updateAccount(id: string, patch: AccountPatch): Promise<void>;
  archiveAccount(id: string): Promise<void>;
  unarchiveAccount(id: string): Promise<void>;

  // Transfers
  createTransfer(t: NewTransfer): Promise<void>;
  updateTransfer(id: string, patch: TransferPatch): Promise<void>;
  softDeleteTransfer(id: string): Promise<void>;
  getTransfer(id: string): Promise<Transfer | null>;
  listTransfers(opts?: {
    accountId?: string;
    fromIncl?: LocalDate;
    toExcl?: LocalDate;
    includeDeleted?: boolean;
  }): Promise<Transfer[]>;
  listAllTransfersForBackup(): Promise<Transfer[]>;

  // People & Dues
  listPeople(opts?: { includeArchived?: boolean }): Promise<Person[]>;
  getPerson(id: string): Promise<Person | null>;
  insertPerson(p: NewPerson): Promise<void>;
  updatePerson(id: string, patch: PersonPatch): Promise<void>;
  archivePerson(id: string): Promise<void>;
  unarchivePerson(id: string): Promise<void>;
  listDueEntries(opts?: {
    personId?: string;
    accountId?: string;
    includeDeleted?: boolean;
  }): Promise<DueEntry[]>;
  getDueEntry(id: string): Promise<DueEntry | null>;
  insertDueEntry(d: NewDueEntry): Promise<void>;
  updateDueEntry(id: string, patch: DueEntryPatch): Promise<void>;
  softDeleteDueEntry(id: string): Promise<void>;
  listAllDueEntriesForBackup(): Promise<DueEntry[]>;

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
  listAllDayReviews(): Promise<DayReviewRecord[]>;
  deleteAllData(): Promise<void>;
  replaceAllDataFromBackup(data: BackupDataSnapshot): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  name: '',
  avatarColorKey: 'accent',
  avatarId: 'initial',
  currency: 'BDT',
  language: 'en',
  banglaFont: 'noto_sans_bengali',
  monthStartDay: 1,
  theme: 'system',
  accent: 'forest',
  incomeColor: 'emerald',
  expenseColor: 'ink',
  reminder: {
    enabled: false,
    time: '21:00',
    days: [...ALL_REMINDER_DAYS],
  },
  hideAmountsOnOpen: false,
  showPoisha: false,
  compactNumbers: false,
  hapticsEnabled: true,
  weekStartsOn: 'saturday',
  homeSections: cloneDefaultHomeSections(),
  appLockEnabled: false,
  appLockTimeoutSec: 0,
  sampleDataLoaded: false,
  notificationPermissionDenied: false,
  lastBackupAt: null,
  speechDisclosureAccepted: false,
  lastUsedAccountId: null,
};
