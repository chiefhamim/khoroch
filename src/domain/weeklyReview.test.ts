import { summarizeUnpaidBillsDueInPeriod } from './calc';
import { getBillPeriod, getEffectiveWeekStart, getWeekPeriod } from './period';
import { resolveInsightsWindow } from './insights';
import { normalizeWeeklyBudgetMinor, type RecurringBill } from './types';
import { MAX_AMOUNT_MINOR } from './money';
import { MemoryRepo } from '@/data/memoryRepo';

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

describe('weekly bills count only what Mark paid can clear (current week AND current bill period)', () => {
  const week = getWeekPeriod('2026-12-01', 6); // 28 Nov to 4 Dec

  it('today 29 Nov, bill due the 2nd, November paid: nothing is subtracted', () => {
    const today = '2026-11-29';
    const b = [bill({ id: 'early', dayOfMonth: 2, lastPaidPeriod: '2026-11-01' })];
    expect(summarizeUnpaidBillsDueInPeriod(b, week, 1, getBillPeriod(today, 1))).toEqual({
      unpaidCount: 0,
      unpaidMinor: 0,
    });
    // Even unpaid in November, the 2 Dec occurrence is a December one: Mark paid cannot clear it now.
    const unpaid = [bill({ id: 'early', dayOfMonth: 2 })];
    expect(summarizeUnpaidBillsDueInPeriod(unpaid, week, 1, getBillPeriod(today, 1)).unpaidCount).toBe(0);
  });

  it('today 2 Dec, December unpaid: the bill due the 2nd is subtracted', () => {
    const today = '2026-12-02';
    const b = [bill({ id: 'early', dayOfMonth: 2, lastPaidPeriod: '2026-11-01' })];
    expect(summarizeUnpaidBillsDueInPeriod(b, week, 1, getBillPeriod(today, 1))).toEqual({
      unpaidCount: 1,
      unpaidMinor: 50_000,
    });
  });

  it('a bill due the 30th, unpaid in November, seen from 2 Dec is not subtracted', () => {
    const b = [bill({ id: 'late', dayOfMonth: 30 })];
    expect(summarizeUnpaidBillsDueInPeriod(b, week, 1, getBillPeriod('2026-12-02', 1)).unpaidCount).toBe(0);
  });

  it('the weekly set is a subset of the unpaid bills of the current bill period', () => {
    const today = '2026-11-17';
    const w = getWeekPeriod(today, 6);
    const bills = [
      bill({ id: 'in', dayOfMonth: 18 }),
      bill({ id: 'out', dayOfMonth: 25 }),
      bill({ id: 'paid', dayOfMonth: 19, lastPaidPeriod: '2026-11-01' }),
    ];
    expect(summarizeUnpaidBillsDueInPeriod(bills, w, 1, getBillPeriod(today, 1))).toEqual({
      unpaidCount: 1,
      unpaidMinor: 50_000,
    });
  });
});

describe('getEffectiveWeekStart', () => {
  it('uses weekStartDay when it is not the default', () => {
    expect(getEffectiveWeekStart({ weekStartDay: 0, weekStartsOn: 'saturday' })).toBe(0);
    expect(getEffectiveWeekStart({ weekStartDay: 3, weekStartsOn: 'monday' })).toBe(3);
    expect(getEffectiveWeekStart({ weekStartDay: 1, weekStartsOn: 'sunday' })).toBe(1);
  });

  it('falls back to the older weekStartsOn when weekStartDay is the default Saturday', () => {
    expect(getEffectiveWeekStart({ weekStartDay: 6, weekStartsOn: 'saturday' })).toBe(6);
    expect(getEffectiveWeekStart({ weekStartDay: 6, weekStartsOn: 'sunday' })).toBe(0);
    expect(getEffectiveWeekStart({ weekStartDay: 6, weekStartsOn: 'monday' })).toBe(1);
  });

  it('reads anything invalid or missing as Saturday', () => {
    expect(getEffectiveWeekStart({})).toBe(6);
    expect(getEffectiveWeekStart({ weekStartDay: 9, weekStartsOn: 'nope' })).toBe(6);
    expect(getEffectiveWeekStart({ weekStartDay: 1.5 })).toBe(6);
  });

  it('Ledger "This week" equals the Home week after choosing Sunday', () => {
    const today = '2026-11-17';
    const start = getEffectiveWeekStart({ weekStartDay: 0, weekStartsOn: 'saturday' });
    const ledger = resolveInsightsWindow('this_week', today, 1, undefined, start);
    const home = getWeekPeriod(today, start);
    expect([ledger.fromIncl, ledger.toExcl]).toEqual([home.start, home.endExcl]);
    expect(home.start).toBe('2026-11-15');
  });

  it('a Tuesday start (not expressible by the older type) still gives matching weeks', () => {
    const today = '2026-11-17';
    const start = getEffectiveWeekStart({ weekStartDay: 2, weekStartsOn: 'saturday' });
    const ledger = resolveInsightsWindow('this_week', today, 1, undefined, start);
    expect(ledger.fromIncl).toBe(getWeekPeriod(today, 2).start);
    expect(ledger.fromIncl).toBe('2026-11-17');
  });
});

describe('normalizeWeeklyBudgetMinor caps at MAX_AMOUNT_MINOR', () => {
  it('keeps values up to the cap and reads larger values as unset', () => {
    expect(normalizeWeeklyBudgetMinor(MAX_AMOUNT_MINOR)).toBe(MAX_AMOUNT_MINOR);
    expect(normalizeWeeklyBudgetMinor(MAX_AMOUNT_MINOR + 1)).toBeNull();
    expect(normalizeWeeklyBudgetMinor(700_000)).toBe(700_000);
    expect(normalizeWeeklyBudgetMinor(0)).toBeNull();
  });

  it('the memory repo reads an out-of-range stored amount as unset', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('weeklyBudgetMinor', MAX_AMOUNT_MINOR + 1);
    expect((await repo.getSettings()).weeklyBudgetMinor).toBeNull();
    await repo.setSetting('weeklyBudgetMinor', MAX_AMOUNT_MINOR);
    expect((await repo.getSettings()).weeklyBudgetMinor).toBe(MAX_AMOUNT_MINOR);
  });
});
