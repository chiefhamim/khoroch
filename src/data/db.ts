import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { MemoryRepo } from './memoryRepo';
import { runMigrations } from './migrations';
import type { Repo } from './repo';
import { SqliteRepo } from './sqliteRepo';

let repoPromise: Promise<{ repo: Repo; backend: 'sqlite' | 'memory' }> | null = null;

export async function initRepo(): Promise<{ repo: Repo; backend: 'sqlite' | 'memory' }> {
  if (repoPromise) return repoPromise;

  repoPromise = (async () => {
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
  })();

  return repoPromise;
}

export function resetRepoForTests(): void {
  repoPromise = null;
}
