import {
  addDays,
  daysInMonth,
  diffDays,
  fromEpochDay,
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
});
