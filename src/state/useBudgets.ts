import * as Crypto from 'expo-crypto';
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
import {
  computeUpcomingBillsCommitment,
  type BillsCommitmentSummary,
} from '@/domain/netWorth';
import {
  buildRecentSpendingWindows,
  getBillPeriod,
  getSpendingPeriod,
  previousPeriod,
  remainingDays,
  type PeriodConfig,
} from '@/domain/period';
import {
  normalizePeriodWeekStartDay,
  normalizeWeeklyBudgetMinor,
  type Account,
  type Budget,
  type Category,
  type LocalDate,
  type NewRecurringBill,
  type Period,
  type PeriodKind,
  type RecurringBill,
  type Transaction,
} from '@/domain/types';
import { useAppContext } from './AppContext';
import { bumpDataVersion, useDataVersionStore } from './dataVersion';

/** How many finished weeks the weekly "Past weeks" list looks back over. */
const PAST_WEEKS_LOOKBACK = 6;

export interface HistoricalPeriodBudget {
  period: Period;
  overallBudgetMinor: number | null;
  spentMinor: number;
  utilizationPct: number | null;
  status: PeriodSummary['status'];
}

export interface UseBudgetsResult {
  /** 'month' (default) or 'week'. */
  periodKind: PeriodKind;
  /** The SPENDING period: the week in weekly mode, otherwise the monthly cycle. */
  period: Period;
  /** The monthly BILL period. Equal to `period` in monthly mode. */
  billPeriod: Period;
  remainingDaysCount: number;
  /** The budget for the spending period: the weekly amount in weekly mode, otherwise the monthly total. */
  overallBudgetMinor: number | null;
  overallSummary: PeriodSummary;
  /** Monthly mode only. Always empty in weekly mode: category budgets are monthly amounts. */
  categoryBudgets: CategoryBudgetItem[];
  spendRanking: CategorySpend[];
  allocation: BudgetAllocationSummary;
  history: HistoricalPeriodBudget[];
  categories: Category[];
  categoriesById: Map<string, Category>;
  accounts: Account[];
  recurringBills: RecurringBill[];
  billsCommitment: BillsCommitmentSummary;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setOverallBudget: (amountMinor: number) => Promise<void>;
  removeOverallBudget: () => Promise<void>;
  setCategoryBudget: (categoryId: string, amountMinor: number) => Promise<void>;
  removeCategoryBudget: (categoryId: string) => Promise<void>;
  addRecurringBill: (bill: NewRecurringBill) => Promise<void>;
  markRecurringBillPaid: (bill: RecurringBill, opts?: { recordTransaction?: boolean }) => Promise<void>;
  deleteRecurringBill: (id: string) => Promise<void>;
}

export function useBudgets(todayOverride?: LocalDate): UseBudgetsResult {
  const { repo, settings, updateSetting } = useAppContext();
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
  // The monthly cycle: bills, the paid badge and the stored monthly budgets always use it.
  const billPeriod = useMemo(() => getBillPeriod(today, monthStartDay), [today, monthStartDay]);
  const prevBillPeriod = useMemo(
    () => previousPeriod(billPeriod, monthStartDay),
    [billPeriod, monthStartDay]
  );
  const remainingDaysCount = useMemo(() => remainingDays(period, today), [period, today]);
  const earliestWeekStart = useMemo(
    () =>
      isWeekly
        ? buildRecentSpendingWindows(today, periodConfig, PAST_WEEKS_LOOKBACK + 1)[0].start
        : null,
    [isWeekly, today, periodConfig]
  );
  const rangeEndExcl = period.endExcl > billPeriod.endExcl ? period.endExcl : billPeriod.endExcl;

  const [currentBudgets, setCurrentBudgets] = useState<Budget[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await repo.ensureBudgetsForPeriod(billPeriod.start, prevBillPeriod.start);
        const [curBudgets, everyBudget, cats, accs, bills] = await Promise.all([
          repo.getBudgets(billPeriod.start),
          repo.getAllBudgets(),
          repo.listCategories({ includeArchived: true }),
          repo.listAccounts(),
          repo.listRecurringBills({ includeInactive: true }),
        ]);

        let minStart = prevBillPeriod.start;
        for (const b of everyBudget) {
          if (b.periodStart < minStart) {
            minStart = b.periodStart;
          }
        }
        if (earliestWeekStart !== null && earliestWeekStart < minStart) {
          minStart = earliestWeekStart;
        }
        const txs = await repo.listTransactionsInRange(minStart, rangeEndExcl);
        if (!active) return;

        setCurrentBudgets(curBudgets);
        setAllBudgets(everyBudget);
        setCategories(cats);
        setAccounts(accs);
        setRecurringBills(bills);
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
  }, [
    repo,
    billPeriod.start,
    prevBillPeriod.start,
    earliestWeekStart,
    rangeEndExcl,
    dataVersion,
    reloadTick,
  ]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Weekly mode has its own stored amount; the monthly amounts are never converted or touched.
  const overallBudgetMinor = useMemo(() => {
    if (isWeekly) return weeklyBudgetMinor;
    const row = currentBudgets.find((b) => b.categoryId === '');
    return row && row.amountMinor > 0 ? row.amountMinor : null;
  }, [isWeekly, weeklyBudgetMinor, currentBudgets]);

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
    if (isWeekly) return [];
    const list = categoryBudgetStatus(transactions, currentBudgets, period, currency);
    return list.sort((a, b) => {
      const aPct = a.utilizationPct ?? -1;
      const bPct = b.utilizationPct ?? -1;
      if (bPct !== aPct) return bPct - aPct;
      return b.spentMinor - a.spentMinor;
    });
  }, [isWeekly, transactions, currentBudgets, period, currency]);

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
    if (isWeekly) {
      // Finished weeks with spending, newest first. Each is measured against the one weekly amount.
      const weeks = buildRecentSpendingWindows(today, periodConfig, PAST_WEEKS_LOOKBACK + 1);
      weeks.pop();
      const rows: HistoricalPeriodBudget[] = [];
      for (const p of weeks.reverse()) {
        const sum = summarize({
          transactions,
          period: p,
          today: p.endExcl,
          overallBudgetMinor: weeklyBudgetMinor,
          currency,
        });
        if (sum.spentMinor <= 0) continue;
        rows.push({
          period: p,
          overallBudgetMinor: weeklyBudgetMinor,
          spentMinor: sum.spentMinor,
          utilizationPct: sum.utilizationPct,
          status: sum.status,
        });
      }
      return rows;
    }
    const pastStarts = new Set<LocalDate>();
    for (const b of allBudgets) {
      if (b.periodStart < period.start) {
        pastStarts.add(b.periodStart);
      }
    }
    const sorted = Array.from(pastStarts).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return sorted.map((ps) => {
      const p = getBillPeriod(ps, monthStartDay);
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
  }, [
    isWeekly,
    today,
    periodConfig,
    weeklyBudgetMinor,
    allBudgets,
    period.start,
    monthStartDay,
    transactions,
    currency,
  ]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const setOverallBudget = useCallback(
    async (amountMinor: number) => {
      if (isWeekly) {
        await updateSetting('weeklyBudgetMinor', amountMinor > 0 ? amountMinor : null);
      } else {
        await repo.setBudget(billPeriod.start, '', amountMinor);
      }
      bumpDataVersion();
    },
    [repo, billPeriod.start, isWeekly, updateSetting]
  );

  const removeOverallBudget = useCallback(async () => {
    if (isWeekly) {
      await updateSetting('weeklyBudgetMinor', null);
    } else {
      await repo.deleteBudget(billPeriod.start, '');
    }
    bumpDataVersion();
  }, [repo, billPeriod.start, isWeekly, updateSetting]);

  const setCategoryBudget = useCallback(
    async (categoryId: string, amountMinor: number) => {
      await repo.setBudget(billPeriod.start, categoryId, amountMinor);
      bumpDataVersion();
    },
    [repo, billPeriod.start]
  );

  const removeCategoryBudget = useCallback(
    async (categoryId: string) => {
      await repo.deleteBudget(billPeriod.start, categoryId);
      bumpDataVersion();
    },
    [repo, billPeriod.start]
  );

  const billsCommitment = useMemo(
    () =>
      computeUpcomingBillsCommitment({
        bills: recurringBills,
        period: billPeriod,
        today,
        budgetRemainingMinor: overallSummary.remainingMinor,
        spendingWindow: isWeekly ? { period, monthStartDay } : undefined,
      }),
    [recurringBills, billPeriod, today, overallSummary.remainingMinor, isWeekly, period, monthStartDay]
  );

  const addRecurringBill = useCallback(
    async (bill: NewRecurringBill) => {
      await repo.insertRecurringBill(bill);
      bumpDataVersion();
    },
    [repo]
  );

  const markRecurringBillPaid = useCallback(
    async (bill: RecurringBill, opts?: { recordTransaction?: boolean }) => {
      const nextPaid = bill.paidInstallments + 1;
      const doneEmi =
        bill.kind === 'emi' &&
        bill.totalInstallments !== null &&
        nextPaid >= bill.totalInstallments;
      await repo.updateRecurringBill(bill.id, {
        lastPaidPeriod: billPeriod.start,
        paidInstallments: nextPaid,
        isActive: doneEmi ? false : bill.isActive,
      });
      if (opts?.recordTransaction !== false) {
        await repo.insertTransaction({
          id: `tx_bill_${Crypto.randomUUID()}`,
          type: bill.kind === 'salary' ? 'income' : 'expense',
          amountMinor: bill.amountMinor,
          currency,
          categoryId: bill.categoryId ?? (bill.kind === 'salary' ? 'salary' : 'utilities'),
          accountId: bill.accountId ?? accounts[0]?.id ?? null,
          description: bill.name,
          occurredOn: today,
          source: 'quick',
        });
      }
      bumpDataVersion();
    },
    [repo, billPeriod.start, currency, accounts, today]
  );

  const deleteRecurringBill = useCallback(
    async (id: string) => {
      await repo.deleteRecurringBill(id);
      bumpDataVersion();
    },
    [repo]
  );

  return {
    periodKind,
    period,
    billPeriod,
    remainingDaysCount,
    overallBudgetMinor,
    overallSummary,
    categoryBudgets,
    spendRanking,
    allocation,
    history,
    categories,
    categoriesById,
    accounts,
    recurringBills,
    billsCommitment,
    loading,
    error,
    reload,
    setOverallBudget,
    removeOverallBudget,
    setCategoryBudget,
    removeCategoryBudget,
    addRecurringBill,
    markRecurringBillPaid,
    deleteRecurringBill,
  };
}
