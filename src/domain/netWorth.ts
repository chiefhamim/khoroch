import { isSavingsAssetKind, type AccountBalanceEntry } from './accounts';
import { computeDuesOverview } from './dues';
import {
  isBillPaidInPeriod,
  isExpenseBillOutstanding,
  isInPeriodRange,
  summarizeUnpaidBillsDueInPeriod,
} from './calc';
import { remainingDays } from './period';
import type {
  CurrencyCode,
  DueEntry,
  LocalDate,
  Period,
  Person,
  RecurringBill,
  Transaction,
} from './types';

export interface NetWorthBreakdown {
  liquidAssetsMinor: number;
  savingsAssetsMinor: number;
  cardDebtMinor: number;
  receivableDuesMinor: number;
  payableDuesMinor: number;
  netDuesMinor: number;
  netWorthMinor: number;
  remainingEmiCommitmentMinor: number;
}

export interface ComputeNetWorthInput {
  balances: readonly AccountBalanceEntry[];
  people: readonly Person[];
  dueEntries: readonly DueEntry[];
  recurringBills?: readonly RecurringBill[];
}

/**
 * Computes true household Net Worth:
 * `liquid wallets + savings instruments (DPS/FDR/Sanchaypatra/Investments) + net dues − card debt`.
 * Tracks remaining unpaid future EMI commitments separately so users see committed debt too.
 */
export function computeNetWorth(input: ComputeNetWorthInput): NetWorthBreakdown {
  const { balances, people, dueEntries, recurringBills = [] } = input;

  let liquidAssetsMinor = 0;
  let savingsAssetsMinor = 0;
  let cardDebtMinor = 0;

  for (const entry of balances) {
    const { account, balanceMinor } = entry;
    if (account.archivedAt != null) continue;

    if (account.kind === 'credit_card') {
      if (balanceMinor < 0) {
        cardDebtMinor += Math.abs(balanceMinor);
      } else {
        liquidAssetsMinor += balanceMinor;
      }
      continue;
    }

    if (isSavingsAssetKind(account.kind)) {
      savingsAssetsMinor += balanceMinor;
      continue;
    }

    if (account.includeInTotal) {
      liquidAssetsMinor += balanceMinor;
    }
  }

  const duesOverview = computeDuesOverview(people, dueEntries);
  const receivableDuesMinor = duesOverview.youWillGetMinor;
  const payableDuesMinor = duesOverview.youOweMinor;
  const netDuesMinor = receivableDuesMinor - payableDuesMinor;

  let remainingEmiCommitmentMinor = 0;
  for (const bill of recurringBills) {
    if (!bill.isActive || bill.kind !== 'emi') continue;
    if (bill.totalInstallments == null) continue;
    const left = Math.max(0, bill.totalInstallments - bill.paidInstallments);
    remainingEmiCommitmentMinor += left * bill.amountMinor;
  }

  const netWorthMinor =
    liquidAssetsMinor + savingsAssetsMinor + netDuesMinor - cardDebtMinor;

  return {
    liquidAssetsMinor,
    savingsAssetsMinor,
    cardDebtMinor,
    receivableDuesMinor,
    payableDuesMinor,
    netDuesMinor,
    netWorthMinor,
    remainingEmiCommitmentMinor,
  };
}

/**
 * Sums MFS/bank transfer fees & fee-category expenses inside `period` without double-counting,
 * because `createTransfer` persists transfer fees as linked expense transactions with `categoryId='fees'`.
 */
export function computePeriodFeeTotal(
  transactions: readonly Transaction[],
  period: Period,
  currency: CurrencyCode
): number {
  let feesMinor = 0;
  for (const tx of transactions) {
    if (tx.deletedAt != null || tx.type !== 'expense' || tx.currency !== currency) continue;
    if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;
    if (tx.categoryId === 'fees' || tx.transferId != null) {
      feesMinor += tx.amountMinor;
    }
  }
  return feesMinor;
}

export interface BillsCommitmentSummary {
  activeExpenseBillsCount: number;
  paidCount: number;
  unpaidCount: number;
  paidBillsTotalMinor: number;
  unpaidBillsTotalMinor: number;
  uncommittedRemainingMinor: number | null;
  uncommittedSafePerDayMinor: number | null;
}

/**
 * Summarizes monthly bills, subscriptions, and EMIs for `period` and computes
 * true uncommitted safe-to-spend after reserving unpaid fixed commitments.
 */
export function computeUpcomingBillsCommitment(input: {
  bills: readonly RecurringBill[];
  /** The monthly BILL period: the paid and unpaid counts always use it. */
  period: Period;
  today: LocalDate;
  budgetRemainingMinor: number | null;
  /**
   * Weekly mode only: the current week and the month start day. The amount held back from the safe
   * per day then counts only unpaid bills due inside the week, over the days left in the week.
   */
  spendingWindow?: { period: Period; monthStartDay: number };
}): BillsCommitmentSummary {
  const { bills, period, today, budgetRemainingMinor, spendingWindow } = input;

  let activeExpenseBillsCount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let paidBillsTotalMinor = 0;
  let unpaidBillsTotalMinor = 0;

  for (const bill of bills) {
    if (!isExpenseBillOutstanding(bill)) continue;
    activeExpenseBillsCount += 1;
    if (isBillPaidInPeriod(bill, period)) {
      paidCount += 1;
      paidBillsTotalMinor += bill.amountMinor;
    } else {
      unpaidCount += 1;
      unpaidBillsTotalMinor += bill.amountMinor;
    }
  }

  if (spendingWindow) {
    const inWindow = summarizeUnpaidBillsDueInPeriod(
      bills,
      spendingWindow.period,
      spendingWindow.monthStartDay,
      period
    );
    unpaidCount = inWindow.unpaidCount;
    unpaidBillsTotalMinor = inWindow.unpaidMinor;
  }

  let uncommittedRemainingMinor: number | null = null;
  let uncommittedSafePerDayMinor: number | null = null;
  if (budgetRemainingMinor !== null) {
    uncommittedRemainingMinor = Math.max(0, budgetRemainingMinor - unpaidBillsTotalMinor);
    const daysLeft = remainingDays(spendingWindow ? spendingWindow.period : period, today);
    uncommittedSafePerDayMinor =
      daysLeft > 0 ? Math.floor(uncommittedRemainingMinor / daysLeft) : 0;
  }

  return {
    activeExpenseBillsCount,
    paidCount,
    unpaidCount,
    paidBillsTotalMinor,
    unpaidBillsTotalMinor,
    uncommittedRemainingMinor,
    uncommittedSafePerDayMinor,
  };
}
