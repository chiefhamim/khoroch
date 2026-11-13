import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeAccountsOverview, type AccountsOverview } from '@/domain/accounts';
import { todayLocalDate } from '@/domain/dates';
import type { Account, DueEntry, LocalDate, Transaction, Transfer } from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export interface UseAccountsResult {
  accounts: Account[];
  allAccounts: Account[];
  accountsById: Map<string, Account>;
  overview: AccountsOverview;
  transactions: Transaction[];
  transfers: Transfer[];
  dueEntries: DueEntry[];
  untaggedCount: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAccounts(asOfDate?: LocalDate): UseAccountsResult {
  const { repo, settings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [dueEntries, setDueEntries] = useState<DueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const resolvedAsOf = asOfDate ?? todayLocalDate();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [accList, txList, trList, dueList] = await Promise.all([
          repo.listAccounts({ includeArchived: true }),
          repo.listAllActiveTransactions(),
          repo.listTransfers(),
          repo.listDueEntries(),
        ]);
        if (!active) return;
        setAllAccounts(accList);
        setTransactions(txList);
        setTransfers(trList);
        setDueEntries(dueList);
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
  }, [repo, dataVersion, reloadTick]);

  const accounts = useMemo(
    () => allAccounts.filter((acc) => acc.archivedAt == null),
    [allAccounts]
  );

  const accountsById = useMemo(
    () => new Map(allAccounts.map((acc) => [acc.id, acc])),
    [allAccounts]
  );

  const currency = settings.currency;
  const overview = useMemo(
    () =>
      computeAccountsOverview({
        accounts: allAccounts,
        transactions,
        transfers,
        dues: dueEntries,
        asOfDate: resolvedAsOf,
        currency,
        includeArchived: false,
      }),
    [allAccounts, transactions, transfers, dueEntries, resolvedAsOf, currency]
  );

  const untaggedCount = useMemo(() => {
    let count = 0;
    for (const tx of transactions) {
      if (tx.deletedAt == null && tx.accountId === null) {
        count += 1;
      }
    }
    return count;
  }, [transactions]);

  const reload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  return {
    accounts,
    allAccounts,
    accountsById,
    overview,
    transactions,
    transfers,
    dueEntries,
    untaggedCount,
    loading,
    error,
    reload,
  };
}
