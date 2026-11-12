import { addDays, diffDays, formatLocalDate, parseLocalDate } from './dates';
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
