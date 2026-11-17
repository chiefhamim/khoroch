import {
  summarize,
  summarizeUnpaidBills,
  summarizeUnpaidBillsDueInPeriod,
  computeAfterBills,
  recentPeriodsSeries,
} from './calc';
import { addDays, todayLocalDate, toEpochDay } from './dates';
import { computeUpcomingBillsCommitment } from './netWorth';
import {
  buildRecentSpendingWindows,
  elapsedDays,
  formatWeekRangeParts,
  getBillPeriod,
  getPeriod,
  getSpendingPeriod,
  getWeekPeriod,
  previousSpendingPeriod,
  remainingDays,
  type PeriodConfig,
} from './period';
import type { RecurringBill, Transaction } from './types';

const WEEK = (weekStartDay: number): PeriodConfig => ({
  periodKind: 'week',
  weekStartDay,
  monthStartDay: 1,
});
const MONTH = (monthStartDay: number): PeriodConfig => ({
  periodKind: 'month',
  weekStartDay: 6,
  monthStartDay,
});

function expense(id: string, occurredOn: string, amountMinor: number): Transaction {
  return {
    id,
    type: 'expense',
    amountMinor,
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: null,
    description: id,
    occurredOn,
    occurredTime: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    source: 'manual',
  } as unknown as Transaction;
}

function bill(partial: Partial<RecurringBill> & { id: string; dayOfMonth: number }): RecurringBill {
  return {
    name: partial.id,
    kind: 'bill',
    amountMinor: 50_000,
    categoryId: null,
    accountId: null,
    isActive: true,
    lastPaidPeriod: null,
    totalInstallments: null,
    paidInstallments: 0,
    ...partial,
  } as unknown as RecurringBill;
}

describe('getWeekPeriod: the 7 local days starting on weekStartDay (0 = Sunday)', () => {
  // 2026-11-17 is a Tuesday.
  it.each([
    [0, '2026-11-15', '2026-11-22'],
    [1, '2026-11-16', '2026-11-23'],
    [2, '2026-11-17', '2026-11-24'],
    [3, '2026-11-11', '2026-11-18'],
    [4, '2026-11-12', '2026-11-19'],
    [5, '2026-11-13', '2026-11-20'],
    [6, '2026-11-14', '2026-11-21'],
  ])('2026-11-17 with weekStartDay %i -> %s..%s', (wsd, start, endExcl) => {
    expect(getWeekPeriod('2026-11-17', wsd)).toEqual({ start, endExcl, lengthDays: 7 });
  });

  it.each([
    // month boundary: Tuesday 2026-12-01
    ['2026-12-01', 6, '2026-11-28', '2026-12-05'],
    ['2026-12-01', 0, '2026-11-29', '2026-12-06'],
    ['2026-12-01', 1, '2026-11-30', '2026-12-07'],
    // year boundary: Friday 2027-01-01
    ['2027-01-01', 6, '2026-12-26', '2027-01-02'],
    ['2027-01-01', 0, '2026-12-27', '2027-01-03'],
    ['2027-01-01', 1, '2026-12-28', '2027-01-04'],
    // leap day: Tuesday 2028-02-29
    ['2028-02-29', 6, '2028-02-26', '2028-03-04'],
    ['2028-02-29', 0, '2028-02-27', '2028-03-05'],
    ['2028-02-29', 1, '2028-02-28', '2028-03-06'],
  ])('%s with weekStartDay %i -> %s..%s', (today, wsd, start, endExcl) => {
    expect(getWeekPeriod(today, wsd)).toEqual({ start, endExcl, lengthDays: 7 });
  });

  it('a day that is itself the start day opens a new week, and the day before closes the old one', () => {
    // Saturday start: Sat 2026-11-14 begins a week, Fri 2026-11-13 ends the previous one.
    expect(getWeekPeriod('2026-11-14', 6).start).toBe('2026-11-14');
    expect(getWeekPeriod('2026-11-13', 6)).toEqual({
      start: '2026-11-07',
      endExcl: '2026-11-14',
      lengthDays: 7,
    });
    expect(getWeekPeriod('2026-11-20', 6).endExcl).toBe('2026-11-21');
  });

  it('is exact at local midnight: 00:00:00 and 23:59:59 of the same local day give the same week', () => {
    const first = todayLocalDate(new Date(2026, 10, 14, 0, 0, 0)); // Sat 14 Nov, local midnight
    const last = todayLocalDate(new Date(2026, 10, 20, 23, 59, 59)); // Fri 20 Nov, one second to midnight
    const next = todayLocalDate(new Date(2026, 10, 21, 0, 0, 0)); // Sat 21 Nov, local midnight
    expect(first).toBe('2026-11-14');
    expect(last).toBe('2026-11-20');
    expect(next).toBe('2026-11-21');
    expect(getWeekPeriod(first, 6)).toEqual(getWeekPeriod(last, 6));
    expect(getWeekPeriod(next, 6).start).toBe('2026-11-21');
  });

  it('throws for a weekStartDay outside 0 to 6', () => {
    expect(() => getWeekPeriod('2026-11-17', -1)).toThrow();
    expect(() => getWeekPeriod('2026-11-17', 7)).toThrow();
    expect(() => getWeekPeriod('2026-11-17', 1.5)).toThrow();
  });

  it('holds for every day of 2026 to 2028 and every start day', () => {
    let day = '2026-01-01';
    let checked = 0;
    while (day < '2029-01-01') {
      for (let wsd = 0; wsd <= 6; wsd++) {
        const p = getWeekPeriod(day, wsd);
        const startWeekday = new Date(`${p.start}T00:00:00Z`).getUTCDay();
        expect(startWeekday).toBe(wsd);
        expect(p.start <= day && day < p.endExcl).toBe(true);
        expect(toEpochDay(p.endExcl) - toEpochDay(p.start)).toBe(7);
        expect(elapsedDays(p, day) + remainingDays(p, day)).toBe(8);
        checked++;
      }
      day = addDays(day, 1);
    }
    expect(checked).toBe((365 + 365 + 366) * 7);
  });
});

describe('spending period versus bill period', () => {
  it('monthly mode returns exactly the existing monthly period for every start day', () => {
    for (let msd = 1; msd <= 28; msd++) {
      for (const today of ['2026-11-13', '2026-02-28', '2027-01-01', '2028-02-29']) {
        expect(getSpendingPeriod(today, MONTH(msd))).toEqual(getPeriod(today, msd));
        expect(getBillPeriod(today, msd)).toEqual(getPeriod(today, msd));
      }
    }
  });

  it('weekly mode changes the spending period only; the bill period stays monthly', () => {
    expect(getSpendingPeriod('2026-11-17', WEEK(6))).toEqual({
      start: '2026-11-14',
      endExcl: '2026-11-21',
      lengthDays: 7,
    });
    expect(getBillPeriod('2026-11-17', 1)).toEqual({
      start: '2026-11-01',
      endExcl: '2026-12-01',
      lengthDays: 30,
    });
  });

  it('previous and recent windows step back whole weeks across the year boundary', () => {
    const cur = getSpendingPeriod('2027-01-05', WEEK(6)); // Tue 5 Jan 2027
    expect(cur.start).toBe('2027-01-02');
    expect(previousSpendingPeriod(cur, WEEK(6))).toEqual({
      start: '2026-12-26',
      endExcl: '2027-01-02',
      lengthDays: 7,
    });
    const windows = buildRecentSpendingWindows('2027-01-05', WEEK(6), 3);
    expect(windows.map((w) => w.start)).toEqual(['2026-12-19', '2026-12-26', '2027-01-02']);
  });

  it('formats the week range for a template: same month and across months', () => {
    expect(formatWeekRangeParts(getWeekPeriod('2026-11-17', 6))).toEqual({ from: '14', to: '20 Nov' });
    expect(formatWeekRangeParts(getWeekPeriod('2026-12-01', 6))).toEqual({
      from: '28 Nov',
      to: '4 Dec',
    });
    expect(formatWeekRangeParts(getWeekPeriod('2026-11-17', 6), 'bn')).toEqual({
      from: '14',
      to: '20 নভে',
    });
  });
});

describe('weekly days left, safe per day and totals', () => {
  const week = getWeekPeriod('2026-11-17', 6); // Sat 14 Nov to Fri 20 Nov

  it('counts 7 days: first day, middle, last day', () => {
    expect(elapsedDays(week, '2026-11-14')).toBe(1);
    expect(remainingDays(week, '2026-11-14')).toBe(7);
    expect(elapsedDays(week, '2026-11-17')).toBe(4);
    expect(remainingDays(week, '2026-11-17')).toBe(4);
    expect(elapsedDays(week, '2026-11-20')).toBe(7);
    expect(remainingDays(week, '2026-11-20')).toBe(1);
  });

  it('safe per day: remaining weekly budget over days left, floored', () => {
    const txs = [expense('a', '2026-11-15', 100_000), expense('b', '2026-11-17', 50_000)];
    const mid = summarize({
      transactions: txs,
      period: week,
      today: '2026-11-17',
      overallBudgetMinor: 700_000,
      currency: 'BDT',
    });
    expect(mid.spentMinor).toBe(150_000);
    expect(mid.remainingMinor).toBe(550_000);
    expect(mid.safeToSpendPerDayMinor).toBe(137_500); // 550000 / 4
    expect(mid.utilizationPct).toBeCloseTo((150_000 / 700_000) * 100, 10);

    const lastDay = summarize({
      transactions: txs,
      period: week,
      today: '2026-11-20',
      overallBudgetMinor: 700_000,
      currency: 'BDT',
    });
    expect(lastDay.safeToSpendPerDayMinor).toBe(550_000); // 1 day left: all of it
  });

  it('rounding rule is unchanged: floor, never negative', () => {
    const base = { transactions: [], period: week, currency: 'BDT' } as const;
    expect(
      summarize({ ...base, today: '2026-11-14', overallBudgetMinor: 100_001 }).safeToSpendPerDayMinor
    ).toBe(14_285); // 100001 / 7 = 14285.86
    expect(
      summarize({ ...base, today: '2026-11-18', overallBudgetMinor: 100_001 }).safeToSpendPerDayMinor
    ).toBe(33_333); // 100001 / 3
    const over = summarize({
      transactions: [expense('x', '2026-11-16', 120_000)],
      period: week,
      today: '2026-11-17',
      overallBudgetMinor: 100_000,
      currency: 'BDT',
    });
    expect(over.remainingMinor).toBe(-20_000);
    expect(over.safeToSpendPerDayMinor).toBe(0);
  });

  it('weekly totals include only entries inside the 7 days', () => {
    const txs = [
      expense('before', '2026-11-13', 11_111), // Friday before the week
      expense('first', '2026-11-14', 1_000), // first day
      expense('mid', '2026-11-17', 2_000),
      expense('last', '2026-11-20', 3_000), // last day
      expense('after', '2026-11-21', 99_999), // Saturday after the week
    ];
    const s = summarize({
      transactions: txs,
      period: week,
      today: '2026-11-20',
      overallBudgetMinor: null,
      currency: 'BDT',
    });
    expect(s.spentMinor).toBe(6_000);
    expect(s.expenseCount).toBe(3);
    expect(s.safeToSpendPerDayMinor).toBeNull();
    expect(s.status).toBe('no_budget');
  });

  it('numbers the last weeks for the Home chart, oldest first', () => {
    const windows = buildRecentSpendingWindows('2026-11-17', WEEK(6), 3);
    const series = recentPeriodsSeries(
      [expense('w1', '2026-11-03', 700), expense('w3', '2026-11-15', 300)],
      windows,
      'BDT'
    );
    expect(series.map((p) => [p.weekIndex, p.start, p.spentMinor])).toEqual([
      [1, '2026-10-31', 700],
      [2, '2026-11-07', 0],
      [3, '2026-11-14', 300],
    ]);
  });
});

describe('unpaid bills inside versus outside the week', () => {
  const week = getWeekPeriod('2026-11-17', 6); // 14 to 20 Nov
  const bills = [
    bill({ id: 'inside', dayOfMonth: 18, amountMinor: 50_000 }),
    bill({ id: 'outsideLater', dayOfMonth: 25, amountMinor: 70_000 }),
    bill({ id: 'outsideEarlier', dayOfMonth: 5, amountMinor: 90_000 }),
  ];

  it('subtracts only the bill due inside the week', () => {
    expect(summarizeUnpaidBillsDueInPeriod(bills, week, 1)).toEqual({
      unpaidCount: 1,
      unpaidMinor: 50_000,
    });
  });

  it('after-bills in weekly mode leaves the outside bills alone', () => {
    const inWeek = summarizeUnpaidBillsDueInPeriod(bills, week, 1);
    const after = computeAfterBills({
      remainingMinor: 550_000,
      unpaidBillsMinor: inWeek.unpaidMinor,
      unpaidCount: inWeek.unpaidCount,
      daysLeft: remainingDays(week, '2026-11-17'),
    });
    expect(after.leftAfterBillsMinor).toBe(500_000);
    expect(after.safePerDayAfterBillsMinor).toBe(125_000);
    // The monthly rule would have taken all three.
    const monthly = summarizeUnpaidBills(bills, getBillPeriod('2026-11-17', 1));
    expect(monthly.unpaidMinor).toBe(210_000);
  });

  it('a bill paid for its monthly period is not subtracted', () => {
    const paid = [bill({ id: 'inside', dayOfMonth: 18, lastPaidPeriod: '2026-11-01' })];
    expect(summarizeUnpaidBillsDueInPeriod(paid, week, 1)).toEqual({ unpaidCount: 0, unpaidMinor: 0 });
  });

  it('inactive, salary and finished EMI bills are never subtracted', () => {
    const skipped = [
      bill({ id: 'off', dayOfMonth: 18, isActive: false }),
      bill({ id: 'pay', dayOfMonth: 18, kind: 'salary' }),
      bill({ id: 'emi', dayOfMonth: 18, kind: 'emi', totalInstallments: 3, paidInstallments: 3 }),
    ];
    expect(summarizeUnpaidBillsDueInPeriod(skipped, week, 1).unpaidCount).toBe(0);
  });

  it('clamps the due day to the month length: day 31 in February is the 28th', () => {
    const b = [bill({ id: 'end', dayOfMonth: 31 })];
    // Sat 21 Feb to Fri 27 Feb 2026 does not include Sat 28 Feb; the next week does.
    expect(summarizeUnpaidBillsDueInPeriod(b, getWeekPeriod('2026-02-23', 6), 1).unpaidCount).toBe(0);
    expect(summarizeUnpaidBillsDueInPeriod(b, getWeekPeriod('2026-02-28', 6), 1).unpaidCount).toBe(1);
    // A 30-day month: day 31 is the 30th.
    expect(summarizeUnpaidBillsDueInPeriod(b, getWeekPeriod('2026-11-30', 6), 1).unpaidCount).toBe(1);
  });

  it('a week across a month boundary finds the bill due in the next month', () => {
    const crossing = getWeekPeriod('2026-12-01', 6); // 28 Nov to 4 Dec
    const b = [bill({ id: 'early', dayOfMonth: 2 }), bill({ id: 'late', dayOfMonth: 29 })];
    expect(summarizeUnpaidBillsDueInPeriod(b, crossing, 1)).toEqual({
      unpaidCount: 2,
      unpaidMinor: 100_000,
    });
    // Paying the November occurrence does not pay the December one.
    const novPaid = [bill({ id: 'early', dayOfMonth: 2, lastPaidPeriod: '2026-11-01' })];
    expect(summarizeUnpaidBillsDueInPeriod(novPaid, crossing, 1).unpaidCount).toBe(1);
    const decPaid = [bill({ id: 'early', dayOfMonth: 2, lastPaidPeriod: '2026-12-01' })];
    expect(summarizeUnpaidBillsDueInPeriod(decPaid, crossing, 1).unpaidCount).toBe(0);
  });

  it('commitment: paid counts follow the monthly bill period, the held-back amount follows the week', () => {
    const monthPeriod = getBillPeriod('2026-11-17', 1);
    const result = computeUpcomingBillsCommitment({
      bills,
      period: monthPeriod,
      today: '2026-11-17',
      budgetRemainingMinor: 550_000,
      spendingWindow: { period: week, monthStartDay: 1 },
    });
    expect(result.activeExpenseBillsCount).toBe(3);
    expect(result.paidCount).toBe(0);
    expect(result.unpaidCount).toBe(1);
    expect(result.unpaidBillsTotalMinor).toBe(50_000);
    expect(result.uncommittedRemainingMinor).toBe(500_000);
    expect(result.uncommittedSafePerDayMinor).toBe(125_000); // 4 days left in the week

    // Without a window (monthly mode) the result is the old monthly figure.
    const monthly = computeUpcomingBillsCommitment({
      bills,
      period: monthPeriod,
      today: '2026-11-17',
      budgetRemainingMinor: 550_000,
    });
    expect(monthly.unpaidCount).toBe(3);
    expect(monthly.unpaidBillsTotalMinor).toBe(210_000);
    expect(monthly.uncommittedSafePerDayMinor).toBe(Math.floor(340_000 / 14));
  });
});
