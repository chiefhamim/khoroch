import {
  compareFullPeriods,
  compareMonthToDate,
  isInPeriodRange,
  monthlySeries,
  type MonthlySeriesPoint,
  type PeriodComparison,
} from './calc';
import {
  addDays,
  diffDays,
  formatLocalDate,
  getWeekRange,
  minLocalDate,
  parseLocalDate,
} from './dates';
import { buildRecentPeriodWindows, getPeriod, previousPeriod } from './period';
import type {
  Category,
  CurrencyCode,
  LocalDate,
  Period,
  Transaction,
  TxQuery,
  WeekStartDay,
} from './types';

export type InsightsPeriodPreset =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export interface CustomDateRange {
  fromIncl: LocalDate;
  toIncl: LocalDate;
}

export interface InsightsWindow {
  preset: InsightsPeriodPreset;
  fromIncl: LocalDate;
  toExcl: LocalDate;
  elapsedDays: number;
  completeMonthsCount: number | null;
}

export interface AverageInsights {
  totalExpenseMinor: number;
  expenseCount: number;
  calendarDays: number;
  perDayMinor: number;
  perTransactionMinor: number;
  perWeekMinor: number;
  monthlyAvgMonths: number;
  monthlyAvgMinor: number;
}

export interface CategoryTotalInsight {
  categoryId: string;
  spentMinor: number;
  count: number;
}

export interface LargestExpenseInsight {
  transactionId: string;
  description: string;
  categoryId: string | null;
  amountMinor: number;
  occurredOn: LocalDate;
}

export interface MostExpensiveDayInsight {
  date: LocalDate;
  spentMinor: number;
  count: number;
}

export interface CategoryChangeItem {
  categoryId: string;
  currentMinor: number;
  previousMinor: number;
  diffMinor: number;
  pctChange: number | null;
}

export interface BiggestInsights {
  topCategory: CategoryTotalInsight | null;
  largestExpense: LargestExpenseInsight | null;
  mostFrequentCategory: CategoryTotalInsight | null;
  mostExpensiveDay: MostExpensiveDayInsight | null;
  biggestCategoryChange: CategoryChangeItem | null;
}

export interface PatternSentence {
  id: string;
  text: string;
  filterQuery: TxQuery;
}

export interface InsightsReport {
  hasAnyHistory: boolean;
  window: InsightsWindow;
  hasWindowExpenses: boolean;
  averages: AverageInsights;
  biggest: BiggestInsights;
  categoryChanges: CategoryChangeItem[];
  mtdComparison: PeriodComparison;
  fullPeriodComparison: ReturnType<typeof compareFullPeriods>;
  patternSentences: PatternSentence[];
  hasSufficientPatternData: boolean;
  monthlyHistory: MonthlySeriesPoint[];
}

export function resolveInsightsWindow(
  preset: InsightsPeriodPreset,
  today: LocalDate,
  monthStartDay: number,
  customRange?: CustomDateRange,
  weekStartsOn: WeekStartDay = 'saturday'
): InsightsWindow {
  const currentPeriod = getPeriod(today, monthStartDay);
  const tomorrow = addDays(today, 1);

  switch (preset) {
    case 'this_week': {
      const { start, endExcl } = getWeekRange(today, weekStartsOn);
      const elapsedDays = Math.max(1, diffDays(minLocalDate(tomorrow, endExcl), start));
      return {
        preset,
        fromIncl: start,
        toExcl: endExcl,
        elapsedDays,
        completeMonthsCount: null,
      };
    }
    case 'this_month': {
      const elapsedDays = Math.max(
        1,
        diffDays(minLocalDate(tomorrow, currentPeriod.endExcl), currentPeriod.start)
      );
      return {
        preset,
        fromIncl: currentPeriod.start,
        toExcl: currentPeriod.endExcl,
        elapsedDays,
        completeMonthsCount: null,
      };
    }
    case 'last_month': {
      const prev = previousPeriod(currentPeriod, monthStartDay);
      return {
        preset,
        fromIncl: prev.start,
        toExcl: prev.endExcl,
        elapsedDays: Math.max(1, prev.lengthDays),
        completeMonthsCount: 1,
      };
    }
    case 'last_3_months':
    case 'last_6_months': {
      const months = preset === 'last_3_months' ? 3 : 6;
      const latestComplete = previousPeriod(currentPeriod, monthStartDay);
      let oldest = latestComplete;
      for (let i = 1; i < months; i++) {
        oldest = previousPeriod(oldest, monthStartDay);
      }
      return {
        preset,
        fromIncl: oldest.start,
        toExcl: latestComplete.endExcl,
        elapsedDays: Math.max(1, diffDays(latestComplete.endExcl, oldest.start)),
        completeMonthsCount: months,
      };
    }
    case 'this_year': {
      const { year } = parseLocalDate(today);
      const start = formatLocalDate(year, 1, 1);
      const endExcl = formatLocalDate(year + 1, 1, 1);
      const elapsedDays = Math.max(1, diffDays(minLocalDate(tomorrow, endExcl), start));
      return {
        preset,
        fromIncl: start,
        toExcl: endExcl,
        elapsedDays,
        completeMonthsCount: null,
      };
    }
    case 'custom': {
      if (customRange && customRange.fromIncl <= customRange.toIncl) {
        const endExcl = addDays(customRange.toIncl, 1);
        const effectiveEnd = minLocalDate(tomorrow, endExcl);
        const elapsedDays =
          customRange.fromIncl < effectiveEnd
            ? diffDays(effectiveEnd, customRange.fromIncl)
            : Math.max(1, diffDays(endExcl, customRange.fromIncl));
        return {
          preset,
          fromIncl: customRange.fromIncl,
          toExcl: endExcl,
          elapsedDays,
          completeMonthsCount: null,
        };
      }
      const fallbackElapsed = Math.max(
        1,
        diffDays(minLocalDate(tomorrow, currentPeriod.endExcl), currentPeriod.start)
      );
      return {
        preset: 'this_month',
        fromIncl: currentPeriod.start,
        toExcl: currentPeriod.endExcl,
        elapsedDays: fallbackElapsed,
        completeMonthsCount: null,
      };
    }
  }
}

/**
 * Computes monthly average strictly over N complete periods preceding the current partial month.
 */
export function computeMonthlyAverageOverCompleteMonths(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  monthsCount: number,
  currency: CurrencyCode
): { averageMinor: number; totalMinor: number; completePeriodsCount: number } {
  const n = Math.max(1, monthsCount);
  const currentPeriod = getPeriod(today, monthStartDay);
  const latestComplete = previousPeriod(currentPeriod, monthStartDay);
  let oldest = latestComplete;
  for (let i = 1; i < n; i++) {
    oldest = previousPeriod(oldest, monthStartDay);
  }

  let totalMinor = 0;
  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (!isInPeriodRange(tx.occurredOn, oldest.start, latestComplete.endExcl)) continue;
    totalMinor += tx.amountMinor;
  }

  return {
    averageMinor: Math.round(totalMinor / n),
    totalMinor,
    completePeriodsCount: n,
  };
}

export function computeCategoryMtdChanges(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  currency: CurrencyCode
): {
  changes: CategoryChangeItem[];
  currMtdStart: LocalDate;
  currMtdEndExcl: LocalDate;
  currMtdCount: number;
  prevMtdCount: number;
  elapsedDays: number;
  prevElapsedDays: number;
} {
  const currPeriod: Period = getPeriod(today, monthStartDay);
  const prevPeriod: Period = previousPeriod(currPeriod, monthStartDay);
  const tomorrow = addDays(today, 1);

  const elapsedDays =
    today < currPeriod.start
      ? 0
      : Math.max(1, diffDays(minLocalDate(tomorrow, currPeriod.endExcl), currPeriod.start));
  const prevElapsedDays = Math.min(elapsedDays, prevPeriod.lengthDays);

  const currMtdEndExcl = addDays(currPeriod.start, elapsedDays);
  const prevMtdEndExcl = addDays(prevPeriod.start, prevElapsedDays);

  const currMap = new Map<string, number>();
  const prevMap = new Map<string, number>();
  let currMtdCount = 0;
  let prevMtdCount = 0;

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    const catId = tx.categoryId ?? 'other';

    if (elapsedDays > 0 && isInPeriodRange(tx.occurredOn, currPeriod.start, currMtdEndExcl)) {
      currMap.set(catId, (currMap.get(catId) ?? 0) + tx.amountMinor);
      currMtdCount += 1;
    } else if (prevElapsedDays > 0 && isInPeriodRange(tx.occurredOn, prevPeriod.start, prevMtdEndExcl)) {
      prevMap.set(catId, (prevMap.get(catId) ?? 0) + tx.amountMinor);
      prevMtdCount += 1;
    }
  }

  const allCategoryIds = new Set([...currMap.keys(), ...prevMap.keys()]);
  const changes: CategoryChangeItem[] = [];
  for (const categoryId of allCategoryIds) {
    const currentMinor = currMap.get(categoryId) ?? 0;
    const previousMinor = prevMap.get(categoryId) ?? 0;
    const diffMinor = currentMinor - previousMinor;
    const pctChange =
      previousMinor > 0 ? Math.round(((currentMinor - previousMinor) / previousMinor) * 100) : null;
    changes.push({
      categoryId,
      currentMinor,
      previousMinor,
      diffMinor,
      pctChange,
    });
  }

  changes.sort((a, b) => {
    const absDiff = Math.abs(b.diffMinor) - Math.abs(a.diffMinor);
    if (absDiff !== 0) return absDiff;
    if (b.currentMinor !== a.currentMinor) return b.currentMinor - a.currentMinor;
    return a.categoryId.localeCompare(b.categoryId);
  });

  return {
    changes,
    currMtdStart: currPeriod.start,
    currMtdEndExcl,
    currMtdCount,
    prevMtdCount,
    elapsedDays,
    prevElapsedDays,
  };
}

export function buildPatternSentences(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  currency: CurrencyCode,
  categoriesById: ReadonlyMap<string, Pick<Category, 'name'>>
): { sentences: PatternSentence[]; hasSufficientData: boolean } {
  const mtdChanges = computeCategoryMtdChanges(transactions, today, monthStartDay, currency);
  const mtdOverall = compareMonthToDate(transactions, today, monthStartDay, currency);

  const hasSufficientData =
    mtdChanges.elapsedDays >= 7 &&
    mtdChanges.prevElapsedDays >= 7 &&
    mtdChanges.currMtdCount >= 5 &&
    mtdChanges.prevMtdCount >= 5;

  if (!hasSufficientData) {
    return { sentences: [], hasSufficientData: false };
  }

  const sentences: PatternSentence[] = [];
  const getCatName = (id: string) => categoriesById.get(id)?.name ?? id;

  // 1. Category change sentence (TEST-CASES §5 example:
  // "You spent 18% more on Food & Dining than the same point last month.")
  const pctCandidate = mtdChanges.changes.find(
    (c) => c.previousMinor > 0 && c.pctChange !== null && c.pctChange !== 0
  );
  if (pctCandidate && pctCandidate.pctChange !== null) {
    const absPct = Math.abs(pctCandidate.pctChange);
    const dir = pctCandidate.pctChange > 0 ? 'more' : 'less';
    sentences.push({
      id: `cat-change-${pctCandidate.categoryId}`,
      text: `You spent ${absPct}% ${dir} on ${getCatName(pctCandidate.categoryId)} than the same point last month.`,
      filterQuery: {
        type: 'expense',
        categoryId: pctCandidate.categoryId,
        fromIncl: mtdChanges.currMtdStart,
        toExcl: mtdChanges.currMtdEndExcl,
      },
    });
  }

  // 2. Overall MTD comparison sentence
  if (mtdOverall.pctChange !== null && mtdOverall.pctChange !== 0) {
    const absOverall = Math.round(Math.abs(mtdOverall.pctChange));
    const dir = mtdOverall.pctChange > 0 ? 'more' : 'less';
    sentences.push({
      id: 'mtd-overall',
      text: `Your overall spending is ${absOverall}% ${dir} than the same ${mtdOverall.daysCompared} days last month.`,
      filterQuery: {
        type: 'expense',
        fromIncl: mtdChanges.currMtdStart,
        toExcl: mtdChanges.currMtdEndExcl,
      },
    });
  }

  // 3. Top MTD spending category
  const sortedByCurrent = [...mtdChanges.changes]
    .filter((c) => c.currentMinor > 0)
    .sort((a, b) => b.currentMinor - a.currentMinor || a.categoryId.localeCompare(b.categoryId));

  if (sortedByCurrent.length >= 2) {
    const second = sortedByCurrent[1];
    sentences.push({
      id: `second-cat-${second.categoryId}`,
      text: `${getCatName(second.categoryId)} is your second-largest spending category this month.`,
      filterQuery: {
        type: 'expense',
        categoryId: second.categoryId,
        fromIncl: mtdChanges.currMtdStart,
        toExcl: mtdChanges.currMtdEndExcl,
      },
    });
  } else if (sortedByCurrent.length === 1) {
    const first = sortedByCurrent[0];
    sentences.push({
      id: `top-cat-${first.categoryId}`,
      text: `${getCatName(first.categoryId)} accounts for your recorded spending this month.`,
      filterQuery: {
        type: 'expense',
        categoryId: first.categoryId,
        fromIncl: mtdChanges.currMtdStart,
        toExcl: mtdChanges.currMtdEndExcl,
      },
    });
  }

  return { sentences, hasSufficientData: true };
}

export function buildInsightsReport(
  transactions: readonly Transaction[],
  today: LocalDate,
  monthStartDay: number,
  currency: CurrencyCode,
  preset: InsightsPeriodPreset,
  categoriesById: ReadonlyMap<string, Pick<Category, 'name'>>,
  customRange?: CustomDateRange,
  weekStartsOn: WeekStartDay = 'saturday'
): InsightsReport {
  const window = resolveInsightsWindow(
    preset,
    today,
    monthStartDay,
    customRange,
    weekStartsOn
  );
  const hasAnyHistory = transactions.some((tx) => tx.deletedAt == null);

  let totalExpenseMinor = 0;
  let expenseCount = 0;
  const catStats = new Map<string, { spentMinor: number; count: number }>();
  const dayStats = new Map<LocalDate, { spentMinor: number; count: number }>();
  let largestExpense: LargestExpenseInsight | null = null;
  let largestExpenseCreatedAt = -1;

  for (const tx of transactions) {
    if (tx.deletedAt != null) continue;
    if (tx.currency !== currency || tx.type !== 'expense') continue;
    if (!isInPeriodRange(tx.occurredOn, window.fromIncl, window.toExcl)) continue;

    totalExpenseMinor += tx.amountMinor;
    expenseCount += 1;

    const catId = tx.categoryId ?? 'other';
    const existingCat = catStats.get(catId) ?? { spentMinor: 0, count: 0 };
    existingCat.spentMinor += tx.amountMinor;
    existingCat.count += 1;
    catStats.set(catId, existingCat);

    const existingDay = dayStats.get(tx.occurredOn) ?? { spentMinor: 0, count: 0 };
    existingDay.spentMinor += tx.amountMinor;
    existingDay.count += 1;
    dayStats.set(tx.occurredOn, existingDay);

    if (
      !largestExpense ||
      tx.amountMinor > largestExpense.amountMinor ||
      (tx.amountMinor === largestExpense.amountMinor &&
        (tx.occurredOn > largestExpense.occurredOn ||
          (tx.occurredOn === largestExpense.occurredOn && tx.createdAt > largestExpenseCreatedAt)))
    ) {
      largestExpense = {
        transactionId: tx.id,
        description: tx.description,
        categoryId: tx.categoryId,
        amountMinor: tx.amountMinor,
        occurredOn: tx.occurredOn,
      };
      largestExpenseCreatedAt = tx.createdAt;
    }
  }

  let topCategory: CategoryTotalInsight | null = null;
  let mostFrequentCategory: CategoryTotalInsight | null = null;

  for (const [categoryId, stat] of catStats.entries()) {
    if (
      !topCategory ||
      stat.spentMinor > topCategory.spentMinor ||
      (stat.spentMinor === topCategory.spentMinor && categoryId.localeCompare(topCategory.categoryId) < 0)
    ) {
      topCategory = { categoryId, spentMinor: stat.spentMinor, count: stat.count };
    }

    // Most frequent category: highest count; tie -> higher amount (TEST-CASES §5)
    if (
      !mostFrequentCategory ||
      stat.count > mostFrequentCategory.count ||
      (stat.count === mostFrequentCategory.count && stat.spentMinor > mostFrequentCategory.spentMinor) ||
      (stat.count === mostFrequentCategory.count &&
        stat.spentMinor === mostFrequentCategory.spentMinor &&
        categoryId.localeCompare(mostFrequentCategory.categoryId) < 0)
    ) {
      mostFrequentCategory = { categoryId, spentMinor: stat.spentMinor, count: stat.count };
    }
  }

  let mostExpensiveDay: MostExpensiveDayInsight | null = null;
  for (const [date, stat] of dayStats.entries()) {
    // Most expensive day: highest expense sum; tie -> later date (TEST-CASES §5)
    if (
      !mostExpensiveDay ||
      stat.spentMinor > mostExpensiveDay.spentMinor ||
      (stat.spentMinor === mostExpensiveDay.spentMinor && date > mostExpensiveDay.date)
    ) {
      mostExpensiveDay = { date, spentMinor: stat.spentMinor, count: stat.count };
    }
  }

  const monthlyAvgMonths = window.completeMonthsCount ?? 3;
  const monthlyAvg = computeMonthlyAverageOverCompleteMonths(
    transactions,
    today,
    monthStartDay,
    monthlyAvgMonths,
    currency
  );

  const mtdChanges = computeCategoryMtdChanges(transactions, today, monthStartDay, currency);
  const mtdComparison = compareMonthToDate(transactions, today, monthStartDay, currency);
  const fullPeriodComparison = compareFullPeriods(transactions, today, monthStartDay, currency);
  const patternRes = buildPatternSentences(
    transactions,
    today,
    monthStartDay,
    currency,
    categoriesById
  );

  const historyMonths = preset === 'last_3_months' ? 3 : 6;
  const recentPeriods = buildRecentPeriodWindows(today, monthStartDay, historyMonths);
  const monthlyHistory = monthlySeries(transactions, recentPeriods, currency);

  return {
    hasAnyHistory,
    window,
    hasWindowExpenses: expenseCount > 0,
    averages: {
      totalExpenseMinor,
      expenseCount,
      calendarDays: window.elapsedDays,
      perDayMinor: Math.round(totalExpenseMinor / window.elapsedDays),
      perTransactionMinor: expenseCount > 0 ? Math.round(totalExpenseMinor / expenseCount) : 0,
      perWeekMinor: Math.round((totalExpenseMinor * 7) / window.elapsedDays),
      monthlyAvgMonths: monthlyAvg.completePeriodsCount,
      monthlyAvgMinor: monthlyAvg.averageMinor,
    },
    biggest: {
      topCategory,
      largestExpense,
      mostFrequentCategory,
      mostExpensiveDay,
      biggestCategoryChange: mtdChanges.changes[0] ?? null,
    },
    categoryChanges: mtdChanges.changes,
    mtdComparison,
    fullPeriodComparison,
    patternSentences: patternRes.sentences,
    hasSufficientPatternData: patternRes.hasSufficientData,
    monthlyHistory,
  };
}
