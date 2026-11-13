import { useEffect, useMemo, useState } from 'react';
import { addDays, formatLocalDate, minLocalDate, parseLocalDate, todayLocalDate } from '@/domain/dates';
import {
  buildInsightsReport,
  type CustomDateRange,
  type InsightsPeriodPreset,
  type InsightsReport,
} from '@/domain/insights';
import { getPeriod, previousPeriod } from '@/domain/period';
import type { Category, LocalDate, Transaction } from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export interface UseInsightsState {
  today: LocalDate;
  loading: boolean;
  error: string | null;
  categoriesById: Map<string, Category>;
  report: InsightsReport;
  reload: () => void;
}

export function useInsights(
  preset: InsightsPeriodPreset,
  customRange?: CustomDateRange,
  todayOverride?: LocalDate
): UseInsightsState {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const today = todayOverride ?? todayLocalDate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasAnyHistoryDb, setHasAnyHistoryDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Determine earliest date needed across all windows + 6 complete months history + MTD comparison + this_year
  const queryRange = useMemo(() => {
    const currPeriod = getPeriod(today, settings.monthStartDay);
    let oldest = previousPeriod(currPeriod, settings.monthStartDay);
    for (let i = 1; i < 6; i++) {
      oldest = previousPeriod(oldest, settings.monthStartDay);
    }
    const { year } = parseLocalDate(today);
    const jan1 = formatLocalDate(year, 1, 1);

    let fromIncl = oldest.start < jan1 ? oldest.start : jan1;
    if (customRange && customRange.fromIncl < fromIncl) {
      fromIncl = customRange.fromIncl;
    }

    let toExcl = addDays(today, 1);
    if (currPeriod.endExcl > toExcl) {
      toExcl = currPeriod.endExcl;
    }
    if (customRange) {
      const customEndExcl = addDays(customRange.toIncl, 1);
      if (customEndExcl > toExcl) {
        toExcl = customEndExcl;
      }
    }

    return {
      fromIncl: minLocalDate(fromIncl, today),
      toExcl,
    };
  }, [today, settings.monthStartDay, customRange]);

  useEffect(() => {
    let active = true;

    Promise.all([
      repo.listTransactionsInRange(queryRange.fromIncl, queryRange.toExcl),
      repo.listCategories({ includeArchived: true }),
      repo.hasAnyTransactions(),
    ])
      .then(([txs, cats, hasAny]) => {
        if (!active) return;
        setTransactions(txs);
        setCategories(cats);
        setHasAnyHistoryDb(hasAny);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('insights_load_failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repo, queryRange.fromIncl, queryRange.toExcl, dataVersion, reloadTick]);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const report = useMemo(() => {
    const built = buildInsightsReport(
      transactions,
      today,
      settings.monthStartDay,
      settings.currency,
      preset,
      categoriesById,
      customRange,
      settings.weekStartsOn
    );
    return {
      ...built,
      hasAnyHistory: built.hasAnyHistory || hasAnyHistoryDb,
    };
  }, [
    transactions,
    today,
    settings.monthStartDay,
    settings.currency,
    preset,
    categoriesById,
    customRange,
    settings.weekStartsOn,
    hasAnyHistoryDb,
  ]);

  return {
    today,
    loading,
    error,
    categoriesById,
    report,
    reload: () => {
      setLoading(true);
      setReloadTick((n) => n + 1);
    },
  };
}
