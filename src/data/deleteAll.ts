import type { Repo } from '@/data/repo';
import { markErasedThenFailed } from '@/data/eraseError';
import { cancelAllReminders } from '@/notifications/reminders';
import { appLock } from '@/security/appLock';

/**
 * Deletes every row in local storage and clears any scheduled OS reminders so
 * wiped installs do not continue firing notifications after reset.
 */
export async function runDeleteAllData(repo: Repo): Promise<void> {
  await repo.deleteAllData();
  // From here on the data is gone. A failure below is tagged so the caller can say so plainly.
  try {
    await cancelAllReminders();
    // The PIN lives in secure storage, outside the database: wipe it too (each entry is retried).
    await appLock.clearAll();
  } catch (e) {
    throw markErasedThenFailed(e);
  }
}
