import {
  buildCategoryBreakdown,
  categoryBudgetStatus,
  compareFullPeriods,
  compareMonthToDate,
  computeBudgetStatus,
  dailySeries,
  formatUtilizationPct,
  spendByCategory,
  summarize,
  summarizeBudgetAllocation,
  summarizeCategoryExpenses,
  summarizeDayActivity,
} from './calc';
import { buildRecentPeriodWindows, getPeriod } from './period';
import type { Budget, Transaction } from './types';

function makeTx(overrides: Partial<Transaction> & { id: string; amountMinor: number; occurredOn: string }): Transaction {
  return {
    type: 'expense',
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: null,
    transferId: null,
    description: '',
    note: '',
    occurredTime: null,
    source: 'manual',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    deletedAt: null,
    ...overrides,
  };
}

const SCENARIO_A_TXS: Transaction[] = [
  makeTx({ id: 'a1', type: 'expense', amountMinor: 650000, categoryId: 'food_dining', occurredOn: '2026-11-02' }),
  makeTx({ id: 'a2', type: 'expense', amountMinor: 280000, categoryId: 'transportation', occurredOn: '2026-11-04' }),
  makeTx({ id: 'a3', type: 'expense', amountMinor: 420000, categoryId: 'shopping', occurredOn: '2026-11-07' }),
  makeTx({ id: 'a4', type: 'expense', amountMinor: 195000, categoryId: 'utilities', occurredOn: '2026-11-10' }),
  makeTx({ id: 'a5', type: 'expense', amountMinor: 100000, categoryId: 'entertainment', occurredOn: '2026-11-12' }),
  makeTx({ id: 'a6', type: 'income', amountMinor: 5000000, categoryId: 'salary', occurredOn: '2026-11-01' }),
  makeTx({ id: 'a7', type: 'expense', amountMinor: 300000, categoryId: 'food_dining', occurredOn: '2026-11-11', deletedAt: 1700000001000 }),
  makeTx({ id: 'a8', type: 'expense', amountMinor: 999900, categoryId: 'shopping', occurredOn: '2026-10-31' }),
  makeTx({ id: 'a9', type: 'expense', amountMinor: 10000, categoryId: 'food_dining', occurredOn: '2026-11-05', currency: 'USD' }),
];

describe('calc Scenario A (TEST-CASES §3)', () => {
  const today = '2026-11-13';
  const period = getPeriod(today, 1);

  it('matches exact Scenario A summary numbers', () => {
    const summary = summarize({
      transactions: SCENARIO_A_TXS,
      period,
      today,
      overallBudgetMinor: 4000000,
      currency: 'BDT',
    });

    expect(summary.spentMinor).toBe(1645000);
    expect(summary.incomeMinor).toBe(5000000);
    expect(summary.remainingMinor).toBe(2355000);
    expect(summary.utilizationPct).toBeCloseTo(41.125, 6);
    expect(summary.status).toBe('ok');
    expect(summary.dailyAverageMinor).toBe(126538);
    expect(summary.safeToSpendPerDayMinor).toBe(130833);
    expect(summary.expenseCount).toBe(5);
    expect(summary.averageTransactionMinor).toBe(329000);
    expect(summary.largestExpense?.id).toBe('a1');
    expect(summary.topCategoryId).toBe('food_dining');
    expect(summary.ignoredOtherCurrencyCount).toBe(1);
  });

  it('computes spendByCategory sorted descending', () => {
    expect(spendByCategory(SCENARIO_A_TXS, period, 'BDT')).toEqual([
      { categoryId: 'food_dining', spentMinor: 650000, count: 1 },
      { categoryId: 'shopping', spentMinor: 420000, count: 1 },
      { categoryId: 'transportation', spentMinor: 280000, count: 1 },
      { categoryId: 'utilities', spentMinor: 195000, count: 1 },
      { categoryId: 'entertainment', spentMinor: 100000, count: 1 },
    ]);
  });

  it('computes 30-day dailySeries including zeros summing to spentMinor', () => {
    const series = dailySeries(SCENARIO_A_TXS, period, 'BDT');
    expect(series).toHaveLength(30);
    expect(series.find((p) => p.day === '2026-11-02')?.spentMinor).toBe(650000);
    expect(series.find((p) => p.day === '2026-11-01')?.spentMinor).toBe(0);
    const total = series.reduce((acc, p) => acc + p.spentMinor, 0);
    expect(total).toBe(1645000);
  });
});

describe('calc edge cases (TEST-CASES §3)', () => {
  const today = '2026-11-13';
  const period = getPeriod(today, 1);

  it('handles no transactions with budget', () => {
    const s = summarize({
      transactions: [],
      period,
      today,
      overallBudgetMinor: 4000000,
      currency: 'BDT',
    });
    expect(s).toEqual({
      spentMinor: 0,
      incomeMinor: 0,
      remainingMinor: 4000000,
      utilizationPct: 0,
      dailyAverageMinor: 0,
      safeToSpendPerDayMinor: Math.floor(4000000 / 18),
      status: 'ok',
      expenseCount: 0,
      averageTransactionMinor: null,
      largestExpense: null,
      topCategoryId: null,
      ignoredOtherCurrencyCount: 0,
    });
  });

  it('treats null and 0 budget identically as no_budget', () => {
    for (const budget of [null, 0]) {
      const s = summarize({
        transactions: SCENARIO_A_TXS,
        period,
        today,
        overallBudgetMinor: budget,
        currency: 'BDT',
      });
      expect(s.remainingMinor).toBeNull();
      expect(s.utilizationPct).toBeNull();
      expect(s.safeToSpendPerDayMinor).toBeNull();
      expect(s.status).toBe('no_budget');
    }
  });

  it('handles over budget and reached budget', () => {
    const over = summarize({
      transactions: [makeTx({ id: 'x1', amountMinor: 1200000, occurredOn: '2026-11-05' })],
      period,
      today,
      overallBudgetMinor: 1000000,
      currency: 'BDT',
    });
    expect(over.remainingMinor).toBe(-200000);
    expect(over.utilizationPct).toBe(120);
    expect(over.status).toBe('over');
    expect(over.safeToSpendPerDayMinor).toBe(0);

    const reached = summarize({
      transactions: [makeTx({ id: 'x2', amountMinor: 1000000, occurredOn: '2026-11-05' })],
      period,
      today,
      overallBudgetMinor: 1000000,
      currency: 'BDT',
    });
    expect(reached.remainingMinor).toBe(0);
    expect(reached.status).toBe('reached');
    expect(reached.safeToSpendPerDayMinor).toBe(0);
  });

  it('matches threshold boundaries exactly', () => {
    expect(computeBudgetStatus(6999, 10000)).toBe('ok');
    expect(computeBudgetStatus(7000, 10000)).toBe('info');
    expect(computeBudgetStatus(8499, 10000)).toBe('info');
    expect(computeBudgetStatus(8500, 10000)).toBe('attention');
    expect(computeBudgetStatus(9999, 10000)).toBe('attention');
    expect(computeBudgetStatus(10000, 10000)).toBe('reached');
    expect(computeBudgetStatus(10001, 10000)).toBe('over');
  });

  it('includes future-dated in-period expenses in spentMinor but excludes from dailyAverage', () => {
    const futureTx = makeTx({ id: 'f1', amountMinor: 100000, occurredOn: '2026-11-20' });
    const s = summarize({
      transactions: [...SCENARIO_A_TXS, futureTx],
      period,
      today,
      overallBudgetMinor: 4000000,
      currency: 'BDT',
    });
    expect(s.spentMinor).toBe(1745000);
    expect(s.dailyAverageMinor).toBe(126538);
  });

  it('income never reduces spent or adds to budget remaining', () => {
    const s = summarize({
      transactions: [makeTx({ id: 'inc', type: 'income', categoryId: 'salary', amountMinor: 5000000, occurredOn: '2026-11-01' })],
      period,
      today,
      overallBudgetMinor: 4000000,
      currency: 'BDT',
    });
    expect(s.spentMinor).toBe(0);
    expect(s.remainingMinor).toBe(4000000);
    expect(s.incomeMinor).toBe(5000000);
  });

  it('reflects category and amount edits', () => {
    const editedCat = SCENARIO_A_TXS.map((t) =>
      t.id === 'a1' ? { ...t, categoryId: 'transportation' } : t
    );
    const byCat = spendByCategory(editedCat, period, 'BDT');
    expect(byCat[0]).toEqual({ categoryId: 'transportation', spentMinor: 930000, count: 2 });
    expect(byCat.find((c) => c.categoryId === 'food_dining')).toBeUndefined();

    const editedAmt = SCENARIO_A_TXS.map((t) =>
      t.id === 'a1' ? { ...t, amountMinor: 50000 } : t
    );
    expect(
      summarize({
        transactions: editedAmt,
        period,
        today,
        overallBudgetMinor: 4000000,
        currency: 'BDT',
      }).spentMinor
    ).toBe(1045000);
  });

  it('breaks ties for largestExpense by later occurredOn, then later createdAt', () => {
    const t1 = makeTx({ id: 't1', amountMinor: 50000, occurredOn: '2026-11-05', createdAt: 200 });
    const t2 = makeTx({ id: 't2', amountMinor: 50000, occurredOn: '2026-11-08', createdAt: 100 });
    const s1 = summarize({
      transactions: [t1, t2],
      period,
      today,
      overallBudgetMinor: null,
      currency: 'BDT',
    });
    expect(s1.largestExpense?.id).toBe('t2');

    const t3 = makeTx({ id: 't3', amountMinor: 50000, occurredOn: '2026-11-08', createdAt: 300 });
    const s2 = summarize({
      transactions: [t2, t3],
      period,
      today,
      overallBudgetMinor: null,
      currency: 'BDT',
    });
    expect(s2.largestExpense?.id).toBe('t3');
  });

  it('computes categoryBudgetStatus accurately', () => {
    const budgets: Budget[] = [
      { periodStart: '2026-11-01', categoryId: '', amountMinor: 4000000, updatedAt: 1 },
      { periodStart: '2026-11-01', categoryId: 'food_dining', amountMinor: 1000000, updatedAt: 1 },
      { periodStart: '2026-11-01', categoryId: 'shopping', amountMinor: 400000, updatedAt: 1 },
    ];
    const res = categoryBudgetStatus(SCENARIO_A_TXS, budgets, period, 'BDT');
    expect(res).toEqual([
      {
        categoryId: 'food_dining',
        budgetMinor: 1000000,
        spentMinor: 650000,
        remainingMinor: 350000,
        utilizationPct: 65,
        status: 'ok',
      },
      {
        categoryId: 'shopping',
        budgetMinor: 400000,
        spentMinor: 420000,
        remainingMinor: -20000,
        utilizationPct: 105,
        status: 'over',
      },
    ]);
  });
});

describe('month comparisons (TEST-CASES §3)', () => {
  it('compares equivalent MTD window excluding later days of previous month', () => {
    const txs = [
      makeTx({ id: 'm1', amountMinor: 1000000, occurredOn: '2026-03-10' }),
      makeTx({ id: 'f1', amountMinor: 800000, occurredOn: '2026-02-10' }),
      makeTx({ id: 'f2', amountMinor: 500000, occurredOn: '2026-02-20' }),
    ];
    expect(compareMonthToDate(txs, '2026-03-13', 1, 'BDT')).toEqual({
      currentMinor: 1000000,
      previousMinor: 800000,
      diffMinor: 200000,
      pctChange: 25,
      daysCompared: 13,
    });
  });

  it('caps previous window to previous period length (31 Mar vs whole 28-day Feb)', () => {
    const txs = [
      makeTx({ id: 'm1', amountMinor: 300000, occurredOn: '2026-03-31' }),
      makeTx({ id: 'f1', amountMinor: 600000, occurredOn: '2026-02-28' }),
    ];
    expect(compareMonthToDate(txs, '2026-03-31', 1, 'BDT')).toEqual({
      currentMinor: 300000,
      previousMinor: 600000,
      diffMinor: -300000,
      pctChange: -50,
      daysCompared: 31,
    });
  });

  it('returns null pctChange when previous MTD spending is 0', () => {
    const txs = [makeTx({ id: 'n1', amountMinor: 100000, occurredOn: '2026-11-05' })];
    expect(compareMonthToDate(txs, '2026-11-13', 1, 'BDT')).toEqual({
      currentMinor: 100000,
      previousMinor: 0,
      diffMinor: 100000,
      pctChange: null,
      daysCompared: 13,
    });
  });

  it('compareFullPeriods compares Oct vs Sep on 2026-11-13 (never current partial month)', () => {
    const txs = [
      makeTx({ id: 'sep', amountMinor: 400000, occurredOn: '2026-09-15' }),
      makeTx({ id: 'oct', amountMinor: 500000, occurredOn: '2026-10-15' }),
      makeTx({ id: 'nov', amountMinor: 900000, occurredOn: '2026-11-05' }),
    ];
    const res = compareFullPeriods(txs, '2026-11-13', 1, 'BDT');
    expect(res.currentPeriod.start).toBe('2026-10-01');
    expect(res.previousPeriod.start).toBe('2026-09-01');
    expect(res.currentMinor).toBe(500000);
    expect(res.previousMinor).toBe(400000);
    expect(res.diffMinor).toBe(100000);
    expect(res.pctChange).toBe(25);
  });

  it('formats utilization percentages and builds category breakdown & allocation summaries', () => {
    expect(formatUtilizationPct(41.125)).toBe('41.1%');
    expect(formatUtilizationPct(40)).toBe('40%');
    expect(formatUtilizationPct(100)).toBe('100%');

    const spend = [
      { categoryId: 'c1', spentMinor: 500, count: 1 },
      { categoryId: 'c2', spentMinor: 400, count: 1 },
      { categoryId: 'c3', spentMinor: 300, count: 1 },
      { categoryId: 'c4', spentMinor: 200, count: 1 },
      { categoryId: 'c5', spentMinor: 100, count: 1 },
      { categoryId: 'c6', spentMinor: 60, count: 1 },
      { categoryId: 'c7', spentMinor: 40, count: 1 },
    ];
    const breakdown = buildCategoryBreakdown(spend, 1600, 5);
    expect(breakdown).toHaveLength(6);
    expect(breakdown[5]).toMatchObject({
      categoryId: null,
      spentMinor: 100,
      count: 2,
      isOtherGroup: true,
    });

    const period = getPeriod('2026-11-13', 1);
    const catSummary = summarizeCategoryExpenses(SCENARIO_A_TXS, period, 'food_dining', 'BDT');
    expect(catSummary.spentMinor).toBe(650000);
    expect(catSummary.count).toBe(1);

    const alloc = summarizeBudgetAllocation(4000000, [
      {
        categoryId: 'food_dining',
        budgetMinor: 1500000,
        spentMinor: 650000,
        remainingMinor: 850000,
        utilizationPct: 43.33,
        status: 'ok',
      },
    ]);
    expect(alloc.allocatedMinor).toBe(1500000);
    expect(alloc.unallocatedMinor).toBe(2500000);

    const windows = buildRecentPeriodWindows('2026-11-13', 1, 6);
    expect(windows).toHaveLength(6);
    expect(windows[0].start).toBe('2026-06-01');
    expect(windows[5].start).toBe('2026-11-01');

    const daySummary = summarizeDayActivity(
      [
        makeTx({ id: 'd1', amountMinor: 50000, occurredOn: '2026-11-13' }),
        makeTx({ id: 'd2', type: 'income', amountMinor: 100000, occurredOn: '2026-11-13' }),
        makeTx({ id: 'd3', amountMinor: 20000, occurredOn: '2026-11-12' }),
        makeTx({ id: 'd4', amountMinor: 90000, occurredOn: '2026-11-13', deletedAt: 1000 }),
      ],
      '2026-11-13',
      'BDT'
    );
    expect(daySummary.expenseMinor).toBe(50000);
    expect(daySummary.incomeMinor).toBe(100000);
    expect(daySummary.count).toBe(2);
  });
});
