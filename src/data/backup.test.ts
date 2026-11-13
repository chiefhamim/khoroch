import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '@/domain/categories';
import {
  buildBackupPreview,
  exportBackupJson,
  isBackupDue,
  MAX_BACKUP_BYTES,
  parseAndValidateBackup,
  restoreBackupPayload,
} from './backup';
import { MemoryRepo } from './memoryRepo';
import { runMigrations } from './migrations';
import { SqliteRepo } from './sqliteRepo';

type BindValue = string | number | null;

function createSqliteHarness(): {
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

async function seedComplexState(repo: MemoryRepo | SqliteRepo) {
  await repo.upsertCategory({
    id: 'cat-custom-tea',
    name: 'Evening Chai',
    icon: 'coffee',
    colorKey: 'amber',
    kind: 'expense',
    sortOrder: 99,
    isSelected: true,
    archivedAt: null,
    createdAt: 1731500000000,
  });

  await repo.upsertCategory({
    id: 'cat-archived-temp',
    name: 'Old Temp Cat',
    icon: 'tag',
    colorKey: 'gray',
    kind: 'expense',
    sortOrder: 100,
    isSelected: false,
    archivedAt: null,
    createdAt: 1731500000001,
  });
  await repo.archiveCategory('cat-archived-temp');

  await repo.insertTransaction({
    id: 'tx-live-1',
    type: 'expense',
    amountMinor: 35050,
    currency: 'USD',
    categoryId: 'cat-custom-tea',
    description: 'Ginger tea and biscuits',
    note: 'With friends',
    occurredOn: '2026-11-10',
    occurredTime: '18:30',
    source: 'manual',
    createdAt: 1731500100000,
  });

  await repo.insertTransaction({
    id: 'tx-live-2',
    type: 'income',
    amountMinor: 500000,
    currency: 'USD',
    categoryId: 'salary',
    description: 'November stipend',
    occurredOn: '2026-11-01',
    source: 'manual',
    createdAt: 1731500200000,
  });

  await repo.insertTransaction({
    id: 'tx-deleted-1',
    type: 'expense',
    amountMinor: 1200,
    currency: 'USD',
    categoryId: 'food_dining',
    description: 'Soft deleted test row',
    occurredOn: '2026-11-02',
    source: 'quick',
    createdAt: 1731500300000,
  });
  await repo.softDeleteTransaction('tx-deleted-1');

  await repo.setBudget('2026-11-01', '', 200000);
  await repo.setBudget('2026-11-01', 'food_dining', 45000);
  await repo.markDayReviewed('2026-11-10');
  await repo.markDayReviewed('2026-11-11');

  await repo.setSetting('name', 'Hamim');
  await repo.setSetting('currency', 'USD');
  await repo.setSetting('monthStartDay', 15);
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('theme', 'dark');
  await repo.setSetting('reminder', {
    enabled: true,
    time: '20:45',
    days: [0, 1, 2, 3, 4],
  });
  await repo.setSetting('lastBackupAt', 1731500999000);
  await repo.setSetting('speechDisclosureAccepted', true);
}

describe('backup export, validation, and restore (TEST-CASES §C)', () => {
  it('round-trips categories, deleted txs, budgets, day_reviews, and settings in SQLite and MemoryRepo', async () => {
    const srcSqlite = createSqliteHarness();
    const dstSqlite = createSqliteHarness();
    try {
      await runMigrations(srcSqlite.db);
      await runMigrations(dstSqlite.db);

      await seedComplexState(srcSqlite.repo);
      const json = await exportBackupJson(srcSqlite.repo, '2026-11-13T10:00:00.000Z');

      // Privacy & cleanliness: no local file paths or OS notification identifiers
      expect(json).not.toMatch(/notificationId|scheduledId|file:\/\/|budget\.db|C:\\\\/i);

      const parsed = parseAndValidateBackup(json);
      const preview = buildBackupPreview(parsed);
      expect(preview.transactionCount).toBe(2);
      expect(preview.deletedTransactionCount).toBe(1);
      expect(preview.reviewCount).toBe(2);
      expect(preview.summaryLine).toContain('2 transactions');

      await restoreBackupPayload(dstSqlite.repo, parsed);

      expect(await dstSqlite.repo.listCategories({ includeArchived: true })).toEqual(
        await srcSqlite.repo.listCategories({ includeArchived: true })
      );
      expect(await dstSqlite.repo.listAllTransactionsForBackup()).toEqual(
        await srcSqlite.repo.listAllTransactionsForBackup()
      );
      expect(await dstSqlite.repo.getAllBudgets()).toEqual(await srcSqlite.repo.getAllBudgets());
      expect(await dstSqlite.repo.listAllDayReviews()).toEqual(
        await srcSqlite.repo.listAllDayReviews()
      );
      expect(await dstSqlite.repo.getSettings()).toEqual(await srcSqlite.repo.getSettings());

      // Also verify MemoryRepo restore parity
      const memDst = new MemoryRepo();
      await restoreBackupPayload(memDst, parsed);
      expect(await memDst.listAllTransactionsForBackup()).toEqual(
        await srcSqlite.repo.listAllTransactionsForBackup()
      );
      expect(await memDst.listAllDayReviews()).toEqual(await srcSqlite.repo.listAllDayReviews());
      expect(await memDst.getSettings()).toEqual(await srcSqlite.repo.getSettings());
    } finally {
      srcSqlite.close();
      dstSqlite.close();
    }
  });

  it('rejects backups created by a newer schema version cleanly', async () => {
    const mem = new MemoryRepo();
    await mem.setSetting('name', 'Test');
    await mem.setSetting('currency', 'BDT');
    await mem.setSetting('onboardingDone', true);
    const raw = JSON.parse(await exportBackupJson(mem)) as Record<string, unknown>;
    raw.schema = 99;

    expect(() => parseAndValidateBackup(JSON.stringify(raw))).toThrow(/newer version/i);
  });

  it('migrates v1 backup payload forward into v2 schema', async () => {
    const mem = new MemoryRepo();
    await mem.setSetting('name', 'Owner');
    await mem.setSetting('currency', 'BDT');
    await mem.setSetting('onboardingDone', true);
    const v2 = JSON.parse(await exportBackupJson(mem)) as {
      app: string;
      schema: number;
      exportedAt: string;
      data: {
        categories: Record<string, unknown>[];
        transactions: Record<string, unknown>[];
        budgets: Record<string, unknown>[];
        settings: Record<string, unknown>;
        day_reviews?: unknown;
      };
    };

    v2.schema = 1;
    delete v2.data.day_reviews;
    delete v2.data.settings.lastBackupAt;
    delete v2.data.settings.speechDisclosureAccepted;
    v2.data.categories = v2.data.categories.map((c) => {
      if (c.id === 'food_dining') {
        const { colorKey: _dropped, ...rest } = c;
        return { ...rest, icon: 'restaurant' };
      }
      return c;
    });

    const migrated = parseAndValidateBackup(JSON.stringify(v2));
    expect(migrated.schema).toBe(2);
    expect(migrated.data.day_reviews).toEqual([]);
    expect(migrated.data.settings.lastBackupAt).toBeNull();
    expect(migrated.data.settings.speechDisclosureAccepted).toBe(false);
    const foodCat = migrated.data.categories.find((c) => c.id === 'food_dining');
    expect(foodCat?.icon).toBe('utensils');
    expect(foodCat?.colorKey).toBe(DEFAULT_CATEGORIES.find((c) => c.id === 'food_dining')?.colorKey);
  });

  it('names the failing row and rejects float amounts, broken category FKs, and invalid dates', async () => {
    const mem = new MemoryRepo();
    await mem.setSetting('name', 'Owner');
    await mem.setSetting('currency', 'BDT');
    await mem.setSetting('onboardingDone', true);
    await mem.insertTransaction({
      id: 'tx-row-one',
      type: 'expense',
      amountMinor: 1000,
      currency: 'BDT',
      categoryId: 'food_dining',
      occurredOn: '2026-11-10',
    });
    const baseJson = await exportBackupJson(mem);

    const floatPayload = JSON.parse(baseJson) as {
      data: { transactions: Record<string, unknown>[] };
    };
    floatPayload.data.transactions[0].amountMinor = 12.5;
    expect(() => parseAndValidateBackup(JSON.stringify(floatPayload))).toThrow(/Transaction row #1/);

    const badFkPayload = JSON.parse(baseJson) as {
      data: { transactions: Record<string, unknown>[] };
    };
    badFkPayload.data.transactions[0].categoryId = 'missing-category-id';
    expect(() => parseAndValidateBackup(JSON.stringify(badFkPayload))).toThrow(
      /Transaction row #1.*missing-category-id/
    );

    const badDatePayload = JSON.parse(baseJson) as {
      data: { transactions: Record<string, unknown>[] };
    };
    badDatePayload.data.transactions[0].occurredOn = '2026-02-30';
    expect(() => parseAndValidateBackup(JSON.stringify(badDatePayload))).toThrow(/Transaction row #1/);
  });

  it('leaves existing SQLite and MemoryRepo data untouched if atomic restore aborts', async () => {
    const sqlite = createSqliteHarness();
    const mem = new MemoryRepo();
    try {
      await runMigrations(sqlite.db);
      for (const repo of [sqlite.repo, mem]) {
        await repo.insertTransaction({
          id: 'sentinel-tx',
          type: 'expense',
          amountMinor: 4200,
          currency: 'BDT',
          categoryId: 'food_dining',
          occurredOn: '2026-11-12',
        });

        const basePayload = parseAndValidateBackup(await exportBackupJson(repo));
        const corruptSnapshot = {
          ...basePayload.data,
          transactions: [
            {
              ...basePayload.data.transactions[0],
              amountMinor: 12.5,
            },
          ],
        };

        await expect(repo.replaceAllDataFromBackup(corruptSnapshot)).rejects.toThrow();

        const remaining = await repo.listTransactionsInRange('2026-11-01', '2026-12-01');
        expect(remaining.map((t) => t.id)).toEqual(['sentinel-tx']);
      }
    } finally {
      sqlite.close();
    }
  });

  it('rejects backups larger than 20 MB before JSON.parse', () => {
    const hugeString = 'x'.repeat(MAX_BACKUP_BYTES + 10);
    const parseSpy = jest.spyOn(JSON, 'parse');
    try {
      expect(() => parseAndValidateBackup(hugeString)).toThrow(/20 MB/);
      expect(parseSpy).not.toHaveBeenCalled();
    } finally {
      parseSpy.mockRestore();
    }
  });

  it('computes monthly backup due threshold accurately', () => {
    const now = Date.UTC(2026, 10, 13);
    expect(isBackupDue(null, now)).toBe(true);
    expect(isBackupDue(now - 29 * 24 * 60 * 60 * 1000, now)).toBe(false);
    expect(isBackupDue(now - 31 * 24 * 60 * 60 * 1000, now)).toBe(true);
  });
});
