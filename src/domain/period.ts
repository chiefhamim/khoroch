import {
  addDays,
  diffDays,
  formatLocalDate,
  formatPeriodRange,
  formatShortDate,
  FULL_MONTHS_BY_LOCALE,
  parseLocalDate,
  toEpochDay,
  type DateLocale,
} from './dates';
import type { LocalDate, Period, PeriodKind } from './types';

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

/** The settings that decide the spending period. */
export interface PeriodConfig {
  periodKind: PeriodKind;
  /** 0 = Sunday up to 6 = Saturday. Used only when periodKind is 'week'. */
  weekStartDay: number;
  /** 1 to 28. Always the start of the monthly (bill) period. */
  monthStartDay: number;
}

function assertWeekStartDay(weekStartDay: number): void {
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    throw new Error(`weekStartDay must be an integer between 0 and 6, got ${weekStartDay}`);
  }
}

const LEGACY_WEEK_START_INDEX: Record<string, number> = { sunday: 0, monday: 1, saturday: 6 };

/**
 * The ONE effective first day of the week (0 = Sunday .. 6 = Saturday) for every consumer: the Home
 * and Plan week, the Ledger "This week" preset, the calendar strip and Insights.
 * A `weekStartDay` other than the default (6) was chosen by the user in Settings, so it wins.
 * Otherwise the older `weekStartsOn` ('saturday' | 'sunday' | 'monday') applies, so people who never
 * touched the row keep what they had. The Settings row writes both when the day is expressible.
 */
export function getEffectiveWeekStart(settings: {
  weekStartDay?: unknown;
  weekStartsOn?: unknown;
}): number {
  const raw = settings.weekStartDay;
  const day = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6 ? raw : 6;
  if (day !== 6) return day;
  const legacy = typeof settings.weekStartsOn === 'string' ? LEGACY_WEEK_START_INDEX[settings.weekStartsOn] : undefined;
  return legacy ?? 6;
}

/**
 * The 7 local days [start, start + 7) that begin on `weekStartDay` (0 = Sunday) and contain `today`.
 * Pure civil-calendar arithmetic on the date string: no clock, no timezone, no UTC drift.
 */
export function getWeekPeriod(today: LocalDate, weekStartDay: number): Period {
  assertWeekStartDay(weekStartDay);
  // 1970-01-01 (epoch day 0) was a Thursday, which is weekday 4 when Sunday is 0.
  const weekday = (((toEpochDay(today) + 4) % 7) + 7) % 7;
  const back = (((weekday - weekStartDay) % 7) + 7) % 7;
  const start = addDays(today, -back);
  return { start, endExcl: addDays(start, 7), lengthDays: 7 };
}

/**
 * The BILL period: always the monthly cycle from monthStartDay, whatever the spending period is.
 * Bills, the paid badge, Mark paid, EMI payoff, bill reminders and monthly budgets all use it.
 */
export function getBillPeriod(today: LocalDate, monthStartDay: number): Period {
  return getPeriod(today, monthStartDay);
}

/**
 * The SPENDING period containing `today`: the 7-day week in weekly mode, otherwise exactly the
 * monthly cycle. Totals, safe per day, days left, percent used, the Home hero and the Plan ring use it.
 */
export function getSpendingPeriod(today: LocalDate, config: PeriodConfig): Period {
  if (config.periodKind === 'week') return getWeekPeriod(today, config.weekStartDay);
  return getPeriod(today, config.monthStartDay);
}

/** The spending period immediately before `period`. */
export function previousSpendingPeriod(period: Period, config: PeriodConfig): Period {
  if (config.periodKind === 'week') return getWeekPeriod(addDays(period.start, -1), config.weekStartDay);
  return previousPeriod(period, config.monthStartDay);
}

/** `count` consecutive spending periods ending at the one containing `today`, oldest first. */
export function buildRecentSpendingWindows(
  today: LocalDate,
  config: PeriodConfig,
  count: number
): Period[] {
  if (config.periodKind !== 'week') return buildRecentPeriodWindows(today, config.monthStartDay, count);
  const n = Math.max(1, Math.floor(count));
  const out: Period[] = [];
  let cursor = getWeekPeriod(today, config.weekStartDay);
  out.push(cursor);
  for (let i = 1; i < n; i++) {
    cursor = previousSpendingPeriod(cursor, config);
    out.push(cursor);
  }
  return out.reverse();
}

/**
 * The two ends of a week's date range, ready for a "{from} to {to}" template:
 * "14" and "20 Nov" inside one month, "28 Nov" and "4 Dec" across a month boundary.
 */
export function formatWeekRangeParts(
  period: Period,
  locale: DateLocale = 'en'
): { from: string; to: string } {
  const endIncl = addDays(period.endExcl, -1);
  const a = parseLocalDate(period.start);
  const b = parseLocalDate(endIncl);
  const to = formatShortDate(endIncl, locale);
  if (a.year === b.year && a.month === b.month) return { from: String(a.day), to };
  return { from: formatShortDate(period.start, locale), to };
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
