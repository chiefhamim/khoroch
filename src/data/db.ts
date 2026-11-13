import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { MemoryRepo } from './memoryRepo';
import { runMigrations } from './migrations';
import type { Repo } from './repo';
import { SqliteRepo } from './sqliteRepo';

let repoPromise: Promise<{ repo: Repo; backend: 'sqlite' | 'memory' }> | null = null;

export async function initRepo(): Promise<{ repo: Repo; backend: 'sqlite' | 'memory' }> {
  if (repoPromise) return repoPromise;

  const pending = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('budget.db');
      await runMigrations(db);
      return { repo: new SqliteRepo(db), backend: 'sqlite' as const };
    } catch (err) {
      if (Platform.OS === 'web') {
        console.warn('expo-sqlite unavailable on web, falling back to MemoryRepo:', err);
        return { repo: new MemoryRepo(), backend: 'memory' as const };
      }
      throw err;
    }
  })().catch((err) => {
    // S3: clear rejected cache so a user-triggered retry can attempt init again.
    if (repoPromise === pending) {
      repoPromise = null;
    }
    throw err;
  });

  repoPromise = pending;
  return pending;
}

export function resetRepoForTests(): void {
  repoPromise = null;
}
