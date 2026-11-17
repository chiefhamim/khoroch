import type { Repo } from '@/data/repo';
import { cancelAllReminders } from '@/notifications/reminders';
import { appLock } from '@/security/appLock';

/**
 * Deletes every row in local storage and clears any scheduled OS reminders so
 * wiped installs do not continue firing notifications after reset.
 */
export async function runDeleteAllData(repo: Repo): Promise<void> {
  await repo.deleteAllData();
  await cancelAllReminders();
  // The PIN lives in secure storage, outside the database: wipe it too.
  await appLock.clearAll().catch(() => {});
}
