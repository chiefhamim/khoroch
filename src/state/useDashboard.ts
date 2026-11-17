import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildCategoryBreakdown,
  compareMonthToDate,
  computeAfterBills,
  recentPeriodsSeries,
  summarizeUnpaidBills,
  summarizeUnpaidBillsDueInPeriod,
  type AfterBillsSummary,
  dailySeries,
  monthlySeries,
  spendByCategory,
  summarize,
  weeklySeries,
  type CategoryBreakdownSlice,
  type DailySeriesPoint,
  type MonthlySeriesPoint,
  type PeriodComparison,
  type PeriodSummary,
  type WeeklySeriesPoint,
} from '@/domain/calc';
import { diffDays, todayLocalDate } from '@/domain/dates';
import {
  computePeriodFeeTotal,
  computeUpcomingBillsCommitment,
  type BillsCommitmentSummary,
} from '@/domain/netWorth';
import {
  buildRecentPeriodWindows,
  buildRecentSpendingWindows,
  getBillPeriod,
  getSpendingPeriod,
  previousPeriod,
  previousSpendingPeriod,
  remainingDays,
  shouldShowNewCycleHint,
  type PeriodConfig,
} from '@/domain/period';
import {
  normalizePeriodWeekStartDay,
  normalizeWeeklyBudgetMinor,
  type Category,
  type LocalDate,
  type Period,
  type PeriodKind,
  type RecurringBill,
  type Transaction,
} from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export interface DashboardData {
  today: LocalDate;
  /** 'month' (default) or 'week'. */
  periodKind: PeriodKind;
  /** The SPENDING period: the week in weekly mode, otherwise the monthly cycle. */
  period: Period;
  /** The monthly BILL period. Equal to `period` in monthly mode. */
  billPeriod: Period;
  prevPeriod: Period;
  /** The budget for the spending period: the weekly amount in weekly mode, otherwise the monthly total. */
  overallBudgetMinor: number | null;
  summary: PeriodSummary;
  previousCycleSpentMinor: number;
  showNewCycleHint: boolean;
  categoryBreakdown: CategoryBreakdownSlice[];
  daily: DailySeriesPoint[];
  weekly: WeeklySeriesPoint[];
  monthly: MonthlySeriesPoint[];
  mtdComparison: PeriodComparison;
  recentTransactions: Transaction[];
  categoriesById: Map<string, Category>;
  recurringBills: RecurringBill[];
  billsCommitment: BillsCommitmentSummary;
  afterBills: AfterBillsSummary;
  periodFeesMinor: number;
  dailyBudgetLimitMinor: number | null;
  pendingDraftsCount: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboard(todayOverride?: LocalDate): DashboardData {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const today = todayOverride ?? todayLocalDate();
  const monthStartDay = settings.monthStartDay;
  const periodKind: PeriodKind = settings.periodKind === 'week' ? 'week' : 'month';
  const weekStartDay = normalizePeriodWeekStartDay(settings.weekStartDay);
  const weeklyBudgetMinor = normalizeWeeklyBudgetMinor(settings.weeklyBudgetMinor);
  const currency = settings.currency;
  const isWeekly = periodKind === 'week';

  const periodConfig = useMemo<PeriodConfig>(
    () => ({ periodKind, weekStartDay, monthStartDay }),
    [periodKind, weekStartDay, monthStartDay]
  );
  const period = useMemo(() => getSpendingPeriod(today, periodConfig), [today, periodConfig]);
  const prevPeriod = useMemo(
    () => previousSpendingPeriod(period, periodConfig),
    [period, periodConfig]
  );
  // The monthly cycle: bills, the paid badge and the stored monthly budgets always use it.
  const billPeriod = useMemo(() => getBillPeriod(today, monthStartDay), [today, monthStartDay]);
  const prevBillPeriod = useMemo(
    () => previousPeriod(billPeriod, monthStartDay),
    [billPeriod, monthStartDay]
  );
  const recentPeriods = useMemo(
    () => buildRecentPeriodWindows(today, monthStartDay, 6),
    [today, monthStartDay]
  );
  const recentWeeks = useMemo(
    () => (isWeekly ? buildRecentSpendingWindows(today, periodConfig, 6) : []),
    [isWeekly, today, periodConfig]
  );

  const [rangeTxs, setRangeTxs] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthlyBudgetMinor, setMonthlyBudgetMinor] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // The six monthly windows reach back further than six weeks, so one range covers both.
  const earliestStart = recentPeriods[0].start;
  const rangeEndExcl = period.endExcl > billPeriod.endExcl ? period.endExcl : billPeriod.endExcl;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await repo.ensureBudgetsForPeriod(billPeriod.start, prevBillPeriod.start);
        const [txs, recentPage, budgets, cats, bills, pendingDrafts] = await Promise.all([
          repo.listTransactionsInRange(earliestStart, rangeEndExcl),
          repo.searchTransactions({}, { limit: 5 }),
          repo.getBudgets(billPeriod.start),
          repo.listCategories({ includeArchived: true }),
          repo.listRecurringBills(),
          repo.listPendingDrafts({ status: 'pending' }),
        ]);
        if (!active) return;

        const overall = budgets.find((b) => b.categoryId === '');
        const overallVal = overall && overall.amountMinor > 0 ? overall.amountMinor : null;

        setRangeTxs(txs);
        setRecentTransactions(recentPage.rows);
        setMonthlyBudgetMinor(overallVal);
        setCategories(cats);
        setRecurringBills(bills);
        setPendingDraftsCount(pendingDrafts.length);
        setError(null);
      } catch {
        if (!active) return;
        setError('load_failed');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    repo,
    earliestStart,
    rangeEndExcl,
    billPeriod.start,
    prevBillPeriod.start,
    dataVersion,
    reloadTick,
  ]);

  // Weekly mode has its own stored amount; the monthly amount is never converted or touched.
  const overallBudgetMinor = isWeekly ? weeklyBudgetMinor : monthlyBudgetMinor;

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  const summary = useMemo(
    () =>
      summarize({
        transactions: rangeTxs,
        period,
        today,
        overallBudgetMinor,
        currency,
      }),
    [rangeTxs, period, today, overallBudgetMinor, currency]
  );

  const previousCycleSpentMinor = useMemo(
    () =>
      summarize({
        transactions: rangeTxs,
        period: prevPeriod,
        today,
        overallBudgetMinor: null,
        currency,
      }).spentMinor,
    [rangeTxs, prevPeriod, today, currency]
  );

  // "New cycle started" is a monthly notice; a week turns over too often to announce.
  const showNewCycleHint = useMemo(
    () => !isWeekly && shouldShowNewCycleHint(period, today, previousCycleSpentMinor),
    [isWeekly, period, today, previousCycleSpentMinor]
  );

  const categoryBreakdown = useMemo(() => {
    const allSpend = spendByCategory(rangeTxs, period, currency);
    return buildCategoryBreakdown(allSpend, summary.spentMinor, 5);
  }, [rangeTxs, period, currency, summary.spentMinor]);

  const daily = useMemo(
    () => dailySeries(rangeTxs, period, currency),
    [rangeTxs, period, currency]
  );

  const weekly = useMemo(
    () =>
      isWeekly
        ? recentPeriodsSeries(rangeTxs, recentWeeks, currency)
        : weeklySeries(rangeTxs, period, currency),
    [isWeekly, rangeTxs, recentWeeks, period, currency]
  );

  const monthly = useMemo(
    () => monthlySeries(rangeTxs, recentPeriods, currency),
    [rangeTxs, recentPeriods, currency]
  );

  const mtdComparison = useMemo(
    () => compareMonthToDate(rangeTxs, today, monthStartDay, currency),
    [rangeTxs, today, monthStartDay, currency]
  );

  const periodFeesMinor = useMemo(
    () => computePeriodFeeTotal(rangeTxs, period, currency),
    [rangeTxs, period, currency]
  );

  const billsCommitment = useMemo(
    () =>
      computeUpcomingBillsCommitment({
        bills: recurringBills,
        period: billPeriod,
        today,
        budgetRemainingMinor: summary.remainingMinor,
        spendingWindow: isWeekly ? { period, monthStartDay } : undefined,
      }),
    [recurringBills, billPeriod, today, summary.remainingMinor, isWeekly, period, monthStartDay]
  );

  const afterBills = useMemo(() => {
    const unpaid = isWeekly
      ? summarizeUnpaidBillsDueInPeriod(recurringBills, period, monthStartDay)
      : summarizeUnpaidBills(recurringBills, billPeriod);
    return computeAfterBills({
      remainingMinor: summary.remainingMinor,
      unpaidBillsMinor: unpaid.unpaidMinor,
      unpaidCount: unpaid.unpaidCount,
      daysLeft: remainingDays(period, today),
    });
  }, [recurringBills, billPeriod, period, today, summary.remainingMinor, isWeekly, monthStartDay]);

  const dailyBudgetLimitMinor = useMemo(() => {
    if (overallBudgetMinor === null || overallBudgetMinor <= 0) return null;
    const totalDays = Math.max(1, diffDays(period.endExcl, period.start));
    return Math.floor(overallBudgetMinor / totalDays);
  }, [overallBudgetMinor, period.start, period.endExcl]);

  const reload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  return {
    today,
    periodKind,
    period,
    billPeriod,
    prevPeriod,
    overallBudgetMinor,
    summary,
    previousCycleSpentMinor,
    showNewCycleHint,
    categoryBreakdown,
    daily,
    weekly,
    monthly,
    mtdComparison,
    recentTransactions,
    categoriesById,
    recurringBills,
    billsCommitment,
    afterBills,
    periodFeesMinor,
    dailyBudgetLimitMinor,
    pendingDraftsCount,
    loading,
    error,
    reload,
  };
}
