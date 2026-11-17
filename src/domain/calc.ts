import { addDays, diffDays } from './dates';
import { elapsedDays, getPeriod, previousPeriod, remainingDays } from './period';
import type {
  Budget,
  BudgetStatus,
  CurrencyCode,
  LocalDate,
  Period,
  RecurringBill,
  Transaction,
} from './types';

function roundHalfUpDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function computeBudgetStatus(
  spentMinor: number,
  budgetMinor: number | null | undefined
): BudgetStatus {
  if (budgetMinor == null || budgetMinor <= 0) return 'no_budget';
  if (spentMinor > budgetMinor) return 'over';
  if (spentMinor === budgetMinor) return 'reached';
  if (spentMinor * 100 >= budgetMinor * 85) return 'attention';
  if (spentMinor * 100 >= budgetMinor * 70) return 'info';
  return 'ok';
}

export function isInPeriodRange(occurredOn: LocalDate, start: LocalDate, endExcl: LocalDate): boolean {
  return occurredOn >= start && occurredOn < endExcl;
}

function isBetterLargestExpense(candidate: Transaction, currentBest: Transaction | null): boolean {
  if (!currentBest) return true;
  if (candidate.amountMinor !== currentBest.amountMinor) {
    return candidate.amountMinor > currentBest.amountMinor;
  }
  if (candidate.occurredOn !== currentBest.occurredOn) {
    return candidate.occurredOn > currentBest.occurredOn;
  }
  if (candidate.createdAt !== currentBest.createdAt) {
    return candidate.createdAt > currentBest.createdAt;
  }
  return candidate.id > currentBest.id;
}

export interface SummarizeInput {
  transactions: readonly Transaction[];
  period: Period;
  today: LocalDate;
  overallBudgetMinor: number | null;
  currency: CurrencyCode;
}

export interface PeriodSummary {
  spentMinor: number;
  incomeMinor: number;
  remainingMinor: number | null;
  utilizationPct: number | null;
  dailyAverageMinor: number;
  safeToSpendPerDayMinor: number | null;
  status: BudgetStatus;
  expenseCount: number;
  averageTransactionMinor: number | null;
  largestExpense: Transaction | null;
  topCategoryId: string | null;
  ignoredOtherCurrencyCount: number;
}

export function summarize(input: SummarizeInput): PeriodSummary {
  const { transactions, period, today, overallBudgetMinor, currency } = input;

  let spentMinor = 0;
  let spentUpToTodayMinor = 0;
  let incomeMinor = 0;
  let expenseCount = 0;
  let largestExpense: Transaction | null = null;
  let ignoredOtherCurrencyCount = 0;

  const categoryTotals = new Map<string, { spentMinor: number; count: number }>();

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;

    if (tx.currency !== currency) {
      ignoredOtherCurrencyCount++;
      continue;
    }

    if (tx.type === 'expense') {
      spentMinor += tx.amountMinor;
      expenseCount++;
      if (tx.occurredOn <= today) {
        spentUpToTodayMinor += tx.amountMinor;
      }
      if (isBetterLargestExpense(tx, largestExpense)) {
        largestExpense = tx;
      }
      const catId = tx.categoryId ?? 'other';
      const prev = categoryTotals.get(catId);
      if (prev) {
        prev.spentMinor += tx.amountMinor;
        prev.count += 1;
      } else {
        categoryTotals.set(catId, { spentMinor: tx.amountMinor, count: 1 });
      }
    } else if (tx.type === 'income') {
      incomeMinor += tx.amountMinor;
    }
  }

  let topCategoryId: string | null = null;
  let topCategorySpent = -1;
  let topCategoryCount = -1;
  for (const [catId, stats] of categoryTotals.entries()) {
    if (
      stats.spentMinor > topCategorySpent ||
      (stats.spentMinor === topCategorySpent && stats.count > topCategoryCount)
    ) {
      topCategoryId = catId;
      topCategorySpent = stats.spentMinor;
      topCategoryCount = stats.count;
    }
  }

  const hasBudget = overallBudgetMinor != null && overallBudgetMinor > 0;
  const remainingMinor = hasBudget ? overallBudgetMinor - spentMinor : null;
  const utilizationPct = hasBudget ? (spentMinor / overallBudgetMinor) * 100 : null;
  const status = computeBudgetStatus(spentMinor, overallBudgetMinor);

  const elapsed = elapsedDays(period, today);
  const dailyAverageMinor = elapsed > 0 ? roundHalfUpDiv(spentUpToTodayMinor, elapsed) : 0;

  const remaining = remainingDays(period, today);
  let safeToSpendPerDayMinor: number | null = null;
  if (hasBudget && remainingMinor !== null) {
    if (remainingMinor <= 0 || remaining <= 0) {
      safeToSpendPerDayMinor = 0;
    } else {
      safeToSpendPerDayMinor = Math.floor(remainingMinor / remaining);
    }
  }

  const averageTransactionMinor =
    expenseCount > 0 ? roundHalfUpDiv(spentMinor, expenseCount) : null;

  return {
    spentMinor,
    incomeMinor,
    remainingMinor,
    utilizationPct,
    dailyAverageMinor,
    safeToSpendPerDayMinor,
    status,
    expenseCount,
    averageTransactionMinor,
    largestExpense,
    topCategoryId,
    ignoredOtherCurrencyCount,
  };
}

/**
 * A bill that still has money going out: active, not a salary, and not a finished EMI.
 * Shared by every bills figure so there is one rule.
 */
export function isExpenseBillOutstanding(bill: RecurringBill): boolean {
  if (!bill.isActive || bill.kind === 'salary') return false;
  if (
    bill.kind === 'emi' &&
    bill.totalInstallments != null &&
    bill.paidInstallments >= bill.totalInstallments
  ) {
    return false;
  }
  return true;
}

/**
 * The one paid rule: a bill is paid for a period when it is stamped `lastPaidPeriod === period.start`.
 * Marking a bill paid stamps it and records its transaction together, so a paid bill is already inside
 * "spent" and must never be subtracted again.
 */
export function isBillPaidInPeriod(bill: RecurringBill, period: Pick<Period, 'start'>): boolean {
  return bill.lastPaidPeriod === period.start;
}

export interface UnpaidBillsSummary {
  unpaidCount: number;
  unpaidMinor: number;
}

export function summarizeUnpaidBills(
  bills: readonly RecurringBill[],
  period: Pick<Period, 'start'>
): UnpaidBillsSummary {
  let unpaidCount = 0;
  let unpaidMinor = 0;
  for (const bill of bills) {
    if (!isExpenseBillOutstanding(bill) || isBillPaidInPeriod(bill, period)) continue;
    unpaidCount += 1;
    unpaidMinor += bill.amountMinor;
  }
  return { unpaidCount, unpaidMinor };
}

export interface AfterBillsSummary {
  unpaidCount: number;
  unpaidBillsMinor: number;
  /** Budget left minus unpaid bills. Negative means short. Null when there is no budget. */
  leftAfterBillsMinor: number | null;
  /** Floor of left-after-bills per remaining day, never below zero. Null when there is no budget. */
  safePerDayAfterBillsMinor: number | null;
}

export function computeAfterBills(input: {
  remainingMinor: number | null;
  unpaidBillsMinor: number;
  unpaidCount: number;
  daysLeft: number;
}): AfterBillsSummary {
  const { remainingMinor, unpaidBillsMinor, unpaidCount, daysLeft } = input;
  if (remainingMinor === null) {
    return { unpaidCount, unpaidBillsMinor, leftAfterBillsMinor: null, safePerDayAfterBillsMinor: null };
  }
  const leftAfterBillsMinor = remainingMinor - unpaidBillsMinor;
  const safePerDayAfterBillsMinor =
    leftAfterBillsMinor <= 0 || daysLeft <= 0 ? 0 : Math.floor(leftAfterBillsMinor / daysLeft);
  return { unpaidCount, unpaidBillsMinor, leftAfterBillsMinor, safePerDayAfterBillsMinor };
}

export interface CategorySpend {
  categoryId: string;
  spentMinor: number;
  count: number;
}

export function spendByCategory(
  transactions: readonly Transaction[],
  period: Period,
  currency: CurrencyCode
): CategorySpend[] {
  const map = new Map<string, CategorySpend>();
  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;

    const categoryId = tx.categoryId ?? 'other';
    const existing = map.get(categoryId);
    if (existing) {
      existing.spentMinor += tx.amountMinor;
      existing.count += 1;
    } else {
      map.set(categoryId, { categoryId, spentMinor: tx.amountMinor, count: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.spentMinor !== a.spentMinor) return b.spentMinor - a.spentMinor;
    if (b.count !== a.count) return b.count - a.count;
    return a.categoryId.localeCompare(b.categoryId);
  });
}

export interface CategoryBudgetItem {
  categoryId: string;
  budgetMinor: number;
  spentMinor: number;
  remainingMinor: number;
  utilizationPct: number | null;
  status: BudgetStatus;
}

export function categoryBudgetStatus(
  transactions: readonly Transaction[],
  budgets: readonly Budget[],
  period: Period,
  currency: CurrencyCode
): CategoryBudgetItem[] {
  const spentMap = new Map<string, number>();
  for (const item of spendByCategory(transactions, period, currency)) {
    spentMap.set(item.categoryId, item.spentMinor);
  }

  return budgets
    .filter((b) => b.periodStart === period.start && b.categoryId !== '')
    .map((b) => {
      const spentMinor = spentMap.get(b.categoryId) ?? 0;
      const hasBudget = b.amountMinor > 0;
      return {
        categoryId: b.categoryId,
        budgetMinor: b.amountMinor,
        spentMinor,
        remainingMinor: b.amountMinor - spentMinor,
        utilizationPct: hasBudget ? (spentMinor / b.amountMinor) * 100 : null,
        status: computeBudgetStatus(spentMinor, b.amountMinor),
      };
    });
}

export interface DailySeriesPoint {
  day: LocalDate;
  spentMinor: number;
}

export function dailySeries(
  transactions: readonly Transaction[],
  period: Period,
  currency: CurrencyCode
): DailySeriesPoint[] {
  const totals = new Map<LocalDate, number>();
  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;

    totals.set(tx.occurredOn, (totals.get(tx.occurredOn) ?? 0) + tx.amountMinor);
  }

  const points: DailySeriesPoint[] = [];
  for (let i = 0; i < period.lengthDays; i++) {
    const day = addDays(period.start, i);
    points.push({ day, spentMinor: totals.get(day) ?? 0 });
  }
  return points;
}

export interface WeeklySeriesPoint {
  weekIndex: number;
  start: LocalDate;
  endExcl: LocalDate;
  spentMinor: number;
}

export function weeklySeries(
  transactions: readonly Transaction[],
  period: Period,
  currency: CurrencyCode
): WeeklySeriesPoint[] {
  const days = dailySeries(transactions, period, currency);
  const weeks: WeeklySeriesPoint[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    let spentMinor = 0;
    for (const d of slice) {
      spentMinor += d.spentMinor;
    }
    const start = slice[0].day;
    const endExcl = addDays(slice[slice.length - 1].day, 1);
    weeks.push({
      weekIndex: weeks.length + 1,
      start,
      endExcl,
      spentMinor,
    });
  }
  return weeks;
}

export interface MonthlySeriesPoint {
  period: Period;
  spentMinor: number;
  incomeMinor: number;
}

export function monthlySeries(
  transactions: readonly Transaction[],
  months: readonly Period[],
  currency: CurrencyCode
): MonthlySeriesPoint[] {
  return months.map((period) => {
    let spentMinor = 0;
    let incomeMinor = 0;
    for (const tx of transactions) {
      if (tx.deletedAt != null || tx.currency !== currency) continue;
      if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;
      if (tx.type === 'expense') spentMinor += tx.amountMinor;
      else if (tx.type === 'income') incomeMinor += tx.amountMinor;
    }
    return { period, spentMinor, incomeMinor };
  });
}

function sumExpenseInRange(
  transactions: readonly Transaction[],
  fromIncl: LocalDate,
  toExcl: LocalDate,
  currency: CurrencyCode
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (tx.occurredOn >= fromIncl && tx.occurredOn < toExcl) {
      total += tx.amountMinor;
    }
  }
  return total;
}

export interface PeriodComparison {
  currentMinor: number;
  previousMinor: number;
  diffMinor: number;
  pctChange: number | null;
  daysCompared: number;
}

export function compareMonthToDate(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  currency: CurrencyCode
): PeriodComparison {
  const currentPeriod = getPeriod(today, monthStartDay);
  const prevPeriod = previousPeriod(currentPeriod, monthStartDay);

  const daysCompared = elapsedDays(currentPeriod, today);
  const currentEndExcl = addDays(currentPeriod.start, daysCompared);
  const prevDaysCompared = Math.min(daysCompared, prevPeriod.lengthDays);
  const prevEndExcl = addDays(prevPeriod.start, prevDaysCompared);

  const currentMinor = sumExpenseInRange(
    transactions,
    currentPeriod.start,
    currentEndExcl,
    currency
  );
  const previousMinor = sumExpenseInRange(transactions, prevPeriod.start, prevEndExcl, currency);
  const diffMinor = currentMinor - previousMinor;
  const pctChange = previousMinor === 0 ? null : (diffMinor / previousMinor) * 100;

  return {
    currentMinor,
    previousMinor,
    diffMinor,
    pctChange,
    daysCompared,
  };
}

export interface FullPeriodComparison {
  currentPeriod: Period;
  previousPeriod: Period;
  currentMinor: number;
  previousMinor: number;
  diffMinor: number;
  pctChange: number | null;
}

export function compareFullPeriods(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  currency: CurrencyCode
): FullPeriodComparison {
  const activePeriod = getPeriod(today, monthStartDay);
  const lastComplete = previousPeriod(activePeriod, monthStartDay);
  const beforeLast = previousPeriod(lastComplete, monthStartDay);

  const currentMinor = sumExpenseInRange(
    transactions,
    lastComplete.start,
    lastComplete.endExcl,
    currency
  );
  const previousMinor = sumExpenseInRange(
    transactions,
    beforeLast.start,
    beforeLast.endExcl,
    currency
  );
  const diffMinor = currentMinor - previousMinor;
  const pctChange = previousMinor === 0 ? null : (diffMinor / previousMinor) * 100;

  return {
    currentPeriod: lastComplete,
    previousPeriod: beforeLast,
    currentMinor,
    previousMinor,
    diffMinor,
    pctChange,
  };
}

export function sumDailyExpenses(transactions: readonly Transaction[], currency: CurrencyCode): Map<LocalDate, number> {
  const map = new Map<LocalDate, number>();
  for (const tx of transactions) {
    if (tx.deletedAt != null || tx.currency !== currency) continue;
    const delta = tx.type === 'expense' ? tx.amountMinor : 0;
    map.set(tx.occurredOn, (map.get(tx.occurredOn) ?? 0) + delta);
  }
  return map;
}

export function daysBetweenInclusive(start: LocalDate, endIncl: LocalDate): number {
  if (endIncl < start) return 0;
  return diffDays(endIncl, start) + 1;
}

export interface DailyTransactionGroup {
  date: LocalDate;
  expenseMinor: number;
  incomeMinor: number;
  transactions: Transaction[];
}

/**
 * Groups already-sorted transactions by local calendar date and computes daily
 * expense and income totals in minor units (active currency only, excluding deleted).
 */
export function groupTransactionsByDate(
  transactions: readonly Transaction[],
  currency: CurrencyCode
): DailyTransactionGroup[] {
  const groups: DailyTransactionGroup[] = [];
  const byDate = new Map<LocalDate, DailyTransactionGroup>();

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    let group = byDate.get(tx.occurredOn);
    if (!group) {
      group = {
        date: tx.occurredOn,
        expenseMinor: 0,
        incomeMinor: 0,
        transactions: [],
      };
      byDate.set(tx.occurredOn, group);
      groups.push(group);
    }
    group.transactions.push(tx);
    if (tx.currency === currency) {
      if (tx.type === 'expense') group.expenseMinor += tx.amountMinor;
      else if (tx.type === 'income') group.incomeMinor += tx.amountMinor;
    }
  }

  return groups;
}

/**
 * Formats utilization percentage to at most 1 decimal place (omitting `.0`).
 */
export function formatUtilizationPct(pct: number): string {
  const roundedTenths = Math.round(pct * 10);
  if (roundedTenths % 10 === 0) {
    return `${Math.floor(roundedTenths / 10)}%`;
  }
  return `${(roundedTenths / 10).toFixed(1)}%`;
}

export interface CategoryBreakdownSlice {
  categoryId: string | null;
  spentMinor: number;
  count: number;
  sharePct: number;
  isOtherGroup: boolean;
}

/**
 * Groups spendByCategory output into at most `maxCategories` top items plus an aggregated
 * "Other" bucket when more categories exist.
 */
export function buildCategoryBreakdown(
  items: readonly CategorySpend[],
  totalSpentMinor: number,
  maxCategories: number = 5
): CategoryBreakdownSlice[] {
  if (items.length === 0) return [];
  const denom = totalSpentMinor > 0 ? totalSpentMinor : 1;

  if (items.length <= maxCategories) {
    return items.map((item) => ({
      categoryId: item.categoryId,
      spentMinor: item.spentMinor,
      count: item.count,
      sharePct: (item.spentMinor / denom) * 100,
      isOtherGroup: false,
    }));
  }

  const top: CategoryBreakdownSlice[] = items.slice(0, maxCategories).map((item) => ({
    categoryId: item.categoryId,
    spentMinor: item.spentMinor,
    count: item.count,
    sharePct: (item.spentMinor / denom) * 100,
    isOtherGroup: false,
  }));

  let restSpent = 0;
  let restCount = 0;
  for (const item of items.slice(maxCategories)) {
    restSpent += item.spentMinor;
    restCount += item.count;
  }

  if (restSpent > 0) {
    top.push({
      categoryId: null,
      spentMinor: restSpent,
      count: restCount,
      sharePct: (restSpent / denom) * 100,
      isOtherGroup: true,
    });
  }

  return top;
}

export interface BudgetAllocationSummary {
  overallBudgetMinor: number | null;
  allocatedMinor: number;
  unallocatedMinor: number | null; // negative means category budgets exceed overall budget
}

export function summarizeBudgetAllocation(
  overallBudgetMinor: number | null,
  categoryBudgets: readonly CategoryBudgetItem[]
): BudgetAllocationSummary {
  let allocatedMinor = 0;
  for (const b of categoryBudgets) {
    allocatedMinor += b.budgetMinor;
  }
  return {
    overallBudgetMinor,
    allocatedMinor,
    unallocatedMinor: overallBudgetMinor !== null ? overallBudgetMinor - allocatedMinor : null,
  };
}

export interface CategoryPeriodExpenses {
  transactions: Transaction[];
  spentMinor: number;
  count: number;
}

export function summarizeCategoryExpenses(
  transactions: readonly Transaction[],
  period: Pick<Period, 'start' | 'endExcl'>,
  categoryId: string,
  currency: CurrencyCode
): CategoryPeriodExpenses {
  let spentMinor = 0;
  const filtered: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (!isInPeriodRange(tx.occurredOn, period.start, period.endExcl)) continue;
    if ((tx.categoryId ?? 'other') !== categoryId) continue;
    filtered.push(tx);
    spentMinor += tx.amountMinor;
  }

  filtered.sort((a, b) => {
    if (b.occurredOn !== a.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.id.localeCompare(b.id);
  });

  return {
    transactions: filtered,
    spentMinor,
    count: filtered.length,
  };
}

export interface DayActivitySummary {
  expenseMinor: number;
  incomeMinor: number;
  count: number;
  transactions: Transaction[];
}

export function summarizeDayActivity(
  transactions: readonly Transaction[],
  date: LocalDate,
  currency: CurrencyCode
): DayActivitySummary {
  let expenseMinor = 0;
  let incomeMinor = 0;
  const matching: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.occurredOn !== date) continue;
    matching.push(tx);
    if (tx.currency !== currency) continue;
    if (tx.type === 'expense') {
      expenseMinor += tx.amountMinor;
    } else {
      incomeMinor += tx.amountMinor;
    }
  }

  matching.sort((a, b) => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.id.localeCompare(b.id);
  });

  return {
    expenseMinor,
    incomeMinor,
    count: matching.length,
    transactions: matching,
  };
}

