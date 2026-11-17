import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { AppContext } from '@/state/AppContext';
import { useBudgets } from '@/state/useBudgets';

/** Today 2026-11-17, month starts on the 1st: the bill period is 1 Nov to 1 Dec. */
const TODAY = '2026-11-17';

async function setup(lastPaidPeriod: string | null) {
  const repo = new MemoryRepo();
  await repo.setSetting('currency', 'BDT');
  await repo.setSetting('monthStartDay', 1);
  await repo.insertRecurringBill({
    id: 'loan',
    name: 'Loan',
    kind: 'emi',
    amountMinor: 200_000,
    dayOfMonth: 20,
    totalInstallments: 6,
    paidInstallments: 2,
    lastPaidPeriod,
  });
  const settings = await repo.getSettings();
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
  const { result } = await renderHook(() => useBudgets(TODAY), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return { repo, result };
}

describe('markRecurringBillPaid with a stamp in a later period', () => {
  it('only re-stamps: no new transaction, no instalment, reports already recorded', async () => {
    const { repo, result } = await setup('2026-12-01');
    const bill = result.current.recurringBills[0];
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.markRecurringBillPaid(bill);
    });
    expect(outcome).toBe('already_recorded');
    const after = (await repo.listRecurringBills({ includeInactive: true }))[0];
    expect(after.lastPaidPeriod).toBe('2026-11-01');
    expect(after.paidInstallments).toBe(2);
    expect(await repo.listTransactionsInRange('2026-01-01', '2027-01-01')).toHaveLength(0);
  });

  it('still records normally for an earlier stamp', async () => {
    const { repo, result } = await setup('2026-10-01');
    const bill = result.current.recurringBills[0];
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.markRecurringBillPaid(bill);
    });
    expect(outcome).toBe('recorded');
    const after = (await repo.listRecurringBills({ includeInactive: true }))[0];
    expect(after.lastPaidPeriod).toBe('2026-11-01');
    expect(after.paidInstallments).toBe(3);
    expect(await repo.listTransactionsInRange('2026-01-01', '2027-01-01')).toHaveLength(1);
  });

  it('leaves the bill unstamped and the instalment unchanged when the entry insert fails', async () => {
    const { repo, result } = await setup('2026-10-01');
    const bill = { ...result.current.recurringBills[0], accountId: 'missing-wallet' };
    await act(async () => {
      await expect(result.current.markRecurringBillPaid(bill)).rejects.toThrow();
    });
    const after = (await repo.listRecurringBills({ includeInactive: true }))[0];
    expect(after.lastPaidPeriod).toBe('2026-10-01');
    expect(after.paidInstallments).toBe(2);
    expect(await repo.listTransactionsInRange('2026-01-01', '2027-01-01')).toHaveLength(0);
  });

  it('two concurrent calls on the same stale bill make one expense and one increment', async () => {
    const { repo, result } = await setup('2026-10-01');
    const bill = result.current.recurringBills[0];
    let outcomes: string[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.markRecurringBillPaid(bill),
        result.current.markRecurringBillPaid(bill),
      ]);
    });
    expect(outcomes.sort()).toEqual(['already_recorded', 'recorded']);
    const after = (await repo.listRecurringBills({ includeInactive: true }))[0];
    expect(after.paidInstallments).toBe(3);
    expect(await repo.listTransactionsInRange('2026-01-01', '2027-01-01')).toHaveLength(1);
  });
});
