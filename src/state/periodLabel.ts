import { formatCycleLabel, formatWeekRangeParts } from '@/domain/period';
import type { Period, Settings } from '@/domain/types';
import { t, type Locale } from '@/i18n';

/**
 * The label for a spending period. Weekly mode reads as a date range ("14 to 20 Nov"); monthly mode is
 * exactly `formatCycleLabel` (month name, or the short date range for a custom start day).
 */
export function formatSpendingPeriodLabel(
  period: Period,
  settings: Pick<Settings, 'periodKind' | 'monthStartDay'>,
  locale: Locale
): string {
  if (settings.periodKind === 'week') {
    const { from, to } = formatWeekRangeParts(period, locale);
    return t('period.weekRange', { from, to });
  }
  return formatCycleLabel(period, settings.monthStartDay, { locale });
}
