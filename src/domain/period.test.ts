import { addDays } from './dates';
import { elapsedDays, getPeriod, previousPeriod, remainingDays } from './period';

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
