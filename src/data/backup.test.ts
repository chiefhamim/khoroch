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

  await repo.insertPerson({
    id: 'p-rafi',
    name: 'Rafi',
    colorKey: 'blue',
    honorific: 'bhai',
    createdAt: 1731500550000,
    updatedAt: 1731500550000,
  });
  await repo.insertPerson({
    id: 'p-old',
    name: 'Old Friend',
    colorKey: 'gray',
    archivedAt: 1731500560000,
    createdAt: 1731500555000,
    updatedAt: 1731500560000,
  });
  await repo.insertDueEntry({
    id: 'd-rafi-1',
    personId: 'p-rafi',
    kind: 'lent',
    amountMinor: 200_000,
    accountId: 'bkash',
    occurredOn: '2026-11-09',
    dueOn: '2026-12-05',
    note: 'Book fair',
    createdAt: 1731500570000,
    updatedAt: 1731500570000,
  });
  await repo.insertDueEntry({
    id: 'd-rafi-del',
    personId: 'p-rafi',
    kind: 'received_back',
    amountMinor: 10_000,
    accountId: null,
    occurredOn: '2026-11-10',
    createdAt: 1731500580000,
    updatedAt: 1731500580000,
  });
  await repo.softDeleteDueEntry('d-rafi-del');

  await repo.setBudget('2026-11-01', '', 200000);
  await repo.setBudget('2026-11-01', 'food_dining', 45000);
  await repo.markDayReviewed('2026-11-10');
  await repo.markDayReviewed('2026-11-11');

  await repo.setSetting('name', 'Hamim');
  await repo.setSetting('avatarColorKey', 'violet');
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('language', 'bn');
  await repo.setSetting('monthStartDay', 15);
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('theme', 'dark');
  await repo.setSetting('accent', 'ocean');
  await repo.setSetting('hideAmountsOnOpen', true);
  await repo.setSetting('showPoisha', true);
  await repo.setSetting('compactNumbers', true);
  await repo.setSetting('weekStartsOn', 'monday');
  await repo.setSetting('homeSections', [
    { id: 'recent', visible: true },
    { id: 'wallets', visible: false },
    { id: 'dues', visible: true },
    { id: 'spending_chart', visible: true },
    { id: 'top_categories', visible: false },
  ]);
  await repo.setSetting('appLockEnabled', true);
  await repo.setSetting('appLockTimeoutSec', 60);
  await repo.setSetting('reminder', {
    enabled: true,
    time: '20:45',
    days: [0, 1, 2, 3, 4],
  });
  await repo.setSetting('lastBackupAt', 1731500999000);
  await repo.setSetting('speechDisclosureAccepted', true);
  await repo.setSetting('lastUsedAccountId', 'bkash');
  await repo.setSetting('pinnedAmounts', { expense: [20_000, 50_000], income: [1_000_000] });
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
      expect(preview.personCount).toBe(1);
      expect(preview.dueCount).toBe(1);
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
      expect(await dstSqlite.repo.listPeople({ includeArchived: true })).toEqual(
        await srcSqlite.repo.listPeople({ includeArchived: true })
      );
      expect(await dstSqlite.repo.listAllDueEntriesForBackup()).toEqual(
        await srcSqlite.repo.listAllDueEntriesForBackup()
      );
      expect(await dstSqlite.repo.listAllTransactionsForBackup()).toEqual(
        await srcSqlite.repo.listAllTransactionsForBackup()
      );
      expect(await dstSqlite.repo.getAllBudgets()).toEqual(await srcSqlite.repo.getAllBudgets());
      expect(await dstSqlite.repo.listAllDayReviews()).toEqual(
        await srcSqlite.repo.listAllDayReviews()
      );
      // An import never carries the app lock over: this device keeps its own values.
      expect(await dstSqlite.repo.getSettings()).toEqual({
        ...(await srcSqlite.repo.getSettings()),
        appLockEnabled: false,
        appLockTimeoutSec: 0,
      });
      expect((await dstSqlite.repo.getSettings()).pinnedAmounts).toEqual({
        expense: [20_000, 50_000],
        income: [1_000_000],
      });

      // Also verify MemoryRepo export -> deleteAllData() -> restore parity (TEST-CASES §C)
      const memSrc = new MemoryRepo();
      await seedComplexState(memSrc);
      const memJson = await exportBackupJson(memSrc, '2026-11-13T10:00:00.000Z');
      const memSnapshotBefore = {
        cats: await memSrc.listCategories({ includeArchived: true }),
        accounts: await memSrc.listAccounts({ includeArchived: true }),
        transfers: await memSrc.listAllTransfersForBackup(),
        people: await memSrc.listPeople({ includeArchived: true }),
        dues: await memSrc.listAllDueEntriesForBackup(),
        txs: await memSrc.listAllTransactionsForBackup(),
        budgets: await memSrc.getAllBudgets(),
        reviews: await memSrc.listAllDayReviews(),
        settings: await memSrc.getSettings(),
      };

      await memSrc.deleteAllData();
      expect(await memSrc.listAccounts({ includeArchived: true })).toEqual([]);
      expect(await memSrc.listAllTransfersForBackup()).toEqual([]);
      expect(await memSrc.listPeople({ includeArchived: true })).toEqual([]);
      expect(await memSrc.listAllDueEntriesForBackup()).toEqual([]);

      await restoreBackupPayload(memSrc, parseAndValidateBackup(memJson));
      expect(await memSrc.listCategories({ includeArchived: true })).toEqual(memSnapshotBefore.cats);
      expect(await memSrc.listAccounts({ includeArchived: true })).toEqual(memSnapshotBefore.accounts);
      expect(await memSrc.listAllTransfersForBackup()).toEqual(memSnapshotBefore.transfers);
      expect(await memSrc.listPeople({ includeArchived: true })).toEqual(memSnapshotBefore.people);
      expect(await memSrc.listAllDueEntriesForBackup()).toEqual(memSnapshotBefore.dues);
      expect(await memSrc.listAllTransactionsForBackup()).toEqual(memSnapshotBefore.txs);
      expect(await memSrc.getAllBudgets()).toEqual(memSnapshotBefore.budgets);
      expect(await memSrc.listAllDayReviews()).toEqual(memSnapshotBefore.reviews);
      expect(await memSrc.getSettings()).toEqual({
        ...memSnapshotBefore.settings,
        appLockEnabled: false,
        appLockTimeoutSec: 0,
      });
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
        people?: unknown;
        due_entries?: unknown;
        transactions: Record<string, unknown>[];
        budgets: Record<string, unknown>[];
        settings: Record<string, unknown>;
        day_reviews?: unknown;
      };
    };

    // Strip v3/v4-only fields to simulate a v2 backup
    const v2Raw = structuredClone(base);
    v2Raw.schema = 2;
    delete v2Raw.data.accounts;
    delete v2Raw.data.transfers;
    delete v2Raw.data.people;
    delete v2Raw.data.due_entries;
    v2Raw.data.categories = v2Raw.data.categories.filter((c) => c.id !== 'fees');
    for (const tx of v2Raw.data.transactions) {
      delete tx.accountId;
      delete tx.transferId;
    }
    const migratedV2 = parseAndValidateBackup(JSON.stringify(v2Raw));
    expect(migratedV2.schema).toBe(7);
    expect(migratedV2.data.accounts).toEqual([]);
    expect(migratedV2.data.transfers).toEqual([]);
    expect(migratedV2.data.people).toEqual([]);
    expect(migratedV2.data.due_entries).toEqual([]);
    expect(migratedV2.data.categories.some((c) => c.id === 'fees')).toBe(true);
    expect(migratedV2.data.transactions[0].accountId).toBeNull();
    expect(migratedV2.data.transactions[0].transferId).toBeNull();

    // Also simulate a v1 backup
    const v1Raw = structuredClone(base);
    v1Raw.schema = 1;
    delete v1Raw.data.accounts;
    delete v1Raw.data.transfers;
    delete v1Raw.data.people;
    delete v1Raw.data.due_entries;
    delete v1Raw.data.day_reviews;
    delete v1Raw.data.settings.lastBackupAt;
    delete v1Raw.data.settings.language;
    delete v1Raw.data.settings.speechDisclosureAccepted;
    delete v1Raw.data.settings.lastUsedAccountId;
    delete (v1Raw.data.settings as { pinnedAmounts?: unknown }).pinnedAmounts;
    delete v1Raw.data.settings.avatarColorKey;
    delete v1Raw.data.settings.hideAmountsOnOpen;
    delete v1Raw.data.settings.showPoisha;
    delete v1Raw.data.settings.compactNumbers;
    delete v1Raw.data.settings.weekStartsOn;
    delete v1Raw.data.settings.homeSections;
    delete v1Raw.data.settings.appLockEnabled;
    delete v1Raw.data.settings.appLockTimeoutSec;
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
    expect(migratedV1.schema).toBe(7);
    expect(migratedV1.data.day_reviews).toEqual([]);
    expect(migratedV1.data.accounts).toEqual([]);
    expect(migratedV1.data.transfers).toEqual([]);
    expect(migratedV1.data.people).toEqual([]);
    expect(migratedV1.data.due_entries).toEqual([]);
    expect(migratedV1.data.settings.lastBackupAt).toBeNull();
    expect(migratedV1.data.settings.language).toBe('en');
    expect(migratedV1.data.settings.speechDisclosureAccepted).toBe(false);
    expect(migratedV1.data.settings.lastUsedAccountId).toBeNull();
    expect(migratedV1.data.settings.pinnedAmounts).toEqual({ expense: [], income: [] });
    expect(migratedV1.data.settings.avatarColorKey).toBe('accent');
    expect(migratedV1.data.settings.hideAmountsOnOpen).toBe(false);
    expect(migratedV1.data.settings.showPoisha).toBe(false);
    expect(migratedV1.data.settings.compactNumbers).toBe(false);
    expect(migratedV1.data.settings.weekStartsOn).toBe('saturday');
    expect(migratedV1.data.settings.homeSections).toHaveLength(5);
    expect(migratedV1.data.settings.appLockEnabled).toBe(false);
    expect(migratedV1.data.settings.appLockTimeoutSec).toBe(0);
    const foodCat = migratedV1.data.categories.find((c) => c.id === 'food_dining');
    expect(foodCat?.icon).toBe('utensils');
    expect(foodCat?.colorKey).toBe(DEFAULT_CATEGORIES.find((c) => c.id === 'food_dining')?.colorKey);
  });

  it('exports the due date, imports older backups without it as null, and rejects a bad one', async () => {
    const src = createSqliteHarness();
    const dst = createSqliteHarness();
    try {
      await runMigrations(src.db);
      await runMigrations(dst.db);
      await seedComplexState(src.repo);

      const json = await exportBackupJson(src.repo, '2026-11-13T10:00:00.000Z');
      const parsed = parseAndValidateBackup(json);
      expect(parsed.data.due_entries.find((d) => d.id === 'd-rafi-1')?.dueOn).toBe('2026-12-05');
      expect(parsed.data.due_entries.find((d) => d.id === 'd-rafi-del')?.dueOn).toBeNull();

      // An older backup (schema 5) has no dueOn key at all.
      const old = JSON.parse(json) as {
        schema: number;
        data: { due_entries: Record<string, unknown>[] };
      };
      old.schema = 5;
      for (const row of old.data.due_entries) delete row.dueOn;
      const oldParsed = parseAndValidateBackup(JSON.stringify(old));
      expect(oldParsed.data.due_entries.every((d) => d.dueOn === null)).toBe(true);
      await restoreBackupPayload(dst.repo, oldParsed);
      const restored = await dst.repo.listAllDueEntriesForBackup();
      expect(restored).toHaveLength(2);
      expect(restored.find((d) => d.id === 'd-rafi-1')?.amountMinor).toBe(200_000);
      expect(restored.every((d) => d.dueOn === null)).toBe(true);

      const bad = JSON.parse(json) as { data: { due_entries: Record<string, unknown>[] } };
      bad.data.due_entries[0].dueOn = '2026-13-40';
      expect(() => parseAndValidateBackup(JSON.stringify(bad))).toThrow(/invalid_due_on/);
    } finally {
      src.close();
      dst.close();
    }
  });

  it('exports the default fee rate, imports older backups without it as null, and rejects a bad one', async () => {
    const src = createSqliteHarness();
    const dst = createSqliteHarness();
    try {
      await runMigrations(src.db);
      await runMigrations(dst.db);
      await seedComplexState(src.repo);
      await src.repo.updateAccount('bkash', { defaultFeeBp: 185 });

      const json = await exportBackupJson(src.repo, '2026-11-13T10:00:00.000Z');
      const parsed = parseAndValidateBackup(json);
      expect(parsed.schema).toBe(7);
      expect(parsed.data.accounts.find((a) => a.id === 'bkash')?.defaultFeeBp).toBe(185);
      expect(parsed.data.accounts.find((a) => a.id === 'cash')?.defaultFeeBp).toBeNull();

      await restoreBackupPayload(dst.repo, parsed);
      expect((await dst.repo.getAccount('bkash'))?.defaultFeeBp).toBe(185);
      expect((await dst.repo.getAccount('cash'))?.defaultFeeBp).toBeNull();

      // An older backup (schema 6) has no defaultFeeBp key at all.
      const old = JSON.parse(json) as {
        schema: number;
        data: { accounts: Record<string, unknown>[] };
      };
      old.schema = 6;
      for (const row of old.data.accounts) delete row.defaultFeeBp;
      const oldParsed = parseAndValidateBackup(JSON.stringify(old));
      expect(oldParsed.data.accounts.every((a) => a.defaultFeeBp === null)).toBe(true);
      await restoreBackupPayload(dst.repo, oldParsed);
      expect((await dst.repo.getAccount('bkash'))?.defaultFeeBp).toBeNull();
      expect((await dst.repo.getAccount('bkash'))?.openingBalanceMinor).toBe(1_000_000);

      const bad = JSON.parse(json) as { data: { accounts: Record<string, unknown>[] } };
      bad.data.accounts[0].defaultFeeBp = 12.5;
      expect(() => parseAndValidateBackup(JSON.stringify(bad))).toThrow(/invalid_default_fee/);
    } finally {
      src.close();
      dst.close();
    }
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

    const badDuePersonFk = JSON.parse(baseJson) as {
      data: { due_entries: Record<string, unknown>[] };
    };
    badDuePersonFk.data.due_entries[0].personId = 'ghost-person';
    expect(() => parseAndValidateBackup(JSON.stringify(badDuePersonFk))).toThrow(
      /Due row #1.*ghost-person/
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

  it('never changes the app lock settings on import, even from an old backup saying lock off', async () => {
    const src = new MemoryRepo();
    await seedComplexState(src);
    const raw = JSON.parse(await exportBackupJson(src, '2026-11-13T10:00:00.000Z'));
    raw.data.settings.appLockEnabled = false; // old backup: lock off, timeout 0
    raw.data.settings.appLockTimeoutSec = 0;

    // This device has the lock on (a credential exists) with a 5 minute timeout.
    const device = new MemoryRepo();
    await device.setSetting('appLockEnabled', true);
    await device.setSetting('appLockTimeoutSec', 300);
    await restoreBackupPayload(device, parseAndValidateBackup(JSON.stringify(raw)));
    const after = await device.getSettings();
    expect(after.appLockEnabled).toBe(true);
    expect(after.appLockTimeoutSec).toBe(300);
    expect(after.theme).toBe('dark'); // other settings still restore

    // And a backup saying lock on cannot switch it on where there is no lock.
    const plain = new MemoryRepo();
    await restoreBackupPayload(plain, parseAndValidateBackup(await exportBackupJson(src, '2026-11-13T10:00:00.000Z')));
    const plainAfter = await plain.getSettings();
    expect(plainAfter.appLockEnabled).toBe(false);
    expect(plainAfter.appLockTimeoutSec).toBe(0);
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

  it('exports with app id khoroch and still imports legacy budget-app backups', async () => {
    const mem = new MemoryRepo();
    const exported = JSON.parse(await exportBackupJson(mem)) as Record<string, unknown>;
    expect(exported.app).toBe('khoroch');

    const legacyBudgetApp = parseAndValidateBackup(JSON.stringify({ ...exported, app: 'budget-app' }));
    expect(legacyBudgetApp.app).toBe('khoroch');

    const legacyLenDen = parseAndValidateBackup(JSON.stringify({ ...exported, app: 'lenden' }));
    expect(legacyLenDen.app).toBe('khoroch');
  });
});
