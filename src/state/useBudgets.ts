import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  categoryBudgetStatus,
  spendByCategory,
  summarize,
  summarizeBudgetAllocation,
  type BudgetAllocationSummary,
  type CategoryBudgetItem,
  type CategorySpend,
  type PeriodSummary,
} from '@/domain/calc';
import { todayLocalDate } from '@/domain/dates';
import { getPeriod, previousPeriod, remainingDays } from '@/domain/period';
import type { Budget, Category, LocalDate, Period, Transaction } from '@/domain/types';
import { useAppContext } from './AppContext';
import { bumpDataVersion, useDataVersionStore } from './dataVersion';

export interface HistoricalPeriodBudget {
  period: Period;
  overallBudgetMinor: number | null;
  spentMinor: number;
  utilizationPct: number | null;
  status: PeriodSummary['status'];
}

export interface UseBudgetsResult {
  period: Period;
  remainingDaysCount: number;
  overallBudgetMinor: number | null;
  overallSummary: PeriodSummary;
  categoryBudgets: CategoryBudgetItem[];
  spendRanking: CategorySpend[];
  allocation: BudgetAllocationSummary;
  history: HistoricalPeriodBudget[];
  categories: Category[];
  categoriesById: Map<string, Category>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setOverallBudget: (amountMinor: number) => Promise<void>;
  removeOverallBudget: () => Promise<void>;
  setCategoryBudget: (categoryId: string, amountMinor: number) => Promise<void>;
  removeCategoryBudget: (categoryId: string) => Promise<void>;
}

export function useBudgets(todayOverride?: LocalDate): UseBudgetsResult {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const today = todayOverride ?? todayLocalDate();
  const monthStartDay = settings.monthStartDay;
  const currency = settings.currency;

  const period = useMemo(() => getPeriod(today, monthStartDay), [today, monthStartDay]);
  const prevPeriod = useMemo(() => previousPeriod(period, monthStartDay), [period, monthStartDay]);
  const remainingDaysCount = useMemo(() => remainingDays(period, today), [period, today]);

  const [currentBudgets, setCurrentBudgets] = useState<Budget[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await repo.ensureBudgetsForPeriod(period.start, prevPeriod.start);
        const [curBudgets, everyBudget, cats] = await Promise.all([
          repo.getBudgets(period.start),
          repo.getAllBudgets(),
          repo.listCategories({ includeArchived: true }),
        ]);

        let minStart = prevPeriod.start;
        for (const b of everyBudget) {
          if (b.periodStart < minStart) {
            minStart = b.periodStart;
          }
        }
        const txs = await repo.listTransactionsInRange(minStart, period.endExcl);
        if (!active) return;

        setCurrentBudgets(curBudgets);
        setAllBudgets(everyBudget);
        setCategories(cats);
        setTransactions(txs);
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
  }, [repo, period.start, period.endExcl, prevPeriod.start, dataVersion, reloadTick]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const overallBudgetMinor = useMemo(() => {
    const row = currentBudgets.find((b) => b.categoryId === '');
    return row && row.amountMinor > 0 ? row.amountMinor : null;
  }, [currentBudgets]);

  const overallSummary = useMemo(
    () =>
      summarize({
        transactions,
        period,
        today,
        overallBudgetMinor,
        currency,
      }),
    [transactions, period, today, overallBudgetMinor, currency]
  );

  const categoryBudgets = useMemo(() => {
    const list = categoryBudgetStatus(transactions, currentBudgets, period, currency);
    return list.sort((a, b) => {
      const aPct = a.utilizationPct ?? -1;
      const bPct = b.utilizationPct ?? -1;
      if (bPct !== aPct) return bPct - aPct;
      return b.spentMinor - a.spentMinor;
    });
  }, [transactions, currentBudgets, period, currency]);

  const spendRanking = useMemo(
    () =>
      spendByCategory(transactions, period, currency)
        .filter((row) => row.spentMinor > 0)
        .sort((a, b) => b.spentMinor - a.spentMinor),
    [transactions, period, currency]
  );

  const allocation = useMemo(
    () => summarizeBudgetAllocation(overallBudgetMinor, categoryBudgets),
    [overallBudgetMinor, categoryBudgets]
  );

  const history = useMemo<HistoricalPeriodBudget[]>(() => {
    const pastStarts = new Set<LocalDate>();
    for (const b of allBudgets) {
      if (b.periodStart < period.start) {
        pastStarts.add(b.periodStart);
      }
    }
    const sorted = Array.from(pastStarts).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return sorted.map((ps) => {
      const p = getPeriod(ps, monthStartDay);
      const overall = allBudgets.find((b) => b.periodStart === ps && b.categoryId === '');
      const budgetMinor = overall && overall.amountMinor > 0 ? overall.amountMinor : null;
      const sum = summarize({
        transactions,
        period: p,
        today: p.endExcl,
        overallBudgetMinor: budgetMinor,
        currency,
      });
      return {
        period: p,
        overallBudgetMinor: budgetMinor,
        spentMinor: sum.spentMinor,
        utilizationPct: sum.utilizationPct,
        status: sum.status,
      };
    });
  }, [allBudgets, period.start, monthStartDay, transactions, currency]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const setOverallBudget = useCallback(
    async (amountMinor: number) => {
      await repo.setBudget(period.start, '', amountMinor);
      bumpDataVersion();
    },
    [repo, period.start]
  );

  const removeOverallBudget = useCallback(async () => {
    await repo.deleteBudget(period.start, '');
    bumpDataVersion();
  }, [repo, period.start]);

  const setCategoryBudget = useCallback(
    async (categoryId: string, amountMinor: number) => {
      await repo.setBudget(period.start, categoryId, amountMinor);
      bumpDataVersion();
    },
    [repo, period.start]
  );

  const removeCategoryBudget = useCallback(
    async (categoryId: string) => {
      await repo.deleteBudget(period.start, categoryId);
      bumpDataVersion();
    },
    [repo, period.start]
  );

  return {
    period,
    remainingDaysCount,
    overallBudgetMinor,
    overallSummary,
    categoryBudgets,
    spendRanking,
    allocation,
    history,
    categories,
    categoriesById,
    loading,
    error,
    reload,
    setOverallBudget,
    removeOverallBudget,
    setCategoryBudget,
    removeCategoryBudget,
  };
}
