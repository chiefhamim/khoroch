import {
  addDays,
  currentLocalTime,
  daysInMonth,
  diffDays,
  formatFriendlyDate,
  formatFriendlyTime,
  fromEpochDay,
  getStartOfWeek,
  getWeekRange,
  isLeapYear,
  isValidLocalDate,
  toEpochDay,
} from './dates';

describe('dates', () => {
  it('validates leap years and days in month', () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
  });

  it('round-trips epoch days and adds/diffs calendar days cleanly', () => {
    expect(fromEpochDay(toEpochDay('2026-11-13'))).toBe('2026-11-13');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(diffDays('2026-12-01', '2026-11-01')).toBe(30);
  });

  it('formats friendly dates for Today, Yesterday, same year, and other years', () => {
    const today = '2026-11-13'; // Friday
    expect(formatFriendlyDate('2026-11-13', today)).toBe('Today');
    expect(formatFriendlyDate('2026-11-12', today)).toBe('Yesterday');
    expect(formatFriendlyDate('2026-11-11', today)).toBe('Wed, 11 Nov');
    expect(formatFriendlyDate('2026-11-09', today)).toBe('Mon, 9 Nov');
    expect(formatFriendlyDate('2025-12-25', today)).toBe('Thu, 25 Dec 2025');
  });

  it('formats 12-hour and 24-hour times cleanly', () => {
    expect(formatFriendlyTime('00:05', false)).toBe('12:05 AM');
    expect(formatFriendlyTime('09:02', false)).toBe('9:02 AM');
    expect(formatFriendlyTime('12:00', false)).toBe('12:00 PM');
    expect(formatFriendlyTime('13:20', false)).toBe('1:20 PM');
    expect(formatFriendlyTime('21:00', false)).toBe('9:00 PM');

    expect(formatFriendlyTime('00:05', true)).toBe('00:05');
    expect(formatFriendlyTime('9:02', true)).toBe('09:02');
    expect(formatFriendlyTime('13:20', true)).toBe('13:20');
    expect(formatFriendlyTime('21:00', true)).toBe('21:00');
    expect(formatFriendlyTime('invalid', false)).toBe('invalid');
  });

  it('formats currentLocalTime from local wall clock', () => {
    const d = new Date(2026, 10, 13, 8, 5);
    expect(currentLocalTime(d)).toBe('08:05');
  });

  it('resolves start of week and 7-day range for Saturday, Sunday, and Monday', () => {
    const friday = '2026-11-13';
    expect(getStartOfWeek(friday)).toBe('2026-11-07');
    expect(getWeekRange(friday)).toEqual({ start: '2026-11-07', endExcl: '2026-11-14' });

    expect(getStartOfWeek(friday, 'sunday')).toBe('2026-11-08');
    expect(getWeekRange(friday, 'sunday')).toEqual({ start: '2026-11-08', endExcl: '2026-11-15' });

    expect(getStartOfWeek(friday, 'monday')).toBe('2026-11-09');
    expect(getWeekRange(friday, 'monday')).toEqual({ start: '2026-11-09', endExcl: '2026-11-16' });

    const saturday = '2026-11-14';
    expect(getStartOfWeek(saturday, 'saturday')).toBe('2026-11-14');
    expect(getStartOfWeek(saturday, 'sunday')).toBe('2026-11-08');
  });
});
