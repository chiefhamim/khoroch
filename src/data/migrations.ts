import type { SQLiteDatabase } from 'expo-sqlite';
import { buildDefaultCategories } from '@/domain/categories';

export const LATEST_SCHEMA_VERSION = 1;

const SCHEMA_V1_SQL = `
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

export async function seedDefaultCategoriesSqlite(db: SQLiteDatabase, nowMs: number = Date.now()): Promise<void> {
  const defaults = buildDefaultCategories(nowMs);
  for (const cat of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, icon, kind, sort_order, is_selected, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.name, cat.icon, cat.kind, cat.sortOrder, cat.isSelected ? 1 : 0, cat.archivedAt, cat.createdAt]
    );
  }
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {
    // Some web SQLite environments ignore or disallow WAL; safe to continue.
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= LATEST_SCHEMA_VERSION) {
    return;
  }

  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V1_SQL);
      await seedDefaultCategoriesSqlite(db, Date.now());
      await db.execAsync('PRAGMA user_version = 1;');
    });
    version = 1;
  }
}
