import type { SQLiteDatabase } from 'expo-sqlite';
import { MemoryRepo } from './memoryRepo';
import { runMigrations } from './migrations';
import { SqliteRepo } from './sqliteRepo';

type BindValue = string | number | null;

function createRawNodeSqlite(): {
  native: {
    exec: (sql: string) => void;
    close: () => void;
    prepare: (sql: string) => {
      run: (...params: BindValue[]) => { lastInsertRowid: number; changes: number };
      get: (...params: BindValue[]) => unknown;
      all: (...params: BindValue[]) => unknown[];
    };
  };
  db: SQLiteDatabase;
  execCalls: string[];
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
  const execCalls: string[] = [];

  const db = {
    execAsync: async (sql: string) => {
      execCalls.push(sql);
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

  return { native, db, execCalls };
}

describe('Phase 14 security & data safety hardening (S3, S4, S8, S9)', () => {
  it('S3: initRepo clears failed repoPromise so retry can recover cleanly', async () => {
    const harness = createRawNodeSqlite();
    const openSpy = jest.fn<Promise<SQLiteDatabase>, [string]>();
    openSpy
      .mockRejectedValueOnce(new Error('transient sqlite open error'))
      .mockResolvedValueOnce(harness.db);

    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('expo-sqlite', () => ({
      openDatabaseAsync: openSpy,
    }));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initRepo, resetRepoForTests } = require('./db') as typeof import('./db');
      resetRepoForTests();

      await expect(initRepo()).rejects.toThrow('transient sqlite open error');
      const recovered = await initRepo();
      expect(recovered.backend).toBe('sqlite');
      expect(openSpy).toHaveBeenCalledTimes(2);
    } finally {
      jest.dontMock('react-native');
      jest.dontMock('expo-sqlite');
      jest.resetModules();
      harness.native.close();
    }
  });

  it('S4: runDeleteAllData clears repository state and cancels scheduled OS reminders', async () => {
    const cancelMock = jest.fn(async () => {});
    jest.resetModules();
    jest.doMock('@/notifications/reminders', () => ({
      cancelAllReminders: cancelMock,
    }));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runDeleteAllData } = require('./deleteAll') as typeof import('./deleteAll');
      const repo = new MemoryRepo();
      await repo.insertTransaction({
        id: 'tx-wipe-me',
        type: 'expense',
        amountMinor: 500,
        currency: 'BDT',
        categoryId: 'food_dining',
        occurredOn: '2026-11-10',
      });

      await runDeleteAllData(repo);

      expect(cancelMock).toHaveBeenCalledTimes(1);
      expect(await repo.listAllTransactionsForBackup()).toEqual([]);
      expect((await repo.getSettings()).onboardingDone).toBe(false);
    } finally {
      jest.dontMock('@/notifications/reminders');
      jest.resetModules();
    }
  });

  it('S8: SqliteRepo survives malformed JSON in reminder settings and seeded periods metadata', async () => {
    const harness = createRawNodeSqlite();
    try {
      await runMigrations(harness.db);
      harness.native
        .prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('reminder', '{bad json'), ('_budget_periods_seeded', '{bad json')"
        )
        .run();

      const repo = new SqliteRepo(harness.db);
      const settings = await repo.getSettings();
      expect(settings.reminder.enabled).toBe(false);

      await expect(repo.ensureBudgetsForPeriod('2026-11-01', '2026-10-01')).resolves.toBeUndefined();
    } finally {
      harness.native.close();
    }
  });

  it('S9: SqliteRepo deleteAllData executes WAL checkpoint and VACUUM after clearing rows', async () => {
    const harness = createRawNodeSqlite();
    try {
      await runMigrations(harness.db);
      const repo = new SqliteRepo(harness.db);
      await repo.insertTransaction({
        id: 'tx-to-vacuum',
        type: 'expense',
        amountMinor: 2500,
        currency: 'BDT',
        categoryId: 'food_dining',
        occurredOn: '2026-11-10',
      });

      await repo.deleteAllData();

      expect(await repo.listAllTransactionsForBackup()).toEqual([]);
      expect(harness.execCalls.some((sql) => sql.includes('VACUUM'))).toBe(true);
    } finally {
      harness.native.close();
    }
  });
});
