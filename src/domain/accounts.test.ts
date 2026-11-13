import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '@/data/migrations';
import { MemoryRepo } from '@/data/memoryRepo';
import type { Repo } from '@/data/repo';
import { SqliteRepo } from '@/data/sqliteRepo';
import { summarize } from './calc';
import { getPeriod } from './period';
import {
  computeAccountBalance,
  computeAccountsOverview,
  formatAccountBalance,
  formatAccountsTotal,
} from './accounts';
import type { Account, Transaction, Transfer } from './types';

type BindValue = string | number | null;

function createSqliteTestRepo(): {
  db: SQLiteDatabase;
  repo: SqliteRepo;
  close: () => void;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => {
      exec: (sql: string) => void;
      close: () => void;
      prepare: (sql: string) => {
        run: (...params: BindValue[]) => { lastInsertRowid: number; changes: number };
        get: (...params: BindValue[]) => unknown;
        all: (...params: BindValue[]) => unknown[];
      };
    };
  };

  const native = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const flat =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const res = native.prepare(sql).run(...(flat as BindValue[]));
      return {
        lastInsertRowId: Number(res.lastInsertRowid),
        changes: res.changes,
      };
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      const flat =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const row = native.prepare(sql).get(...(flat as BindValue[]));
      return (row as T | undefined) ?? null;
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      const flat =
        params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      return native.prepare(sql).all(...(flat as BindValue[])) as T[];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      native.exec('BEGIN');
      try {
        await task();
        native.exec('COMMIT');
      } catch (err) {
        native.exec('ROLLBACK');
        throw err;
      }
    },
  } as unknown as SQLiteDatabase;

  return {
    db,
    repo: new SqliteRepo(db),
    close: () => native.close(),
  };
}

const NOW = 1794570000000;

const SECTION_A_ACCOUNTS: Account[] = [
  {
    id: 'bkash',
    name: 'bKash',
    kind: 'mobile_wallet',
    provider: 'bkash',
    colorKey: 'bkash',
    monogram: 'bK',
    last4: null,
    openingBalanceMinor: 1_000_000,
    openingDate: '2026-11-10',
    includeInTotal: true,
    sortOrder: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cash',
    name: 'Cash',
    kind: 'cash',
    provider: null,
    colorKey: 'cash',
    monogram: null,
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-10',
    includeInTotal: true,
    sortOrder: 2,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'card',
    name: 'Credit Card',
    kind: 'credit_card',
    provider: null,
    colorKey: 'credit_card',
    monogram: null,
    last4: '4821',
    openingBalanceMinor: -500_000,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 3,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'savings',
    name: 'Savings Bank',
    kind: 'bank',
    provider: null,
    colorKey: 'bank',
    monogram: null,
    last4: null,
    openingBalanceMinor: 3_000_000,
    openingDate: '2026-11-01',
    includeInTotal: false,
    sortOrder: 4,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

async function seedSectionAFixture(repo: Repo): Promise<void> {
  for (const acc of SECTION_A_ACCOUNTS) {
    await repo.insertAccount(acc);
  }
  await repo.insertTransaction({
    id: 'e1',
    type: 'expense',
    amountMinor: 35_000,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'bkash',
    occurredOn: '2026-11-13',
  });
  await repo.insertTransaction({
    id: 'e2',
    type: 'income',
    amountMinor: 250_000,
    currency: 'BDT',
    categoryId: 'rent_income',
    accountId: 'bkash',
    occurredOn: '2026-11-12',
  });
  await repo.createTransfer({
    id: 't1',
    fromAccountId: 'bkash',
    toAccountId: 'cash',
    amountMinor: 100_000,
    feeMinor: 1_850,
    occurredOn: '2026-11-12',
  });
  await repo.insertTransaction({
    id: 'e3',
    type: 'expense',
    amountMinor: 60_000,
    currency: 'BDT',
    categoryId: 'subscriptions',
    accountId: 'card',
    occurredOn: '2026-11-09',
  });
  await repo.insertTransaction({
    id: 'e4',
    type: 'expense',
    amountMinor: 99_900,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'bkash',
    occurredOn: '2026-11-09', // before bkash opening_date 2026-11-10
  });
  await repo.insertTransaction({
    id: 'e5',
    type: 'expense',
    amountMinor: 40_000,
    currency: 'BDT',
    categoryId: 'groceries',
    accountId: 'bkash',
    occurredOn: '2026-11-11',
  });
  await repo.softDeleteTransaction('e5');
  await repo.insertTransaction({
    id: 'e6',
    type: 'expense',
    amountMinor: 2_000,
    currency: 'BDT',
    categoryId: 'other',
    accountId: null,
    occurredOn: '2026-11-13',
  });
}

describe('wallet balances & formatting pure maths (TEST-CASES-v1.2 §A)', () => {
  const feeTx: Transaction = {
    id: 't1:fee',
    type: 'expense',
    amountMinor: 1_850,
    currency: 'BDT',
    categoryId: 'fees',
    accountId: 'bkash',
    transferId: 't1',
    description: 'Transfer fee',
    note: '',
    occurredOn: '2026-11-12',
    occurredTime: null,
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };

  const t1: Transfer = {
    id: 't1',
    fromAccountId: 'bkash',
    toAccountId: 'cash',
    amountMinor: 100_000,
    feeMinor: 1_850,
    occurredOn: '2026-11-12',
    occurredTime: null,
    note: '',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };

  const txs: Transaction[] = [
    {
      id: 'e1',
      type: 'expense',
      amountMinor: 35_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      accountId: 'bkash',
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-13',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    },
    {
      id: 'e2',
      type: 'income',
      amountMinor: 250_000,
      currency: 'BDT',
      categoryId: 'rent_income',
      accountId: 'bkash',
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-12',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    },
    feeTx,
    {
      id: 'e3',
      type: 'expense',
      amountMinor: 60_000,
      currency: 'BDT',
      categoryId: 'subscriptions',
      accountId: 'card',
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-09',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    },
    {
      id: 'e4',
      type: 'expense',
      amountMinor: 99_900,
      currency: 'BDT',
      categoryId: 'food_dining',
      accountId: 'bkash',
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-09',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    },
    {
      id: 'e5',
      type: 'expense',
      amountMinor: 40_000,
      currency: 'BDT',
      categoryId: 'groceries',
      accountId: 'bkash',
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-11',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: NOW + 1000,
    },
    {
      id: 'e6',
      type: 'expense',
      amountMinor: 2_000,
      currency: 'BDT',
      categoryId: 'other',
      accountId: null,
      transferId: null,
      description: '',
      note: '',
      occurredOn: '2026-11-13',
      occurredTime: null,
      source: 'manual',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    },
  ];

  it('computes every §A wallet balance, total, due display, spending, and income', () => {
    const overview = computeAccountsOverview({
      accounts: SECTION_A_ACCOUNTS,
      transactions: txs,
      transfers: [t1],
      currency: 'BDT',
    });

    const byId = new Map(overview.balances.map((b) => [b.account.id, b]));
    expect(byId.get('bkash')?.balanceMinor).toBe(1_113_150);
    expect(byId.get('bkash')?.formattedBalance).toBe('৳11,131.50');
    expect(byId.get('cash')?.balanceMinor).toBe(100_000);
    expect(byId.get('cash')?.formattedBalance).toBe('৳1,000');
    expect(byId.get('card')?.balanceMinor).toBe(-560_000);
    expect(byId.get('card')?.isDue).toBe(true);
    expect(byId.get('card')?.formattedBalance).toBe('৳5,600 due');
    expect(byId.get('savings')?.balanceMinor).toBe(3_000_000);

    expect(overview.totalMinor).toBe(653_150);
    expect(overview.formattedTotal).toBe('৳6,531.50');
    expect(overview.includedCount).toBe(3);
    expect(overview.excludedCount).toBe(1);

    // Nov 1..30 (msd 1): e1 35000 + fee 1850 + e3 60000 + e4 99900 + e6 2000 = 198750
    const novPeriod = getPeriod('2026-11-13', 1);
    const summary = summarize({
      transactions: txs,
      period: novPeriod,
      today: '2026-11-13',
      overallBudgetMinor: null,
      currency: 'BDT',
    });
    expect(summary.spentMinor).toBe(198_750);
    expect(summary.incomeMinor).toBe(250_000);
  });

  it('supports asOfDate and signed due flows on computeAccountBalance', () => {
    const asOfNov12 = computeAccountBalance({
      account: SECTION_A_ACCOUNTS[0], // bkash
      transactions: txs,
      transfers: [t1],
      asOfDate: '2026-11-12',
    });
    // Excludes e1 (-35000) on 2026-11-13
    expect(asOfNov12).toBe(1_148_150);

    const withDues = computeAccountBalance({
      account: SECTION_A_ACCOUNTS[0],
      transactions: txs,
      transfers: [t1],
      dues: [
        { kind: 'lent', amountMinor: 200_000, accountId: 'bkash', occurredOn: '2026-11-13', deletedAt: null },
        { kind: 'received_back', amountMinor: 50_000, accountId: 'bkash', occurredOn: '2026-11-13', deletedAt: null },
        { kind: 'lent', amountMinor: 99_900, accountId: 'bkash', occurredOn: '2026-11-09', deletedAt: null }, // before openingDate
      ],
    });
    expect(withDues).toBe(1_113_150 - 200_000 + 50_000);

    expect(formatAccountBalance('cash', -50_000, 'BDT')).toBe('-৳500');
    expect(formatAccountBalance('credit_card', -560_000, 'BDT')).toBe('৳5,600 due');
    expect(formatAccountsTotal(-560_000, 'BDT')).toBe('-৳5,600');
  });
});

describe('wallets & atomic transfers across MemoryRepo and SqliteRepo (§A)', () => {
  it.each(['memory', 'sqlite'] as const)(
    'executes full §A suite, fee edits, transfer delete, archive/unarchive, validation, and account queries on %s repo',
    async (backend) => {
      const sqliteHarness = backend === 'sqlite' ? createSqliteTestRepo() : null;
      const repo: Repo = sqliteHarness ? sqliteHarness.repo : new MemoryRepo();
      try {
        if (sqliteHarness) {
          await runMigrations(sqliteHarness.db);
        }

        await seedSectionAFixture(repo);

        const computeCurrentOverview = async () => {
          const [accounts, transactions, transfers] = await Promise.all([
            repo.listAccounts(),
            repo.listAllActiveTransactions(),
            repo.listTransfers(),
          ]);
          return computeAccountsOverview({ accounts, transactions, transfers, currency: 'BDT' });
        };

        // 1. Verify initial §A balances & spending/income
        let overview = await computeCurrentOverview();
        const map1 = new Map(overview.balances.map((b) => [b.account.id, b.balanceMinor]));
        expect(map1.get('bkash')).toBe(1_113_150);
        expect(map1.get('cash')).toBe(100_000);
        expect(map1.get('card')).toBe(-560_000);
        expect(map1.get('savings')).toBe(3_000_000);
        expect(overview.totalMinor).toBe(653_150);

        const novPeriod = getPeriod('2026-11-13', 1);
        let allNovTxs = await repo.listTransactionsInRange(novPeriod.start, novPeriod.endExcl);
        let summary = summarize({
          transactions: allNovTxs,
          period: novPeriod,
          today: '2026-11-13',
          overallBudgetMinor: null,
          currency: 'BDT',
        });
        expect(summary.spentMinor).toBe(198_750);
        expect(summary.incomeMinor).toBe(250_000);

        // Queries by account (searchTransactions + summarizeTransactions + listTransactionsByAccount)
        const noWalletSearch = await repo.searchTransactions({ accountId: null }, { limit: 30 });
        expect(noWalletSearch.rows.map((r) => r.id)).toEqual(['e6']);

        const bkashTxs = await repo.listTransactionsByAccount('bkash');
        expect(bkashTxs.map((t) => t.id).sort()).toEqual(['e1', 'e2', 'e4', 't1:fee']);

        const cardSummary = await repo.summarizeTransactions({ accountId: 'card' }, 'BDT');
        expect(cardSummary).toEqual({ count: 1, expenseMinor: 60_000, incomeMinor: 0 });

        // 2. Archive savings? Check archiving bkash hides from strip & total, unarchiving restores it
        await repo.archiveAccount('bkash');
        overview = await computeCurrentOverview();
        expect(overview.balances.some((b) => b.account.id === 'bkash')).toBe(false);
        // Active remaining included accounts: cash (100000) + card (-560000) = -460000
        expect(overview.totalMinor).toBe(-460_000);
        // Historical transactions remain untouched while archived
        expect((await repo.listTransactionsByAccount('bkash')).length).toBe(4);

        await repo.unarchiveAccount('bkash');
        overview = await computeCurrentOverview();
        expect(overview.balances.find((b) => b.account.id === 'bkash')?.balanceMinor).toBe(1_113_150);
        expect(overview.totalMinor).toBe(653_150);

        // 3. Edit t1's fee 1850 -> 0 -> fee expense row soft-deleted (no ৳0 active tx); bkash = 1115000
        await repo.updateTransfer('t1', { feeMinor: 0 });
        const feeAfterZero = await repo.getTransaction('t1:fee');
        expect(feeAfterZero).not.toBeNull();
        expect(feeAfterZero?.deletedAt).not.toBeNull();
        expect((await repo.listTransactionsByAccount('bkash')).some((t) => t.id === 't1:fee')).toBe(
          false
        );
        overview = await computeCurrentOverview();
        expect(overview.balances.find((b) => b.account.id === 'bkash')?.balanceMinor).toBe(1_115_000);
        expect(
          summarize({
            transactions: await repo.listTransactionsInRange(novPeriod.start, novPeriod.endExcl),
            period: novPeriod,
            today: '2026-11-13',
            overallBudgetMinor: null,
            currency: 'BDT',
          }).spentMinor
        ).toBe(196_900);

        // Edit t1's fee 0 -> 1850 again -> revives cleanly without duplicate row
        await repo.updateTransfer('t1', { feeMinor: 1_850 });
        overview = await computeCurrentOverview();
        expect(overview.balances.find((b) => b.account.id === 'bkash')?.balanceMinor).toBe(1_113_150);

        // 4. Delete t1 -> transfer (100000) and its fee row (1850) are removed -> bkash = 1215000, cash = 0, spending = 196900
        await repo.softDeleteTransfer('t1');
        const trAfterDelete = await repo.getTransfer('t1');
        expect(trAfterDelete?.deletedAt).not.toBeNull();
        const feeAfterDelete = await repo.getTransaction('t1:fee');
        expect(feeAfterDelete?.deletedAt).not.toBeNull();

        overview = await computeCurrentOverview();
        const map2 = new Map(overview.balances.map((b) => [b.account.id, b.balanceMinor]));
        expect(map2.get('bkash')).toBe(1_215_000);
        expect(map2.get('cash')).toBe(0);

        allNovTxs = await repo.listTransactionsInRange(novPeriod.start, novPeriod.endExcl);
        summary = summarize({
          transactions: allNovTxs,
          period: novPeriod,
          today: '2026-11-13',
          overallBudgetMinor: null,
          currency: 'BDT',
        });
        expect(summary.spentMinor).toBe(196_900);

        // 5. Validation rejections: from = to and negative fee
        await expect(
          repo.createTransfer({
            id: 't-same',
            fromAccountId: 'bkash',
            toAccountId: 'bkash',
            amountMinor: 10_000,
            feeMinor: 0,
            occurredOn: '2026-11-13',
          })
        ).rejects.toThrow(/same_account/);

        await expect(
          repo.createTransfer({
            id: 't-neg-fee',
            fromAccountId: 'bkash',
            toAccountId: 'cash',
            amountMinor: 10_000,
            feeMinor: -100,
            occurredOn: '2026-11-13',
          })
        ).rejects.toThrow(/invalid_fee/);
      } finally {
        sqliteHarness?.close();
      }
    }
  );
});
