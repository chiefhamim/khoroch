import { t } from '@/i18n';

/**
 * Words for a due date relative to today. `days` is nextDueOn minus today:
 * negative = overdue, 0 = today, positive = still ahead.
 */
export function dueStatusText(days: number): string {
  if (days < 0) {
    const n = -days;
    return n === 1 ? t('due.overdueByOne') : t('due.overdueByMany', { count: n });
  }
  if (days === 0) return t('due.dueToday');
  return days === 1 ? t('due.dueInOne') : t('due.dueInMany', { count: days });
}

/** People list shows an upcoming due date only when it is this close. */
export const DUE_SOON_DAYS = 7;
