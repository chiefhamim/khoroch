import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '@/domain/categories';
import { LATEST_SCHEMA_VERSION, runMigrations, SCHEMA_V1_SQL } from './migrations';
import { SqliteRepo } from './sqliteRepo';

type BindValue = string | number | null;

/**
 * Thin async adapter over Node 26's built-in `node:sqlite` so migration SQL and
 * `SqliteRepo` run against a genuine SQLite engine inside Jest.
 */
function createNodeSqliteAdapter(): {
  db: SQLiteDatabase;
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

  const adapter = {
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
    db: adapter,
    close: () => native.close(),
  };
}

const V1_DEFAULT_SEED: readonly {
  id: string;
  name: string;
  icon: string;
  kind: 'expense' | 'income';
  sortOrder: number;
}[] = [
  { id: 'food_dining', name: 'Food & Dining', icon: 'restaurant', kind: 'expense', sortOrder: 1 },
  { id: 'groceries', name: 'Groceries', icon: 'cart', kind: 'expense', sortOrder: 2 },
  { id: 'transportation', name: 'Transportation', icon: 'car', kind: 'expense', sortOrder: 3 },
  { id: 'shopping', name: 'Shopping', icon: 'bag-handle', kind: 'expense', sortOrder: 4 },
  { id: 'housing_rent', name: 'Housing & Rent', icon: 'home', kind: 'expense', sortOrder: 5 },
  { id: 'utilities', name: 'Utilities', icon: 'flash', kind: 'expense', sortOrder: 6 },
  { id: 'health', name: 'Health', icon: 'medkit', kind: 'expense', sortOrder: 7 },
  { id: 'entertainment', name: 'Entertainment', icon: 'film', kind: 'expense', sortOrder: 8 },
  { id: 'education', name: 'Education', icon: 'school', kind: 'expense', sortOrder: 9 },
  { id: 'travel', name: 'Travel', icon: 'airplane', kind: 'expense', sortOrder: 10 },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', kind: 'expense', sortOrder: 11 },
  { id: 'personal_care', name: 'Personal Care', icon: 'sparkles', kind: 'expense', sortOrder: 12 },
  { id: 'family', name: 'Family', icon: 'people', kind: 'expense', sortOrder: 13 },
  { id: 'gifts', name: 'Gifts', icon: 'gift', kind: 'expense', sortOrder: 14 },
  { id: 'other', name: 'Other', icon: 'shapes', kind: 'expense', sortOrder: 15 },
  { id: 'salary', name: 'Salary', icon: 'cash', kind: 'income', sortOrder: 101 },
  { id: 'business', name: 'Business / Freelance', icon: 'briefcase', kind: 'income', sortOrder: 102 },
  { id: 'gift_received', name: 'Gift Received', icon: 'gift', kind: 'income', sortOrder: 103 },
  { id: 'other_income', name: 'Other Income', icon: 'wallet', kind: 'income', sortOrder: 104 },
];

describe('SQLite migrations v1 -> v2 (additive only)', () => {
  it('migrates a populated v1 database to v2 with every transaction, budget, custom category, and customization intact', async () => {
    const { db, close } = createNodeSqliteAdapter();
    try {
      // 1. Seed a genuine v1 database BEFORE v2 exists (19 default categories, no color_key column)
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync(SCHEMA_V1_SQL);

      const colsBefore = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
      expect(colsBefore.some((c) => c.name === 'color_key')).toBe(false);

      for (const c of V1_DEFAULT_SEED) {
        const customName = c.id === 'food_dining' ? 'Dining Out' : c.name;
        const customIcon = c.id === 'entertainment' ? 'game-controller' : c.icon;
        const archivedAt = c.id === 'gifts' ? 1700000100000 : null;
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, kind, sort_order, is_selected, archived_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, customName, customIcon, c.kind, c.sortOrder, 1, archivedAt, 1700000000000]
        );
      }

      // User-created custom category in v1
      await db.runAsync(
        `INSERT INTO categories (id, name, icon, kind, sort_order, is_selected, archived_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['custom_tea', 'Evening Tea', 'cafe', 'expense', 50, 1, null, 1700000005000]
      );

      // Existing owner transactions, budgets, settings, and day reviews
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-salary-1',
          'income',
          2_300_000,
          'BDT',
          'salary',
          'Salary',
          '',
          '2026-11-09',
          '10:00',
          'manual',
          1700000010000,
          1700000010000,
          null,
        ]
      );
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-internet-1',
          'expense',
          200_000,
          'BDT',
          'utilities',
          'Internet bill',
          'November ISP',
          '2026-11-09',
          '14:15',
          'manual',
          1700000020000,
          1700000020000,
          null,
        ]
      );
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx-custom-1',
          'expense',
          15_000,
          'BDT',
          'custom_tea',
          'Cha & biscuit',
          '',
          '2026-11-10',
          null,
          'manual',
          1700000030000,
          1700000030000,
          null,
        ]
      );
      await db.runAsync(
        `INSERT INTO budgets (period_start, category_id, amount_minor, updated_at) VALUES (?, ?, ?, ?)`,
        ['2026-11-10', '', 4_000_000, 1700000040000]
      );
      await db.runAsync(`INSERT INTO settings (key, value) VALUES (?, ?)`, [
        'onboarding_done',
        'true',
      ]);
      await db.runAsync(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['name', '"Hamim"']);
      await db.runAsync(`INSERT INTO day_reviews (day, reviewed_at) VALUES (?, ?)`, [
        '2026-11-09',
        1700000050000,
      ]);

      await db.execAsync('PRAGMA user_version = 1;');

      // 2. Run migration v1 -> v3 (and re-run to verify idempotency)
      await runMigrations(db);
      await runMigrations(db);

      const ver = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      expect(ver?.user_version).toBe(LATEST_SCHEMA_VERSION);
      expect(LATEST_SCHEMA_VERSION).toBe(3);

      const colsAfter = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
      expect(colsAfter.some((c) => c.name === 'color_key')).toBe(true);

      // 3. Read via SqliteRepo and verify zero data loss + v2 additions
      const repo = new SqliteRepo(db);
      const txs = await repo.listTransactionsInRange('2026-11-01', '2026-12-01');
      expect(txs).toHaveLength(3);
      expect(txs.find((t) => t.id === 'tx-salary-1')?.amountMinor).toBe(2_300_000);
      expect(txs.find((t) => t.id === 'tx-internet-1')?.note).toBe('November ISP');
      expect(txs.find((t) => t.id === 'tx-custom-1')?.categoryId).toBe('custom_tea');

      const cats = await repo.listCategories({ includeArchived: true });
      expect(cats).toHaveLength(DEFAULT_CATEGORIES.length + 1); // 20 defaults + 1 custom

      const rentIncome = cats.find((c) => c.id === 'rent_income');
      expect(rentIncome).toBeDefined();
      expect(rentIncome?.icon).toBe('building-2');
      expect(rentIncome?.colorKey).toBe('violet');
      expect(rentIncome?.kind).toBe('income');

      const renamedFood = cats.find((c) => c.id === 'food_dining');
      expect(renamedFood?.name).toBe('Dining Out'); // owner rename preserved
      expect(renamedFood?.icon).toBe('utensils'); // stock v1 icon upgraded to Lucide
      expect(renamedFood?.colorKey).toBe('orange');

      const customizedEnt = cats.find((c) => c.id === 'entertainment');
      expect(customizedEnt?.icon).toBe('game-controller'); // owner custom icon preserved
      expect(customizedEnt?.colorKey).toBe('grape');

      const archivedGift = cats.find((c) => c.id === 'gifts');
      expect(archivedGift?.archivedAt).toBe(1700000100000); // archived timestamp preserved

      const customTea = cats.find((c) => c.id === 'custom_tea');
      expect(customTea?.colorKey).toBe('gray'); // custom category safely backfilled

      const budgets = await repo.getBudgets('2026-11-10');
      expect(budgets).toHaveLength(1);
      expect(budgets[0].amountMinor).toBe(4_000_000);

      const settings = await repo.getSettings();
      expect(settings.onboardingDone).toBe(true);
      expect(settings.name).toBe('Hamim');
      expect(await repo.isDayReviewed('2026-11-09')).toBe(true);
    } finally {
      close();
    }
  });

  it('creates a fresh v3 database from scratch cleanly', async () => {
    const { db, close } = createNodeSqliteAdapter();
    try {
      await runMigrations(db);
      const repo = new SqliteRepo(db);
      const cats = await repo.listCategories();
      expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(cats.find((c) => c.id === 'rent_income')?.colorKey).toBe('violet');
      expect(cats.find((c) => c.id === 'food_dining')?.icon).toBe('utensils');
      expect(cats.find((c) => c.id === 'fees')).toEqual(
        expect.objectContaining({ name: 'Fees & charges', icon: 'receipt', colorKey: 'gray' })
      );
    } finally {
      close();
    }
  });

  it('migrates a populated v2 database to v3 (additive only) with every existing row intact', async () => {
    const { db, close } = createNodeSqliteAdapter();
    try {
      // Seed a realistic v2 schema BEFORE v3 exists
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync(SCHEMA_V1_SQL);
      await db.execAsync('ALTER TABLE categories ADD COLUMN color_key TEXT;');

      const v2Cats = DEFAULT_CATEGORIES.filter((c) => c.id !== 'fees');
      for (const def of v2Cats) {
        const customName = def.id === 'groceries' ? 'Bazar' : def.name;
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [def.id, customName, def.icon, def.colorKey, def.kind, def.sortOrder, 1, null, 1730000000000]
        );
      }

      await db.runAsync(
        `INSERT INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['custom_chai', 'Tong Tea', 'coffee', 'amber', 'expense', 80, 1, null, 1730000001000]
      );

      await db.runAsync(
        `INSERT INTO transactions (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'v2-tx-1',
          'expense',
          35_000,
          'BDT',
          'food_dining',
          'Lunch',
          'Office canteen',
          '2026-11-10',
          '13:15',
          'manual',
          1730000010000,
          1730000010000,
          null,
        ]
      );
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount_minor, currency, category_id, description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'v2-tx-deleted',
          'expense',
          12_000,
          'BDT',
          'custom_chai',
          'Deleted snack',
          '',
          '2026-11-08',
          null,
          'quick',
          1730000020000,
          1730000025000,
          1730000025000,
        ]
      );
      await db.runAsync(
        `INSERT INTO budgets (period_start, category_id, amount_minor, updated_at) VALUES (?, ?, ?, ?)`,
        ['2026-11-01', '', 5_000_000, 1730000030000]
      );
      await db.runAsync(`INSERT INTO day_reviews (day, reviewed_at) VALUES (?, ?)`, [
        '2026-11-10',
        1730000040000,
      ]);
      await db.runAsync(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['name', '"Hamim"']);
      await db.runAsync(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['theme_accent', '"ocean"']);
      await db.execAsync('PRAGMA user_version = 2;');

      // Run v2 -> v3 migration twice (verify idempotency)
      await runMigrations(db);
      await runMigrations(db);

      const ver = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      expect(ver?.user_version).toBe(3);

      const txCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
      expect(txCols.some((c) => c.name === 'account_id')).toBe(true);
      expect(txCols.some((c) => c.name === 'transfer_id')).toBe(true);

      const tables = await db.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('accounts', 'transfers')`
      );
      expect(tables.map((t) => t.name).sort()).toEqual(['accounts', 'transfers']);

      const indexes = await db.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_tx_account', 'idx_tr_date')`
      );
      expect(indexes.map((idx) => idx.name).sort()).toEqual(['idx_tr_date', 'idx_tx_account']);

      const repo = new SqliteRepo(db);

      // Existing rows are intact and transactions have NULL account_id / transfer_id
      const activeTxs = await repo.listAllActiveTransactions();
      expect(activeTxs).toHaveLength(1);
      expect(activeTxs[0]).toEqual(
        expect.objectContaining({
          id: 'v2-tx-1',
          amountMinor: 35_000,
          categoryId: 'food_dining',
          accountId: null,
          transferId: null,
          note: 'Office canteen',
        })
      );

      const allBackupTxs = await repo.listAllTransactionsForBackup();
      expect(allBackupTxs).toHaveLength(2);
      expect(allBackupTxs.find((t) => t.id === 'v2-tx-deleted')?.deletedAt).toBe(1730000025000);

      const cats = await repo.listCategories({ includeArchived: true });
      expect(cats).toHaveLength(DEFAULT_CATEGORIES.length + 1);
      expect(cats.find((c) => c.id === 'groceries')?.name).toBe('Bazar'); // customized name preserved
      expect(cats.find((c) => c.id === 'fees')).toEqual(
        expect.objectContaining({ name: 'Fees & charges', icon: 'receipt', colorKey: 'gray' })
      );

      expect(await repo.getBudgets('2026-11-01')).toHaveLength(1);
      expect(await repo.isDayReviewed('2026-11-10')).toBe(true);
      const settings = await repo.getSettings();
      expect(settings.name).toBe('Hamim');
      expect(settings.accent).toBe('ocean');

      // New v3 tables accept writes cleanly immediately after migration
      await repo.insertAccount({
        id: 'cash',
        name: 'Cash',
        kind: 'cash',
        colorKey: 'cash',
        openingBalanceMinor: 50_000,
        openingDate: '2026-11-13',
      });
      await repo.insertAccount({
        id: 'bkash',
        name: 'bKash',
        kind: 'mobile_wallet',
        provider: 'bkash',
        colorKey: 'bkash',
        monogram: 'bK',
        openingBalanceMinor: 100_000,
        openingDate: '2026-11-13',
      });
      await repo.createTransfer({
        id: 'tr-post-mig',
        fromAccountId: 'bkash',
        toAccountId: 'cash',
        amountMinor: 20_000,
        feeMinor: 500,
        occurredOn: '2026-11-13',
      });
      expect(await repo.listTransfers()).toHaveLength(1);
      expect((await repo.listTransactionsByAccount('bkash')).map((t) => t.id)).toEqual([
        'tr-post-mig:fee',
      ]);
    } finally {
      close();
    }
  });
});
