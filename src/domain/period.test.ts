import { addDays } from './dates';
import {
  elapsedDays,
  formatCycleLabel,
  getPeriod,
  previousPeriod,
  remainingDays,
  shouldShowNewCycleHint,
} from './period';

describe('periods (TEST-CASES §2)', () => {
  const cases: [string, number, string, string, number, number, number][] = [
    ['2026-11-13', 1, '2026-11-01', '2026-12-01', 30, 13, 18],
    ['2026-11-01', 1, '2026-11-01', '2026-12-01', 30, 1, 30],
    ['2026-11-30', 1, '2026-11-01', '2026-12-01', 30, 30, 1],
    ['2028-02-29', 1, '2028-02-01', '2028-03-01', 29, 29, 1],
    ['2026-02-15', 1, '2026-02-01', '2026-03-01', 28, 15, 14],
    ['2026-11-13', 25, '2026-10-25', '2026-11-25', 31, 20, 12],
    ['2026-11-25', 25, '2026-11-25', '2026-12-25', 30, 1, 30],
    ['2026-03-01', 28, '2026-02-28', '2026-03-28', 28, 2, 27],
    ['2027-01-05', 1, '2027-01-01', '2027-02-01', 31, 5, 27],
  ];

  it.each(cases)(
    'today=%s msd=%i -> %s..%s len=%i elapsed=%i remaining=%i',
    (today, msd, start, endExcl, length, elapsed, remaining) => {
      const p = getPeriod(today, msd);
      expect(p).toEqual({ start, endExcl, lengthDays: length });
      expect(elapsedDays(p, today)).toBe(elapsed);
      expect(remainingDays(p, today)).toBe(remaining);
    }
  );

  it('computes previousPeriod across year boundaries', () => {
    const jan = getPeriod('2027-01-05', 1);
    expect(previousPeriod(jan, 1)).toEqual({
      start: '2026-12-01',
      endExcl: '2027-01-01',
      lengthDays: 31,
    });
  });

  it('throws when monthStartDay is outside 1..28', () => {
    expect(() => getPeriod('2026-11-13', 0)).toThrow();
    expect(() => getPeriod('2026-11-13', 29)).toThrow();
    expect(() => getPeriod('2026-11-13', 1.5)).toThrow();
  });

  it('satisfies property invariants across every day of 2026-2028 x monthStartDay 1..28', () => {
    let day = '2026-01-01';
    const endDay = '2029-01-01';
    let checked = 0;

    while (day < endDay) {
      for (let msd = 1; msd <= 28; msd++) {
        const p = getPeriod(day, msd);
        const e = elapsedDays(p, day);
        const r = remainingDays(p, day);
        expect(p.start <= day && day < p.endExcl).toBe(true);
        expect(e + r).toBe(p.lengthDays + 1);
        checked++;
      }
      day = addDays(day, 1);
    }

    expect(checked).toBe((365 + 365 + 366) * 28);
  });
});

describe('formatCycleLabel', () => {
  it('returns the full month name when monthStartDay is 1', () => {
    const nov = getPeriod('2026-11-13', 1);
    expect(formatCycleLabel(nov, 1)).toBe('November');
    expect(formatCycleLabel(nov, 1, { includeYear: true })).toBe('November 2026');

    const jan = getPeriod('2027-01-01', 1);
    expect(formatCycleLabel(jan, 1)).toBe('January');
  });

  it('returns "start – endIncl" for non-1 start days including year boundaries', () => {
    const octNov = getPeriod('2026-11-05', 10);
    expect(formatCycleLabel(octNov, 10)).toBe('10 Oct – 9 Nov');

    const decJan = getPeriod('2026-12-20', 10);
    expect(formatCycleLabel(decJan, 10)).toBe('10 Dec – 9 Jan');
    expect(formatCycleLabel(decJan, 10, { includeYear: true })).toBe(
      '10 Dec – 9 Jan (2026/2027)'
    );
  });
});

describe('shouldShowNewCycleHint', () => {
  it('shows only when elapsed is 1..7 and previous cycle had spending', () => {
    const cycle = getPeriod('2026-11-10', 10);
    expect(cycle).toEqual({ start: '2026-11-10', endExcl: '2026-12-10', lengthDays: 30 });

    // Before cycle starts (elapsed = 0)
    expect(shouldShowNewCycleHint(cycle, '2026-11-09', 460_000)).toBe(false);
    // Day 1 (elapsed = 1) through Day 7 (elapsed = 7 -> 16 Nov)
    expect(shouldShowNewCycleHint(cycle, '2026-11-10', 460_000)).toBe(true);
    expect(shouldShowNewCycleHint(cycle, '2026-11-13', 460_000)).toBe(true);
    expect(shouldShowNewCycleHint(cycle, '2026-11-16', 460_000)).toBe(true);
    // Day 8 (elapsed = 8 -> 17 Nov)
    expect(shouldShowNewCycleHint(cycle, '2026-11-17', 460_000)).toBe(false);
    // After cycle ends
    expect(shouldShowNewCycleHint(cycle, '2026-12-10', 460_000)).toBe(false);
    // Zero previous cycle spend
    expect(shouldShowNewCycleHint(cycle, '2026-11-13', 0)).toBe(false);
  });
});
