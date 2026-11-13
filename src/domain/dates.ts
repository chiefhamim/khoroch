import type { LocalDate } from './types';

export interface DateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseLocalDate(date: LocalDate): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid LocalDate format: ${date}`);
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return { year, month, day };
}

export function isValidLocalDate(date: string): date is LocalDate {
  try {
    parseLocalDate(date);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a LocalDate to days since 1970-01-01 using pure civil calendar math
 * (Howard Hinnant's algorithm) with zero local timezone / DST dependency.
 */
export function toEpochDay(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDay(epochDay: number): LocalDate {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const year = y + (m <= 2 ? 1 : 0);
  return formatLocalDate(year, m, d);
}

export function addDays(date: LocalDate, deltaDays: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + deltaDays);
}

/** Returns (a - b) in whole calendar days. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

/** Returns local calendar date of `now` (defaults to current system time). */
export function todayLocalDate(now: Date = new Date()): LocalDate {
  return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function minLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

const SHORT_WEEKDAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'] as const;
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatShortDate(date: LocalDate): string {
  const { month, day } = parseLocalDate(date);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

export function formatShortMonthYear(date: LocalDate): string {
  const { year, month } = parseLocalDate(date);
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}

export function formatWeekdayShortDate(date: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  const epochDay = toEpochDay(date);
  const weekdayIdx = ((epochDay % 7) + 7) % 7;
  return `${SHORT_WEEKDAYS[weekdayIdx]}, ${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

export function formatPeriodRange(start: LocalDate, endExcl: LocalDate): string {
  const endIncl = addDays(endExcl, -1);
  return `${formatShortDate(start)} – ${formatShortDate(endIncl)}`;
}

/**
 * Formats a LocalDate for pills and headers: "Today", "Yesterday", or "Wed, 11 Nov"
 * (appending the year if it differs from `today`'s year).
 */
export function formatFriendlyDate(
  date: LocalDate,
  today: LocalDate = todayLocalDate()
): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  const { year, month, day } = parseLocalDate(date);
  const { year: todayYear } = parseLocalDate(today);
  const epochDay = toEpochDay(date);
  const weekdayIdx = ((epochDay % 7) + 7) % 7;
  const base = `${SHORT_WEEKDAYS[weekdayIdx]}, ${day} ${SHORT_MONTHS[month - 1]}`;
  return year === todayYear ? base : `${base} ${year}`;
}

export function currentLocalTime(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function isDevice24HourClock(): boolean {
  try {
    const resolved = Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    if (resolved.hourCycle === 'h23' || resolved.hourCycle === 'h24') return true;
    if (resolved.hourCycle === 'h11' || resolved.hourCycle === 'h12') return false;
    return resolved.hour12 === false;
  } catch {
    return false;
  }
}

/**
 * Formats an 'HH:mm' local time string into 24-hour ("13:20") or 12-hour ("1:20 PM").
 */
export function formatFriendlyTime(
  time: string,
  use24Hour: boolean = isDevice24HourClock()
): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return time;

  const minStr = String(minute).padStart(2, '0');
  if (use24Hour) {
    return `${String(hour).padStart(2, '0')}:${minStr}`;
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minStr} ${period}`;
}
