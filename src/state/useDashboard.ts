import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildCategoryBreakdown,
  compareMonthToDate,
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
import { todayLocalDate } from '@/domain/dates';
import {
  buildRecentPeriodWindows,
  getPeriod,
  previousPeriod,
  shouldShowNewCycleHint,
} from '@/domain/period';
import type { Category, LocalDate, Period, Transaction } from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export interface DashboardData {
  today: LocalDate;
  period: Period;
  prevPeriod: Period;
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
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboard(todayOverride?: LocalDate): DashboardData {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const today = todayOverride ?? todayLocalDate();
  const monthStartDay = settings.monthStartDay;
  const currency = settings.currency;

  const period = useMemo(() => getPeriod(today, monthStartDay), [today, monthStartDay]);
  const prevPeriod = useMemo(() => previousPeriod(period, monthStartDay), [period, monthStartDay]);
  const recentPeriods = useMemo(
    () => buildRecentPeriodWindows(today, monthStartDay, 6),
    [today, monthStartDay]
  );

  const [rangeTxs, setRangeTxs] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [overallBudgetMinor, setOverallBudgetMinor] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const earliestStart = recentPeriods[0].start;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await repo.ensureBudgetsForPeriod(period.start, prevPeriod.start);
        const [txs, recentPage, budgets, cats] = await Promise.all([
          repo.listTransactionsInRange(earliestStart, period.endExcl),
          repo.searchTransactions({}, { limit: 5 }),
          repo.getBudgets(period.start),
          repo.listCategories({ includeArchived: true }),
        ]);
        if (!active) return;

        const overall = budgets.find((b) => b.categoryId === '');
        const overallVal = overall && overall.amountMinor > 0 ? overall.amountMinor : null;

        setRangeTxs(txs);
        setRecentTransactions(recentPage.rows);
        setOverallBudgetMinor(overallVal);
        setCategories(cats);
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
  }, [repo, earliestStart, period.start, period.endExcl, prevPeriod.start, dataVersion, reloadTick]);

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

  const showNewCycleHint = useMemo(
    () => shouldShowNewCycleHint(period, today, previousCycleSpentMinor),
    [period, today, previousCycleSpentMinor]
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
    () => weeklySeries(rangeTxs, period, currency),
    [rangeTxs, period, currency]
  );

  const monthly = useMemo(
    () => monthlySeries(rangeTxs, recentPeriods, currency),
    [rangeTxs, recentPeriods, currency]
  );

  const mtdComparison = useMemo(
    () => compareMonthToDate(rangeTxs, today, monthStartDay, currency),
    [rangeTxs, today, monthStartDay, currency]
  );

  const reload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  return {
    today,
    period,
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
    loading,
    error,
    reload,
  };
}
