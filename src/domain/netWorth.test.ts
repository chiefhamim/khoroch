import { describe, expect, it } from '@jest/globals';
import {
  computeNetWorth,
  computePeriodFeeTotal,
  computeUpcomingBillsCommitment,
} from './netWorth';
import type { Account, DueEntry, Period, Person, RecurringBill, Transaction } from './types';

function makeAcc(partial: Partial<Account> & Pick<Account, 'id' | 'kind'>): Account {
  return {
    name: partial.id,
    provider: null,
    colorKey: '#123227',
    monogram: null,
    last4: null,
    openingBalanceMinor: 0,
    openingDate: '2026-11-01',
    includeInTotal: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe('netWorth, fee intelligence & upcoming bills', () => {
  const period: Period = { start: '2026-11-01', endExcl: '2026-12-01', lengthDays: 30 };

  it('computes net worth from liquid wallets, DPS/FDR assets, dues, card debt, and EMIs', () => {
    const people: Person[] = [
      { id: 'p1', name: 'Tanvir', colorKey: 'blue', honorific: 'none', archivedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'p2', name: 'Rakib', colorKey: 'teal', honorific: 'none', archivedAt: null, createdAt: 1, updatedAt: 1 },
    ];
    const dues: DueEntry[] = [
      { id: 'd1', personId: 'p1', kind: 'lent', amountMinor: 50_000, accountId: null, occurredOn: '2026-11-05', occurredTime: null, dueOn: null, note: '', createdAt: 1, updatedAt: 1, deletedAt: null },
      { id: 'd2', personId: 'p2', kind: 'borrowed', amountMinor: 20_000, accountId: null, occurredOn: '2026-11-06', occurredTime: null, dueOn: null, note: '', createdAt: 1, updatedAt: 1, deletedAt: null },
    ];
    const bills: RecurringBill[] = [
      {
        id: 'b1',
        name: 'Phone EMI',
        kind: 'emi',
        amountMinor: 500_000,
        dayOfMonth: 10,
        categoryId: 'shopping',
        accountId: null,
        totalInstallments: 6,
        paidInstallments: 2,
        lastPaidPeriod: null,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const nw = computeNetWorth({
      balances: [
        { account: makeAcc({ id: 'cash', kind: 'cash' }), balanceMinor: 1_000_000, formattedBalance: '৳10,000', isDue: false },
        { account: makeAcc({ id: 'dps1', kind: 'dps', includeInTotal: false }), balanceMinor: 2_500_000, formattedBalance: '৳25,000', isDue: false },
        { account: makeAcc({ id: 'card1', kind: 'credit_card' }), balanceMinor: -400_000, formattedBalance: '৳4,000 due', isDue: true },
      ],
      people,
      dueEntries: dues,
      recurringBills: bills,
    });

    expect(nw.liquidAssetsMinor).toBe(1_000_000);
    expect(nw.savingsAssetsMinor).toBe(2_500_000);
    expect(nw.cardDebtMinor).toBe(400_000);
    expect(nw.netDuesMinor).toBe(30_000);
    expect(nw.netWorthMinor).toBe(3_130_000);
    expect(nw.remainingEmiCommitmentMinor).toBe(2_000_000);
  });

  it('sums transfer/MFS fee transactions once per period without double counting', () => {
    const txs: Transaction[] = [
      {
        id: 'tr1:fee',
        type: 'expense',
        amountMinor: 1_850,
        currency: 'BDT',
        categoryId: 'fees',
        accountId: 'bkash',
        transferId: 'tr1',
        description: 'Cash out fee',
        note: '',
        occurredOn: '2026-11-10',
        occurredTime: null,
        source: 'manual',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      },
      {
        id: 'tx_food',
        type: 'expense',
        amountMinor: 35_000,
        currency: 'BDT',
        categoryId: 'food_dining',
        accountId: 'cash',
        transferId: null,
        description: 'Lunch',
        note: '',
        occurredOn: '2026-11-10',
        occurredTime: null,
        source: 'manual',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      },
    ];

    expect(computePeriodFeeTotal(txs, period, 'BDT')).toBe(1_850);
  });

  it('reserves unpaid recurring bills when computing uncommitted safe-to-spend', () => {
    const bills: RecurringBill[] = [
      {
        id: 'b1',
        name: 'Rent',
        kind: 'bill',
        amountMinor: 1_500_000,
        dayOfMonth: 5,
        categoryId: 'housing',
        accountId: null,
        totalInstallments: null,
        paidInstallments: 0,
        lastPaidPeriod: null,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'b2',
        name: 'Wi-Fi',
        kind: 'bill',
        amountMinor: 100_000,
        dayOfMonth: 10,
        categoryId: 'utilities',
        accountId: null,
        totalInstallments: null,
        paidInstallments: 0,
        lastPaidPeriod: '2026-11-01',
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const res = computeUpcomingBillsCommitment({
      bills,
      period,
      today: '2026-11-16',
      budgetRemainingMinor: 2_250_000,
    });

    expect(res.unpaidCount).toBe(1);
    expect(res.paidCount).toBe(1);
    expect(res.unpaidBillsTotalMinor).toBe(1_500_000);
    expect(res.uncommittedRemainingMinor).toBe(750_000);
    // 15 remaining days inclusive in Nov (16..30) -> 750,000 / 15 = 50,000
    expect(res.uncommittedSafePerDayMinor).toBe(50_000);
  });

  it('counts a bill stamped inside the period as paid after the cycle day changed', () => {
    const res = computeUpcomingBillsCommitment({
      bills: [
        {
          id: 'b3',
          name: 'Water',
          kind: 'bill',
          amountMinor: 200_000,
          dayOfMonth: 5,
          categoryId: 'utilities',
          accountId: null,
          totalInstallments: null,
          paidInstallments: 0,
          // Not the period start: left over from the old cycle day.
          lastPaidPeriod: '2026-11-12',
          isActive: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      period,
      today: '2026-11-16',
      budgetRemainingMinor: 1_000_000,
    });
    expect(res.paidCount).toBe(1);
    expect(res.unpaidCount).toBe(0);
    expect(res.uncommittedRemainingMinor).toBe(1_000_000);
  });
});
