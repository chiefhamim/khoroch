import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import { AppContext } from '@/state/AppContext';
import { useBudgets } from '@/state/useBudgets';
import { useDashboard } from '@/state/useDashboard';

/**
 * Pins the MONTHLY maths (periodKind unset). Every expected number below is worked out by hand
 * from the fixture, so a change to monthly behaviour fails here.
 *
 * Today 2026-11-17, month starts on the 1st: period 1 Nov to 1 Dec (30 days), 14 days left
 * (17 to 30 Nov inclusive).
 * Budgets: Oct 3,000,000; Nov 4,000,000 overall and 1,000,000 for food_dining (poisha).
 * Expenses: Oct 10 food 250,000; Nov 3 food 100,000; Nov 5 shopping 300,000. Income Nov 16 1,000,000.
 * Bills: rent (day 20, 500,000) paid for November; internet (day 25, 80,000) unpaid.
 */
const TODAY = '2026-11-17';

async function seed(): Promise<MemoryRepo> {
  const repo = new MemoryRepo();
  for (const cat of buildDefaultCategories(1)) await repo.upsertCategory(cat);
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('monthStartDay', 1);
  await repo.setBudget('2026-10-01', '', 3_000_000);
  await repo.setBudget('2026-11-01', '', 4_000_000);
  await repo.setBudget('2026-11-01', 'food_dining', 1_000_000);
  const base = { currency: 'BDT' as const };
  await repo.insertTransaction({
    ...base,
    id: 'oct_food',
    type: 'expense',
    amountMinor: 250_000,
    categoryId: 'food_dining',
    description: 'October food',
    occurredOn: '2026-10-10',
  });
  await repo.insertTransaction({
    ...base,
    id: 'nov_food',
    type: 'expense',
    amountMinor: 100_000,
    categoryId: 'food_dining',
    description: 'November food',
    occurredOn: '2026-11-03',
  });
  await repo.insertTransaction({
    ...base,
    id: 'nov_shop',
    type: 'expense',
    amountMinor: 300_000,
    categoryId: 'shopping',
    description: 'November shopping',
    occurredOn: '2026-11-05',
  });
  await repo.insertTransaction({
    ...base,
    id: 'nov_income',
    type: 'income',
    amountMinor: 1_000_000,
    categoryId: 'salary',
    description: 'Pay',
    occurredOn: '2026-11-16',
  });
  await repo.insertRecurringBill({
    id: 'rent',
    name: 'Rent',
    kind: 'bill',
    amountMinor: 500_000,
    dayOfMonth: 20,
    lastPaidPeriod: '2026-11-01',
  });
  await repo.insertRecurringBill({
    id: 'internet',
    name: 'Internet',
    kind: 'bill',
    amountMinor: 80_000,
    dayOfMonth: 25,
  });
  return repo;
}

describe('monthly mode (periodKind unset) is pinned', () => {
  it('keeps the exact summary, after-bills, commitment and history numbers', async () => {
    const repo = await seed();
    const settings = await repo.getSettings();
    expect(settings.periodKind).toBe('month');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings,
          updateSetting: async () => {},
          refreshSettings: async () => {},
        }}
      >
        {children}
      </AppContext.Provider>
    );
    const { result } = await renderHook(
      () => ({ d: useDashboard(TODAY), b: useBudgets(TODAY) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.d.loading).toBe(false));
    await waitFor(() => expect(result.current.b.loading).toBe(false));
    const { d, b } = result.current;

    expect(d.periodKind).toBe('month');
    expect(d.period).toEqual({ start: '2026-11-01', endExcl: '2026-12-01', lengthDays: 30 });
    expect(d.billPeriod).toEqual(d.period);
    expect(d.overallBudgetMinor).toBe(4_000_000);

    // Spent 100,000 + 300,000 = 400,000 (income is not spent). Left 3,600,000.
    expect(d.summary.spentMinor).toBe(400_000);
    expect(d.summary.incomeMinor).toBe(1_000_000);
    expect(d.summary.remainingMinor).toBe(3_600_000);
    expect(d.summary.utilizationPct).toBe(10);
    // floor(3,600,000 / 14 days left) = 257,142
    expect(d.summary.safeToSpendPerDayMinor).toBe(257_142);
    expect(d.dailyBudgetLimitMinor).toBe(133_333); // floor(4,000,000 / 30)

    // One unpaid bill (internet 80,000): left 3,520,000, floor(3,520,000 / 14) = 251,428.
    expect(d.afterBills).toEqual({
      unpaidCount: 1,
      unpaidBillsMinor: 80_000,
      leftAfterBillsMinor: 3_520_000,
      safePerDayAfterBillsMinor: 251_428,
    });
    expect(d.billsCommitment).toEqual({
      activeExpenseBillsCount: 2,
      paidCount: 1,
      unpaidCount: 1,
      paidBillsTotalMinor: 500_000,
      unpaidBillsTotalMinor: 80_000,
      uncommittedRemainingMinor: 3_520_000,
      uncommittedSafePerDayMinor: 251_428,
    });

    // Budgets hook agrees, and category budgets stay live in monthly mode.
    expect(b.periodKind).toBe('month');
    expect(b.remainingDaysCount).toBe(14);
    expect(b.overallSummary.spentMinor).toBe(400_000);
    expect(b.billsCommitment).toEqual(d.billsCommitment);
    expect(b.categoryBudgets.map((c) => [c.categoryId, c.budgetMinor, c.spentMinor])).toEqual([
      ['food_dining', 1_000_000, 100_000],
    ]);

    // History: only October is before the current cycle. 250,000 of 3,000,000 = 8.33 percent.
    expect(b.history).toHaveLength(1);
    expect(b.history[0].period).toEqual({ start: '2026-10-01', endExcl: '2026-11-01', lengthDays: 31 });
    expect(b.history[0].overallBudgetMinor).toBe(3_000_000);
    expect(b.history[0].spentMinor).toBe(250_000);
    expect(b.history[0].utilizationPct).toBeCloseTo(8.3333, 3);
    expect(b.history[0].status).toBe('ok');
  });
});
