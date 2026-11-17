import { describe, expect, it } from '@jest/globals';
import { computeEmiPayoff } from './emiPayoff';
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
