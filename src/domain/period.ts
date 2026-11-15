import {
  addDays,
  diffDays,
  formatLocalDate,
  formatPeriodRange,
  FULL_MONTHS_BY_LOCALE,
  parseLocalDate,
  type DateLocale,
} from './dates';
import type { LocalDate, Period } from './types';

function assertMonthStartDay(monthStartDay: number): void {
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) {
    throw new Error(`monthStartDay must be an integer between 1 and 28, got ${monthStartDay}`);
  }
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12 + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Returns the budget period [start, endExcl) containing `today` for a given monthStartDay (1..28).
 */
export function getPeriod(today: LocalDate, monthStartDay: number): Period {
  assertMonthStartDay(monthStartDay);
  const { year, month, day } = parseLocalDate(today);

  let startYM: { year: number; month: number };
  let endYM: { year: number; month: number };

  if (day >= monthStartDay) {
    startYM = { year, month };
    endYM = shiftMonth(year, month, 1);
  } else {
    startYM = shiftMonth(year, month, -1);
    endYM = { year, month };
  }

  const start = formatLocalDate(startYM.year, startYM.month, monthStartDay);
  const endExcl = formatLocalDate(endYM.year, endYM.month, monthStartDay);
  const lengthDays = diffDays(endExcl, start);

  return { start, endExcl, lengthDays };
}

/** Returns the budget period immediately preceding `period`. */
export function previousPeriod(period: Period, monthStartDay: number): Period {
  assertMonthStartDay(monthStartDay);
  return getPeriod(addDays(period.start, -1), monthStartDay);
}

/**
 * Elapsed days from period.start through `today` inclusive, clamped to [0, period.lengthDays].
 */
export function elapsedDays(period: Period, today: LocalDate): number {
  if (today < period.start) return 0;
  if (today >= period.endExcl) return period.lengthDays;
  return diffDays(today, period.start) + 1;
}

/**
 * Remaining days from `today` inclusive through period end, clamped to [0, period.lengthDays].
 */
export function remainingDays(period: Period, today: LocalDate): number {
  if (today < period.start) return period.lengthDays;
  if (today >= period.endExcl) return 0;
  return diffDays(period.endExcl, today);
}

/**
 * Returns `count` consecutive periods ending at `getPeriod(today, monthStartDay)` ordered oldest to newest.
 */
export function buildRecentPeriodWindows(
  today: LocalDate,
  monthStartDay: number,
  count: number
): Period[] {
  const n = Math.max(1, Math.floor(count));
  const out: Period[] = [];
  let cursor = getPeriod(today, monthStartDay);
  out.push(cursor);
  for (let i = 1; i < n; i++) {
    cursor = previousPeriod(cursor, monthStartDay);
    out.push(cursor);
  }
  return out.reverse();
}

export interface FormatCycleLabelOptions {
  includeYear?: boolean;
  locale?: DateLocale;
}

/**
 * Formats a budget period as its calendar month name when `monthStartDay === 1`
 * (e.g. "November"), or as an inclusive short date range otherwise (e.g. "10 Oct – 9 Nov").
 */
export function formatCycleLabel(
  period: Period,
  monthStartDay: number,
  options?: FormatCycleLabelOptions
): string {
  assertMonthStartDay(monthStartDay);
  const locale = options?.locale ?? 'en';
  const { year, month } = parseLocalDate(period.start);
  if (monthStartDay === 1) {
    const monthName = FULL_MONTHS_BY_LOCALE[locale][month - 1];
    return options?.includeYear ? `${monthName} ${year}` : monthName;
  }
  const range = formatPeriodRange(period.start, period.endExcl, locale);
  if (!options?.includeYear) {
    return range;
  }
  const endYear = parseLocalDate(addDays(period.endExcl, -1)).year;
  return year === endYear ? `${range} ${year}` : `${range} (${year}/${endYear})`;
}

/**
 * Returns true during the first 7 days of a cycle when the prior cycle had spending > 0.
 */
export function shouldShowNewCycleHint(
  period: Period,
  today: LocalDate,
  previousCycleSpentMinor: number
): boolean {
  if (previousCycleSpentMinor <= 0) return false;
  const elapsed = elapsedDays(period, today);
  return elapsed >= 1 && elapsed <= 7;
}
