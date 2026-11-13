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

  await repo.insertAccount({
    id: 'bkash',
    name: 'bKash',
    kind: 'mobile_wallet',
    provider: 'bkash',
    colorKey: 'bkash',
    monogram: 'bK',
    openingBalanceMinor: 1_000_000,
    openingDate: '2026-11-10',
    includeInTotal: true,
    sortOrder: 1,
    createdAt: 1731500010000,
    updatedAt: 1731500010000,
  });

  await repo.insertAccount({
    id: 'cash',
    name: 'Cash',
    kind: 'cash',
    colorKey: 'cash',
    openingBalanceMinor: 0,
    openingDate: '2026-11-10',
    includeInTotal: true,
    sortOrder: 2,
    createdAt: 1731500010001,
    updatedAt: 1731500010001,
  });

  await repo.insertAccount({
    id: 'card',
    name: 'City Credit Card',
    kind: 'credit_card',
    colorKey: 'credit_card',
    last4: '4321',
    openingBalanceMinor: -500_000,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 3,
    createdAt: 1731500010002,
    updatedAt: 1731500010002,
  });

  await repo.insertAccount({
    id: 'savings',
    name: 'Savings Bank',
    kind: 'bank',
    colorKey: 'bank',
    openingBalanceMinor: 3_000_000,
    openingDate: '2026-11-01',
    includeInTotal: false,
    sortOrder: 4,
    createdAt: 1731500010003,
    updatedAt: 1731500010003,
  });
  await repo.archiveAccount('savings');

  await repo.insertTransaction({
    id: 'tx-live-1',
    type: 'expense',
    amountMinor: 35050,
    currency: 'BDT',
    categoryId: 'cat-custom-tea',
    accountId: 'bkash',
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
    currency: 'BDT',
    categoryId: 'salary',
    accountId: null,
    description: 'November stipend',
    occurredOn: '2026-11-01',
    source: 'manual',
    createdAt: 1731500200000,
  });

  await repo.insertTransaction({
    id: 'tx-deleted-1',
    type: 'expense',
    amountMinor: 1200,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: 'card',
    description: 'Soft deleted test row',
    occurredOn: '2026-11-02',
    source: 'quick',
    createdAt: 1731500300000,
  });
  await repo.softDeleteTransaction('tx-deleted-1');

  await repo.createTransfer({
    id: 'tr-live-1',
    fromAccountId: 'bkash',
    toAccountId: 'cash',
    amountMinor: 100_000,
    feeMinor: 1_850,
    currency: 'BDT',
    occurredOn: '2026-11-12',
    occurredTime: '15:00',
    note: 'Agent cash out',
    createdAt: 1731500400000,
    updatedAt: 1731500400000,
  });

  await repo.createTransfer({
    id: 'tr-deleted-1',
    fromAccountId: 'bkash',
    toAccountId: 'cash',
    amountMinor: 50_000,
    feeMinor: 500,
    currency: 'BDT',
    occurredOn: '2026-11-11',
    createdAt: 1731500500000,
    updatedAt: 1731500500000,
  });
  await repo.softDeleteTransfer('tr-deleted-1');

  await repo.setBudget('2026-11-01', '', 200000);
  await repo.setBudget('2026-11-01', 'food_dining', 45000);
  await repo.markDayReviewed('2026-11-10');
  await repo.markDayReviewed('2026-11-11');

  await repo.setSetting('name', 'Hamim');
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('monthStartDay', 15);
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('theme', 'dark');
  await repo.setSetting('accent', 'ocean');
  await repo.setSetting('reminder', {
    enabled: true,
    time: '20:45',
    days: [0, 1, 2, 3, 4],
  });
  await repo.setSetting('lastBackupAt', 1731500999000);
  await repo.setSetting('speechDisclosureAccepted', true);
  await repo.setSetting('lastUsedAccountId', 'bkash');
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
      expect(preview.transactionCount).toBe(3); // 2 live txs + 1 live transfer fee
      expect(preview.deletedTransactionCount).toBe(2); // 1 deleted tx + 1 deleted transfer fee
      expect(preview.accountCount).toBe(3);
      expect(preview.transferCount).toBe(1);
      expect(preview.reviewCount).toBe(2);
      expect(preview.summaryLine).toContain('3 transactions');

      await restoreBackupPayload(dstSqlite.repo, parsed);

      expect(await dstSqlite.repo.listCategories({ includeArchived: true })).toEqual(
        await srcSqlite.repo.listCategories({ includeArchived: true })
      );
      expect(await dstSqlite.repo.listAccounts({ includeArchived: true })).toEqual(
        await srcSqlite.repo.listAccounts({ includeArchived: true })
      );
      expect(await dstSqlite.repo.listAllTransfersForBackup()).toEqual(
        await srcSqlite.repo.listAllTransfersForBackup()
      );
      expect(await dstSqlite.repo.listAllTransactionsForBackup()).toEqual(
        await srcSqlite.repo.listAllTransactionsForBackup()
      );
      expect(await dstSqlite.repo.getAllBudgets()).toEqual(await srcSqlite.repo.getAllBudgets());
      expect(await dstSqlite.repo.listAllDayReviews()).toEqual(
        await srcSqlite.repo.listAllDayReviews()
      );
      expect(await dstSqlite.repo.getSettings()).toEqual(await srcSqlite.repo.getSettings());

      // Also verify MemoryRepo export -> deleteAllData() -> restore parity (TEST-CASES §C)
      const memSrc = new MemoryRepo();
      await seedComplexState(memSrc);
      const memJson = await exportBackupJson(memSrc, '2026-11-13T10:00:00.000Z');
      const memSnapshotBefore = {
        cats: await memSrc.listCategories({ includeArchived: true }),
        accounts: await memSrc.listAccounts({ includeArchived: true }),
        transfers: await memSrc.listAllTransfersForBackup(),
        txs: await memSrc.listAllTransactionsForBackup(),
        budgets: await memSrc.getAllBudgets(),
        reviews: await memSrc.listAllDayReviews(),
        settings: await memSrc.getSettings(),
      };

      await memSrc.deleteAllData();
      expect(await memSrc.listAccounts({ includeArchived: true })).toEqual([]);
      expect(await memSrc.listAllTransfersForBackup()).toEqual([]);

      await restoreBackupPayload(memSrc, parseAndValidateBackup(memJson));
      expect(await memSrc.listCategories({ includeArchived: true })).toEqual(memSnapshotBefore.cats);
      expect(await memSrc.listAccounts({ includeArchived: true })).toEqual(memSnapshotBefore.accounts);
      expect(await memSrc.listAllTransfersForBackup()).toEqual(memSnapshotBefore.transfers);
      expect(await memSrc.listAllTransactionsForBackup()).toEqual(memSnapshotBefore.txs);
      expect(await memSrc.getAllBudgets()).toEqual(memSnapshotBefore.budgets);
      expect(await memSrc.listAllDayReviews()).toEqual(memSnapshotBefore.reviews);
      expect(await memSrc.getSettings()).toEqual(memSnapshotBefore.settings);
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

  it('migrates v1 and v2 backup payloads forward into v3 schema', async () => {
    const mem = new MemoryRepo();
    await mem.setSetting('name', 'Owner');
    await mem.setSetting('currency', 'BDT');
    await mem.setSetting('onboardingDone', true);
    await mem.insertTransaction({
      id: 'legacy-tx-1',
      type: 'expense',
      amountMinor: 50_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      occurredOn: '2026-11-10',
    });
    const base = JSON.parse(await exportBackupJson(mem)) as {
      app: string;
      schema: number;
      exportedAt: string;
      data: {
        categories: Record<string, unknown>[];
        accounts?: unknown;
        transfers?: unknown;
        transactions: Record<string, unknown>[];
        budgets: Record<string, unknown>[];
        settings: Record<string, unknown>;
        day_reviews?: unknown;
      };
    };

    // Strip v3-only fields to simulate a v2 backup
    const v2Raw = structuredClone(base);
    v2Raw.schema = 2;
    delete v2Raw.data.accounts;
    delete v2Raw.data.transfers;
    v2Raw.data.categories = v2Raw.data.categories.filter((c) => c.id !== 'fees');
    for (const tx of v2Raw.data.transactions) {
      delete tx.accountId;
      delete tx.transferId;
    }
    const migratedV2 = parseAndValidateBackup(JSON.stringify(v2Raw));
    expect(migratedV2.schema).toBe(3);
    expect(migratedV2.data.accounts).toEqual([]);
    expect(migratedV2.data.transfers).toEqual([]);
    expect(migratedV2.data.categories.some((c) => c.id === 'fees')).toBe(true);
    expect(migratedV2.data.transactions[0].accountId).toBeNull();
    expect(migratedV2.data.transactions[0].transferId).toBeNull();

    // Also simulate a v1 backup
    const v1Raw = structuredClone(base);
    v1Raw.schema = 1;
    delete v1Raw.data.accounts;
    delete v1Raw.data.transfers;
    delete v1Raw.data.day_reviews;
    delete v1Raw.data.settings.lastBackupAt;
    delete v1Raw.data.settings.speechDisclosureAccepted;
    delete v1Raw.data.settings.lastUsedAccountId;
    v1Raw.data.categories = v1Raw.data.categories
      .filter((c) => c.id !== 'fees')
      .map((c) => {
        if (c.id === 'food_dining') {
          const { colorKey: _dropped, ...rest } = c;
          return { ...rest, icon: 'restaurant' };
        }
        return c;
      });

    const migratedV1 = parseAndValidateBackup(JSON.stringify(v1Raw));
    expect(migratedV1.schema).toBe(3);
    expect(migratedV1.data.day_reviews).toEqual([]);
    expect(migratedV1.data.accounts).toEqual([]);
    expect(migratedV1.data.transfers).toEqual([]);
    expect(migratedV1.data.settings.lastBackupAt).toBeNull();
    expect(migratedV1.data.settings.speechDisclosureAccepted).toBe(false);
    expect(migratedV1.data.settings.lastUsedAccountId).toBeNull();
    const foodCat = migratedV1.data.categories.find((c) => c.id === 'food_dining');
    expect(foodCat?.icon).toBe('utensils');
    expect(foodCat?.colorKey).toBe(DEFAULT_CATEGORIES.find((c) => c.id === 'food_dining')?.colorKey);
  });

  it('rejects malformed account, transfer, and broken accountId FKs cleanly', async () => {
    const mem = new MemoryRepo();
    await seedComplexState(mem);
    const baseJson = await exportBackupJson(mem);

    const badLast4 = JSON.parse(baseJson) as {
      data: { accounts: Record<string, unknown>[] };
    };
    badLast4.data.accounts[2].last4 = 'abc';
    expect(() => parseAndValidateBackup(JSON.stringify(badLast4))).toThrow(/Account row #3.*last4/);

    const badSameTransfer = JSON.parse(baseJson) as {
      data: { transfers: Record<string, unknown>[] };
    };
    badSameTransfer.data.transfers[0].toAccountId = badSameTransfer.data.transfers[0].fromAccountId;
    expect(() => parseAndValidateBackup(JSON.stringify(badSameTransfer))).toThrow(
      /Transfer row #1.*same_account/
    );

    const badTxAccountFk = JSON.parse(baseJson) as {
      data: { transactions: Record<string, unknown>[] };
    };
    badTxAccountFk.data.transactions[0].accountId = 'ghost-wallet';
    expect(() => parseAndValidateBackup(JSON.stringify(badTxAccountFk))).toThrow(
      /Transaction row #1.*ghost-wallet/
    );
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
