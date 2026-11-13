import {
  buildInsightsReport,
  buildPatternSentences,
  computeMonthlyAverageOverCompleteMonths,
  resolveInsightsWindow,
} from './insights';
import type { Category, LocalDate, Transaction } from './types';

function makeTx(
  overrides: Partial<Transaction> & {
    id: string;
    amountMinor: number;
    occurredOn: LocalDate;
  }
): Transaction {
  return {
    type: 'expense',
    currency: 'BDT',
    categoryId: 'food_dining',
    accountId: null,
    transferId: null,
    description: 'Item',
    note: '',
    occurredTime: null,
    source: 'manual',
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null,
    ...overrides,
  };
}

const CATS = new Map<string, Pick<Category, 'name'>>([
  ['food_dining', { name: 'Food & Dining' }],
  ['transportation', { name: 'Transportation' }],
  ['groceries', { name: 'Groceries' }],
  ['utilities', { name: 'Utilities' }],
]);

describe('insights domain (TEST-CASES §3 & §5)', () => {
  it('returns no pattern sentences unless both periods have >= 5 expense txs AND >= 7 elapsed days', () => {
    // Only 6 elapsed days on Nov 6 -> suppressed
    const txsManyButEarly = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeTx({ id: `nov-${i}`, amountMinor: 10000, occurredOn: `2026-11-0${i + 1}` as LocalDate })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeTx({ id: `oct-${i}`, amountMinor: 8000, occurredOn: `2026-10-0${i + 1}` as LocalDate })
      ),
    ];
    expect(buildPatternSentences(txsManyButEarly, '2026-11-06', 1, 'BDT', CATS)).toEqual({
      sentences: [],
      hasSufficientData: false,
    });

    // 13 elapsed days, but previous period only has 4 expenses -> suppressed
    const txsInsufficientPrev = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeTx({ id: `nov2-${i}`, amountMinor: 10000, occurredOn: `2026-11-0${i + 1}` as LocalDate })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        makeTx({ id: `oct2-${i}`, amountMinor: 8000, occurredOn: `2026-10-0${i + 1}` as LocalDate })
      ),
    ];
    expect(buildPatternSentences(txsInsufficientPrev, '2026-11-13', 1, 'BDT', CATS)).toEqual({
      sentences: [],
      hasSufficientData: false,
    });

    // Both MTD windows have >= 5 expenses and >= 7 elapsed days -> produces TEST-CASES §5 sentence format!
    // Oct 1..13 Food & Dining = 100,000 minor; Nov 1..13 Food & Dining = 118,000 minor -> +18%
    const qualifiedTxs = [
      makeTx({ id: 'n1', amountMinor: 11800, occurredOn: '2026-11-01', categoryId: 'food_dining' }),
      makeTx({ id: 'n2', amountMinor: 20000, occurredOn: '2026-11-03', categoryId: 'food_dining' }),
      makeTx({ id: 'n3', amountMinor: 30000, occurredOn: '2026-11-05', categoryId: 'food_dining' }),
      makeTx({ id: 'n4', amountMinor: 30000, occurredOn: '2026-11-08', categoryId: 'food_dining' }),
      makeTx({ id: 'n5', amountMinor: 26200, occurredOn: '2026-11-12', categoryId: 'food_dining' }),
      makeTx({ id: 'o1', amountMinor: 20000, occurredOn: '2026-10-01', categoryId: 'food_dining' }),
      makeTx({ id: 'o2', amountMinor: 20000, occurredOn: '2026-10-03', categoryId: 'food_dining' }),
      makeTx({ id: 'o3', amountMinor: 20000, occurredOn: '2026-10-05', categoryId: 'food_dining' }),
      makeTx({ id: 'o4', amountMinor: 20000, occurredOn: '2026-10-08', categoryId: 'food_dining' }),
      makeTx({ id: 'o5', amountMinor: 20000, occurredOn: '2026-10-12', categoryId: 'food_dining' }),
    ];
    const qualified = buildPatternSentences(qualifiedTxs, '2026-11-13', 1, 'BDT', CATS);
    expect(qualified.hasSufficientData).toBe(true);
    expect(qualified.sentences[0].text).toBe(
      'You spent 18% more on Food & Dining than the same point last month.'
    );
  });

  it('breaks ties cleanly for most expensive day (later date) and most frequent category (higher amount)', () => {
    const txs = [
      // Two days tie at 50000: 2026-11-02 and 2026-11-10 -> later date 2026-11-10 wins!
      makeTx({ id: 't1', amountMinor: 25000, occurredOn: '2026-11-02', categoryId: 'food_dining' }),
      makeTx({ id: 't2', amountMinor: 25000, occurredOn: '2026-11-02', categoryId: 'food_dining' }),
      makeTx({ id: 't3', amountMinor: 50000, occurredOn: '2026-11-10', categoryId: 'transportation' }),
      // Both food_dining and transportation have count=2? Make transportation count=2 total 60000 vs food count=2 total 50000
      makeTx({ id: 't4', amountMinor: 10000, occurredOn: '2026-11-11', categoryId: 'transportation' }),
    ];

    const report = buildInsightsReport(txs, '2026-11-13', 1, 'BDT', 'this_month', CATS);
    expect(report.biggest.mostExpensiveDay).toEqual({
      date: '2026-11-10',
      spentMinor: 50000,
      count: 1,
    });
    expect(report.biggest.mostFrequentCategory).toEqual({
      categoryId: 'transportation',
      spentMinor: 60000,
      count: 2,
    });
    expect(report.biggest.largestExpense?.transactionId).toBe('t3');
  });

  it('computes monthly average strictly over N complete periods, never partial current month', () => {
    const txs = [
      makeTx({ id: 'aug', amountMinor: 300000, occurredOn: '2026-08-15' }),
      makeTx({ id: 'sep', amountMinor: 600000, occurredOn: '2026-09-15' }),
      makeTx({ id: 'oct', amountMinor: 900000, occurredOn: '2026-10-15' }),
      // Current partial November must NEVER be included in complete-month average!
      makeTx({ id: 'nov', amountMinor: 5000000, occurredOn: '2026-11-05' }),
    ];

    const avg3 = computeMonthlyAverageOverCompleteMonths(txs, '2026-11-13', 1, 3, 'BDT');
    expect(avg3).toEqual({
      totalMinor: 1800000,
      averageMinor: 600000,
      completePeriodsCount: 3,
    });

    const avg2 = computeMonthlyAverageOverCompleteMonths(txs, '2026-11-13', 1, 2, 'BDT');
    expect(avg2).toEqual({
      totalMinor: 1500000,
      averageMinor: 750000,
      completePeriodsCount: 2,
    });
  });

  it('resolves all insights period presets including Monday week start and custom range', () => {
    // 2026-11-13 is Friday -> week started Monday 2026-11-09, elapsed = 5 days
    expect(resolveInsightsWindow('this_week', '2026-11-13', 1)).toEqual({
      preset: 'this_week',
      fromIncl: '2026-11-09',
      toExcl: '2026-11-16',
      elapsedDays: 5,
      completeMonthsCount: null,
    });

    expect(resolveInsightsWindow('last_3_months', '2026-11-13', 1)).toEqual({
      preset: 'last_3_months',
      fromIncl: '2026-08-01',
      toExcl: '2026-11-01',
      elapsedDays: 92,
      completeMonthsCount: 3,
    });

    expect(resolveInsightsWindow('this_year', '2026-11-13', 1)).toEqual({
      preset: 'this_year',
      fromIncl: '2026-01-01',
      toExcl: '2027-01-01',
      elapsedDays: 317,
      completeMonthsCount: null,
    });

    expect(
      resolveInsightsWindow('custom', '2026-11-13', 1, {
        fromIncl: '2026-11-01',
        toIncl: '2026-11-10',
      })
    ).toEqual({
      preset: 'custom',
      fromIncl: '2026-11-01',
      toExcl: '2026-11-11',
      elapsedDays: 10,
      completeMonthsCount: null,
    });
  });
});
