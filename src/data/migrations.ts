import type { SQLiteDatabase } from 'expo-sqlite';
import {
  buildDefaultCategories,
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_BY_ID,
} from '@/domain/categories';

export const LATEST_SCHEMA_VERSION = 7;

export const SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('expense','income')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_selected INTEGER NOT NULL DEFAULT 1,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('expense','income')),
  amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 99999999999),
  currency      TEXT NOT NULL,
  category_id   TEXT REFERENCES categories(id),
  description   TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  occurred_on   TEXT NOT NULL,
  occurred_time TEXT,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','quick','voice','sample')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions (deleted_at, occurred_on);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category_id, occurred_on);

CREATE TABLE IF NOT EXISTS budgets (
  period_start TEXT NOT NULL,
  category_id  TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (period_start, category_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS day_reviews (
  day         TEXT PRIMARY KEY,
  reviewed_at INTEGER NOT NULL
);
`;

export async function seedDefaultCategoriesSqlite(
  db: SQLiteDatabase,
  nowMs: number = Date.now()
): Promise<void> {
  const defaults = buildDefaultCategories(nowMs);
  for (const cat of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cat.id,
        cat.name,
        cat.icon,
        cat.colorKey,
        cat.kind,
        cat.sortOrder,
        cat.isSelected ? 1 : 0,
        cat.archivedAt,
        cat.createdAt,
      ]
    );
  }
}

/**
 * Runs every pending migration step. `targetVersion` exists only so tests can stop the real
 * chain at an older schema version; the app always calls this with no argument.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  targetVersion: number = LATEST_SCHEMA_VERSION
): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {
    // Some web SQLite environments ignore or disallow WAL; safe to continue.
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= targetVersion) {
    return;
  }

  if (version < 1 && targetVersion >= 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V1_SQL);
      await db.execAsync('PRAGMA user_version = 1;');
    });
    version = 1;
  }

  if (version < 2 && targetVersion >= 2) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(categories)');
      const hasColorKey = columns.some((c) => c.name === 'color_key');
      if (!hasColorKey) {
        await db.execAsync('ALTER TABLE categories ADD COLUMN color_key TEXT;');
      }

      await seedDefaultCategoriesSqlite(db, Date.now());

      for (const def of DEFAULT_CATEGORIES) {
        await db.runAsync(
          `UPDATE categories
           SET color_key = COALESCE(NULLIF(color_key, ''), ?),
               icon = CASE WHEN icon = ? OR icon IS NULL OR icon = '' THEN ? ELSE icon END
           WHERE id = ?`,
          [def.colorKey, def.v1Icon, def.icon, def.id]
        );
      }

      await db.runAsync(
        `UPDATE categories SET color_key = 'gray' WHERE color_key IS NULL OR color_key = ''`
      );

      await db.execAsync('PRAGMA user_version = 2;');
    });
    version = 2;
  }

  if (version < 3 && targetVersion >= 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('cash','mobile_wallet','bank','credit_card','other')),
          provider TEXT,
          color_key TEXT NOT NULL,
          monogram TEXT,
          last4 TEXT,
          opening_balance_minor INTEGER NOT NULL DEFAULT 0,
          opening_date TEXT NOT NULL,
          include_in_total INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          archived_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transfers (
          id TEXT PRIMARY KEY,
          from_account_id TEXT NOT NULL REFERENCES accounts(id),
          to_account_id TEXT NOT NULL REFERENCES accounts(id),
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
          occurred_on TEXT NOT NULL,
          occurred_time TEXT,
          note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          CHECK (from_account_id <> to_account_id)
        );
      `);

      const txCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
      if (!txCols.some((c) => c.name === 'account_id')) {
        await db.execAsync('ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id);');
      }
      if (!txCols.some((c) => c.name === 'transfer_id')) {
        await db.execAsync('ALTER TABLE transactions ADD COLUMN transfer_id TEXT;');
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id, occurred_on);
        CREATE INDEX IF NOT EXISTS idx_tr_date ON transfers (deleted_at, occurred_on);
      `);

      const feesDef = DEFAULT_CATEGORY_BY_ID.fees;
      if (feesDef) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories (id, name, icon, color_key, kind, sort_order, is_selected, archived_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            feesDef.id,
            feesDef.name,
            feesDef.icon,
            feesDef.colorKey,
            feesDef.kind,
            feesDef.sortOrder,
            1,
            null,
            Date.now(),
          ]
        );
      }

      await db.execAsync('PRAGMA user_version = 3;');
    });
    version = 3;
  }

  if (version < 4 && targetVersion >= 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS people (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color_key TEXT NOT NULL,
          honorific TEXT NOT NULL DEFAULT 'none' CHECK (honorific IN ('none','bhai','apu')),
          archived_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS due_entries (
          id TEXT PRIMARY KEY,
          person_id TEXT NOT NULL REFERENCES people(id),
          kind TEXT NOT NULL CHECK (kind IN ('lent','borrowed','received_back','paid_back')),
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          account_id TEXT REFERENCES accounts(id),
          occurred_on TEXT NOT NULL,
          occurred_time TEXT,
          note TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_due_person ON due_entries (person_id, deleted_at, occurred_on);
        PRAGMA user_version = 4;
      `);
    });
    version = 4;
  }

  if (version < 5 && targetVersion >= 5) {
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          CREATE TABLE accounts_v5 (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('cash','mobile_wallet','bank','credit_card','dps','fdr','sanchaypatra','investment','other')),
            provider TEXT,
            color_key TEXT NOT NULL,
            monogram TEXT,
            last4 TEXT,
            opening_balance_minor INTEGER NOT NULL DEFAULT 0,
            opening_date TEXT NOT NULL,
            include_in_total INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            archived_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
          INSERT INTO accounts_v5 (
            id, name, kind, provider, color_key, monogram, last4,
            opening_balance_minor, opening_date, include_in_total,
            sort_order, archived_at, created_at, updated_at
          )
          SELECT
            id, name, kind, provider, color_key, monogram, last4,
            opening_balance_minor, opening_date, include_in_total,
            sort_order, archived_at, created_at, updated_at
          FROM accounts;
          DROP TABLE accounts;
          ALTER TABLE accounts_v5 RENAME TO accounts;

          CREATE TABLE transactions_v5 (
            id            TEXT PRIMARY KEY,
            type          TEXT NOT NULL CHECK (type IN ('expense','income')),
            amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 99999999999),
            currency      TEXT NOT NULL,
            category_id   TEXT REFERENCES categories(id),
            account_id    TEXT REFERENCES accounts(id),
            transfer_id   TEXT,
            description   TEXT NOT NULL DEFAULT '',
            note          TEXT NOT NULL DEFAULT '',
            occurred_on   TEXT NOT NULL,
            occurred_time TEXT,
            source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','quick','voice','capture','sample')),
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL,
            deleted_at    INTEGER
          );
          INSERT INTO transactions_v5 (
            id, type, amount_minor, currency, category_id, account_id, transfer_id,
            description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at
          )
          SELECT
            id, type, amount_minor, currency, category_id, account_id, transfer_id,
            description, note, occurred_on, occurred_time, source, created_at, updated_at, deleted_at
          FROM transactions;
          DROP TABLE transactions;
          ALTER TABLE transactions_v5 RENAME TO transactions;
          CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions (deleted_at, occurred_on);
          CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions (category_id, occurred_on);
          CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions (account_id, occurred_on);

          CREATE TABLE IF NOT EXISTS recurring_bills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('bill','emi','subscription','salary')),
            amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
            day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
            category_id TEXT REFERENCES categories(id),
            account_id TEXT REFERENCES accounts(id),
            total_installments INTEGER,
            paid_installments INTEGER NOT NULL DEFAULT 0,
            last_paid_period TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS pending_drafts (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL CHECK (source IN ('notification','statement_pdf','statement_csv','ocr_receipt','share_text')),
            fingerprint TEXT NOT NULL UNIQUE,
            draft_kind TEXT NOT NULL DEFAULT 'transaction' CHECK (draft_kind IN ('transaction','transfer')),
            type TEXT NOT NULL CHECK (type IN ('expense','income')),
            amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
            fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
            category_id TEXT,
            account_id TEXT,
            from_account_id TEXT,
            to_account_id TEXT,
            description TEXT NOT NULL DEFAULT '',
            raw_text TEXT NOT NULL DEFAULT '',
            trx_id TEXT,
            occurred_on TEXT NOT NULL,
            occurred_time TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dismissed')),
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_drafts (status, occurred_on);

          PRAGMA user_version = 5;
        `);
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }
    version = 5;
  }

  if (version < 6 && targetVersion >= 6) {
    // Additive only: one nullable column, no table rebuild.
    await db.withTransactionAsync(async () => {
      const dueCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(due_entries)');
      if (!dueCols.some((c) => c.name === 'due_on')) {
        await db.execAsync('ALTER TABLE due_entries ADD COLUMN due_on TEXT;');
      }
      await db.execAsync('PRAGMA user_version = 6;');
    });
    version = 6;
  }

  if (version < 7 && targetVersion >= 7) {
    // Additive only: one nullable column holding the default transfer fee in basis points of a percent.
    await db.withTransactionAsync(async () => {
      const accCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(accounts)');
      if (!accCols.some((c) => c.name === 'default_fee_bp')) {
        await db.execAsync(
          'ALTER TABLE accounts ADD COLUMN default_fee_bp INTEGER CHECK (default_fee_bp IS NULL OR (default_fee_bp >= 0 AND default_fee_bp <= 10000));'
        );
      }
      await db.execAsync('PRAGMA user_version = 7;');
    });
    version = 7;
  }
}
