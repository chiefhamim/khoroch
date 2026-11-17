import { describe, expect, it } from '@jest/globals';
import { computeEmiPayoff, countBehindPeriods, isPaidInPeriod } from './emiPayoff';
import type { Period, RecurringBill } from './types';

const nov: Pick<Period, 'start'> = { start: '2026-11-01' };

function emi(partial: Partial<RecurringBill> = {}): RecurringBill {
  return {
    id: 'b1',
    name: 'Phone',
    kind: 'emi',
    amountMinor: 250_000,
    dayOfMonth: 5,
    categoryId: null,
    accountId: null,
    totalInstallments: 12,
    paidInstallments: 0,
    lastPaidPeriod: null,
    isActive: true,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe('computeEmiPayoff', () => {
  it('returns null for non-EMI bills and EMIs without a total', () => {
    expect(computeEmiPayoff(emi({ kind: 'bill' }), nov)).toBeNull();
    expect(computeEmiPayoff(emi({ totalInstallments: null }), nov)).toBeNull();
    expect(computeEmiPayoff(emi({ totalInstallments: 0 }), nov)).toBeNull();
  });

  it('nothing paid yet: first instalment is this period, 12 total ends next October', () => {
    const p = computeEmiPayoff(emi(), nov)!;
    expect(p.state).toBe('active');
    expect(p.paidInstallments).toBe(0);
    expect(p.leftInstallments).toBe(12);
    expect(p.paidMinor).toBe(0);
    expect(p.leftMinor).toBe(3_000_000);
    expect(p.totalMinor).toBe(3_000_000);
    expect(p.pct).toBe(0);
    expect([p.endYear, p.endMonth]).toEqual([2027, 10]);
  });

  it('paid this period: the next instalment moves to next period', () => {
    const p = computeEmiPayoff(
      emi({ paidInstallments: 3, lastPaidPeriod: '2026-11-01' }),
      nov
    )!;
    expect(p.paidInstallments).toBe(3);
    expect(p.leftInstallments).toBe(9);
    expect(p.paidMinor).toBe(750_000);
    expect(p.leftMinor).toBe(2_250_000);
    expect(p.pct).toBe(25);
    // Dec 2026 is the 1st of 9 remaining, so the 9th is Aug 2027.
    expect([p.endYear, p.endMonth]).toEqual([2027, 8]);
  });

  it('not yet paid this period with 3 paid: this period holds the 4th', () => {
    const p = computeEmiPayoff(
      emi({ paidInstallments: 3, lastPaidPeriod: '2026-10-01' }),
      nov
    )!;
    // 9 left starting November: November + 8 = July 2027.
    expect([p.endYear, p.endMonth]).toEqual([2027, 7]);
  });

  it('last instalment still unpaid ends this month', () => {
    const p = computeEmiPayoff(
      emi({ totalInstallments: 6, paidInstallments: 5, lastPaidPeriod: '2026-10-01' }),
      nov
    )!;
    expect(p.leftInstallments).toBe(1);
    expect(p.leftMinor).toBe(250_000);
    expect([p.endYear, p.endMonth]).toEqual([2026, 11]);
  });

  it('finished: no end date, no amount left, even though markPaid made it inactive', () => {
    const p = computeEmiPayoff(
      emi({ totalInstallments: 6, paidInstallments: 6, isActive: false, lastPaidPeriod: '2026-11-01' }),
      nov
    )!;
    expect(p.state).toBe('finished');
    expect(p.leftInstallments).toBe(0);
    expect(p.leftMinor).toBe(0);
    expect(p.paidMinor).toBe(1_500_000);
    expect(p.pct).toBe(100);
    expect(p.endMonth).toBeNull();
  });

  it('clamps paid above total and negative paid', () => {
    const over = computeEmiPayoff(emi({ totalInstallments: 6, paidInstallments: 9 }), nov)!;
    expect(over.state).toBe('finished');
    expect(over.paidInstallments).toBe(6);
    expect(over.leftInstallments).toBe(0);
    expect(over.pct).toBe(100);
    const neg = computeEmiPayoff(emi({ paidInstallments: -2 }), nov)!;
    expect(neg.paidInstallments).toBe(0);
    expect(neg.leftInstallments).toBe(12);
  });

  it('paused (inactive, unfinished): figures shown, no end date', () => {
    const p = computeEmiPayoff(emi({ paidInstallments: 4, isActive: false }), nov)!;
    expect(p.state).toBe('paused');
    expect(p.leftInstallments).toBe(8);
    expect(p.leftMinor).toBe(2_000_000);
    expect(p.endYear).toBeNull();
    expect(p.endMonth).toBeNull();
  });

  it('uses whole-percent floor with integer maths', () => {
    const p = computeEmiPayoff(emi({ totalInstallments: 7, paidInstallments: 2 }), nov)!;
    expect(p.pct).toBe(28);
  });

  it('crosses the year boundary', () => {
    const p = computeEmiPayoff(
      emi({ totalInstallments: 3, paidInstallments: 0 }),
      { start: '2026-11-01' }
    )!;
    expect([p.endYear, p.endMonth]).toEqual([2027, 1]);
  });

  it('due day before the cycle start day falls in the following calendar month', () => {
    // Cycle starts the 25th; a bill due on the 5th is due in the next calendar month.
    const p = computeEmiPayoff(
      emi({ totalInstallments: 2, paidInstallments: 0, dayOfMonth: 5 }),
      { start: '2026-11-25' }
    )!;
    // Period 1: due 5 Dec; period 2: due 5 Jan.
    expect([p.endYear, p.endMonth]).toEqual([2027, 1]);
    const same = computeEmiPayoff(
      emi({ totalInstallments: 2, paidInstallments: 0, dayOfMonth: 28 }),
      { start: '2026-11-25' }
    )!;
    expect([same.endYear, same.endMonth]).toEqual([2026, 12]);
  });
});

describe('behind periods', () => {
  const behind = (partial: Partial<RecurringBill>, start = '2026-11-01') =>
    computeEmiPayoff(emi(partial), { start })!.behindPeriods;

  it('is 0 for a bill that was never paid (no baseline)', () => {
    expect(behind({ paidInstallments: 0, lastPaidPeriod: null })).toBe(0);
    expect(behind({ paidInstallments: 2, lastPaidPeriod: null })).toBe(0);
  });

  it('is 0 when paid this period, last period, or stamped after the current start', () => {
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-11-01' })).toBe(0);
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-10-01' })).toBe(0);
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-12-01' })).toBe(0);
  });

  it('counts each skipped period', () => {
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-09-01' })).toBe(1);
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-08-01' })).toBe(2);
    expect(
      behind({ totalInstallments: 24, paidInstallments: 3, lastPaidPeriod: '2025-11-01' })
    ).toBe(11);
  });

  it('never exceeds the instalments left', () => {
    expect(
      behind({ totalInstallments: 6, paidInstallments: 5, lastPaidPeriod: '2026-06-01' })
    ).toBe(1);
  });

  it('is 0 when paused or finished', () => {
    expect(behind({ paidInstallments: 3, lastPaidPeriod: '2026-06-01', isActive: false })).toBe(0);
    expect(
      behind({ totalInstallments: 3, paidInstallments: 3, lastPaidPeriod: '2026-06-01' })
    ).toBe(0);
  });

  it('keeps the projected end month while reporting behind', () => {
    const p = computeEmiPayoff(
      emi({ paidInstallments: 3, lastPaidPeriod: '2026-09-01' }),
      nov
    )!;
    expect(p.behindPeriods).toBe(1);
    expect([p.endYear, p.endMonth]).toEqual([2027, 7]);
  });

  it('cycle day changed to the 25th: a stamp inside the current period counts as paid', () => {
    // Today is 10 Nov, the cycle now starts on the 25th so the current period began 25 Oct.
    const cur = { start: '2026-10-25' };
    const paid = computeEmiPayoff(
      emi({ paidInstallments: 3, lastPaidPeriod: '2026-11-01' }),
      cur
    )!;
    expect(paid.behindPeriods).toBe(0);
    // Paid-this-period projection: 9 left start next period (25 Nov), 9th is Jul 2027 + due shift 1 = Aug.
    expect([paid.endYear, paid.endMonth]).toEqual([2027, 8]);
    expect(isPaidInPeriod('2026-11-01', '2026-10-25')).toBe(true);
    expect(isPaidInPeriod('2026-10-25', '2026-10-25')).toBe(true);
    expect(isPaidInPeriod('2026-10-24', '2026-10-25')).toBe(false);
  });

  it('cycle day changed: an old stamp is compared by date against the new grid', () => {
    // Current period starts 25 Nov. Stamp 1 Oct: the 25 Oct period was missed, 25 Sep is before the stamp.
    expect(countBehindPeriods('2026-10-01', '2026-11-25')).toBe(1);
    // Stamp 25 Oct is the grid start itself: nothing missed.
    expect(countBehindPeriods('2026-10-25', '2026-11-25')).toBe(0);
    // Stamp 1 Nov sits after the 25 Oct start: nothing missed.
    expect(countBehindPeriods('2026-11-01', '2026-11-25')).toBe(0);
  });

  it('clamps a day-31 cycle to short months and rejects unreadable stamps', () => {
    // Grid: 31 Jan, 28 Feb (2027), 31 Mar. Stamp 31 Jan, current 31 Mar: 28 Feb missed.
    expect(countBehindPeriods('2027-01-31', '2027-03-31')).toBe(1);
    expect(countBehindPeriods('not-a-date', '2026-11-01')).toBe(0);
    expect(countBehindPeriods(null, '2026-11-01')).toBe(0);
  });
});
