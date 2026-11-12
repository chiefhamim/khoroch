import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupTransactionsByDate, type DailyTransactionGroup } from '@/domain/calc';
import type { Category, Transaction, TxQuery } from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

const PAGE_SIZE = 30;

export interface UseTransactionsState {
  transactions: Transaction[];
  groups: DailyTransactionGroup[];
  categoriesById: Map<string, Category>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  reload: () => void;
}

export function useTransactions(query: TxQuery = {}): UseTransactionsState {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let active = true;
    const parsedQuery = JSON.parse(queryKey) as TxQuery;

    (async () => {
      try {
        const [pageRes, cats] = await Promise.all([
          repo.searchTransactions(parsedQuery, { limit: PAGE_SIZE }),
          repo.listCategories({ includeArchived: true }),
        ]);
        if (!active) return;
        setTransactions(pageRes.rows);
        setNextCursor(pageRes.next);
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
  }, [repo, dataVersion, queryKey, reloadTick]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const parsedQuery = JSON.parse(queryKey) as TxQuery;
      const pageRes = await repo.searchTransactions(parsedQuery, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setTransactions((prev) => [...prev, ...pageRes.rows]);
      setNextCursor(pageRes.next);
    } catch {
      setError('load_failed');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, queryKey, repo]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadTick((n) => n + 1);
  }, []);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const groups = useMemo(
    () => groupTransactionsByDate(transactions, settings.currency),
    [transactions, settings.currency]
  );

  return {
    transactions,
    groups,
    categoriesById,
    loading,
    loadingMore,
    hasMore: Boolean(nextCursor),
    error,
    loadMore,
    reload,
  };
}
