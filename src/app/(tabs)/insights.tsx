import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatUtilizationPct } from '@/domain/calc';
import {
  addDays,
  formatPeriodRange,
  formatShortDate,
  formatShortMonthYear,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import type { CustomDateRange, InsightsPeriodPreset } from '@/domain/insights';
import { formatMoney } from '@/domain/money';
import type { LocalDate, TxQuery } from '@/domain/types';
import { t } from '@/i18n';
import { useActivityFilterStore } from '@/state/activityFilterStore';
import { useAppContext } from '@/state/AppContext';
import { useInsights } from '@/state/useInsights';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';

const CHART_HEIGHT = 152;
const TOP_PAD = 12;
const BOTTOM_PAD = 24;
const PLOT_HEIGHT = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

export interface InsightsContentProps {
  todayOverride?: LocalDate;
}

export function InsightsContent({ todayOverride }: InsightsContentProps) {
  const { settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const applyExternalFilters = useActivityFilterStore((s) => s.applyExternalFilters);

  const [preset, setPreset] = useState<InsightsPeriodPreset>('this_month');
  const todayDefault = todayOverride ?? todayLocalDate();
  const [fromDraft, setFromDraft] = useState<string>(addDays(todayDefault, -30));
  const [toDraft, setToDraft] = useState<string>(todayDefault);
  const [customRange, setCustomRange] = useState<CustomDateRange>({
    fromIncl: addDays(todayDefault, -30),
    toIncl: todayDefault,
  });
  const [customError, setCustomError] = useState<string | null>(null);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(280);

  const { today, loading, error, categoriesById, report, reload } = useInsights(
    preset,
    preset === 'custom' ? customRange : undefined,
    todayOverride
  );

  const openActivityWithQuery = (query: TxQuery) => {
    const inclusiveTo = query.toExcl ? addDays(query.toExcl, -1) : '';
    applyExternalFilters({
      search: query.search ?? '',
      type: query.type ?? null,
      categoryId: query.categoryId ?? null,
      datePreset: query.fromIncl || inclusiveTo ? 'custom' : 'all',
      customFromIncl: (query.fromIncl ?? '') as LocalDate | '',
      customToIncl: inclusiveTo as LocalDate | '',
    });
    router.push('/(tabs)/activity');
  };

  const historyBars = report.monthlyHistory;
  const maxHistoryMinor = useMemo(() => {
    let max = 0;
    for (const pt of historyBars) {
      if (pt.spentMinor > max) max = pt.spentMinor;
    }
    return max;
  }, [historyBars]);

  const historySummaryLabel = useMemo(() => {
    const total = historyBars.reduce((acc, b) => acc + b.spentMinor, 0);
    if (total === 0 || historyBars.length === 0) {
      return t('overview.chartNoData');
    }
    let peak = historyBars[0];
    for (const pt of historyBars) {
      if (pt.spentMinor > peak.spentMinor) peak = pt;
    }
    return t('insights.historyChartA11y', {
      count: historyBars.length,
      total: formatMoney(total, settings.currency),
      peakLabel: formatShortMonthYear(peak.period.start),
      peakAmount: formatMoney(peak.spentMinor, settings.currency),
    });
  }, [historyBars, settings.currency]);

  const handleApplyCustom = () => {
    const f = fromDraft.trim();
    const toVal = toDraft.trim();
    if (!isValidLocalDate(f) || !isValidLocalDate(toVal) || f > toVal) {
      setCustomError(t('activity.invalidCustomDates'));
      return;
    }
    setCustomError(null);
    setCustomRange({ fromIncl: f, toIncl: toVal });
  };

  const handleChartLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 40 && w !== chartWidth) setChartWidth(w);
  };

  if (error && !loading) {
    return (
      <Screen>
        <ErrorState
          title={t('error.genericTitle')}
          body={t('error.genericBody')}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      </Screen>
    );
  }

  if (!loading && !report.hasAnyHistory) {
    return (
      <Screen scroll bottomSpacer>
        <AppText variant="title">{t('insights.title')}</AppText>
        <EmptyState
          icon="analytics-outline"
          title={t('insights.notEnoughTitle')}
          body={t('insights.notEnoughBody')}
          ctaLabel={t('empty.activityCta')}
          onCtaPress={() => router.push('/transaction/new')}
        />
      </Screen>
    );
  }

  const windowQuery: TxQuery = {
    type: 'expense',
    fromIncl: report.window.fromIncl,
    toExcl: report.window.toExcl,
  };

  const formatDiffTrend = (diffMinor: number, pctChange: number | null) => {
    if (pctChange === null) return t('overview.vsLastMonthNoBaseline');
    const pctStr = formatUtilizationPct(Math.abs(pctChange));
    if (diffMinor > 0) {
      return t('overview.vsLastMonthUp', {
        pct: pctStr,
        diff: formatMoney(diffMinor, settings.currency),
      });
    }
    if (diffMinor < 0) {
      return t('overview.vsLastMonthDown', {
        pct: pctStr,
        diff: formatMoney(Math.abs(diffMinor), settings.currency),
      });
    }
    return t('overview.vsLastMonthSame');
  };

  const selectedBar =
    selectedHistoryIdx !== null &&
    selectedHistoryIdx >= 0 &&
    selectedHistoryIdx < historyBars.length
      ? historyBars[selectedHistoryIdx]
      : null;

  const slotW = chartWidth / Math.max(1, historyBars.length);
  const barW = Math.max(8, Math.floor(slotW * 0.56));

  return (
    <Screen scroll bottomSpacer>
      <AppText variant="title">{t('insights.title')}</AppText>

      {/* Selectable periods */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.presetStrip, { gap: theme.spacing.sm }]}
        style={{ flexGrow: 0 }}
      >
        {(
          [
            ['this_week', t('insights.presetThisWeek')],
            ['this_month', t('insights.presetThisMonth')],
            ['last_month', t('insights.presetLastMonth')],
            ['last_3_months', t('insights.presetLast3Months')],
            ['last_6_months', t('insights.presetLast6Months')],
            ['this_year', t('insights.presetThisYear')],
            ['custom', t('insights.presetCustom')],
          ] as const
        ).map(([val, label]) => (
          <Chip
            key={val}
            testID={`insights-preset-${val}`}
            label={label}
            selected={preset === val}
            onPress={() => {
              setPreset(val);
              setSelectedHistoryIdx(null);
            }}
          />
        ))}
      </ScrollView>

      {preset === 'custom' ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={[styles.customRow, { gap: theme.spacing.sm }]}>
            <TextInput
              testID="insights-custom-from"
              value={fromDraft}
              onChangeText={setFromDraft}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.dateInput,
                {
                  minHeight: theme.touch.min,
                  borderRadius: theme.radius.md,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceAlt,
                  paddingHorizontal: theme.spacing.md,
                  color: theme.colors.text,
                  fontFamily: theme.typography.body.fontFamily,
                  fontSize: theme.typography.body.fontSize,
                },
              ]}
            />
            <TextInput
              testID="insights-custom-to"
              value={toDraft}
              onChangeText={setToDraft}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.dateInput,
                {
                  minHeight: theme.touch.min,
                  borderRadius: theme.radius.md,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceAlt,
                  paddingHorizontal: theme.spacing.md,
                  color: theme.colors.text,
                  fontFamily: theme.typography.body.fontFamily,
                  fontSize: theme.typography.body.fontSize,
                },
              ]}
            />
            <Chip label={t('common.save')} selected onPress={handleApplyCustom} />
          </View>
          {customError ? (
            <AppText variant="caption" color="danger">
              {customError}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <AppText variant="caption" color="textMuted">
        {formatPeriodRange(report.window.fromIncl, report.window.toExcl)}
      </AppText>

      {/* Pattern sentences (strictly gated on >= 7 days & >= 5 txs in both periods) */}
      <SectionHeader title={t('insights.patternsSection')} />
      {report.hasSufficientPatternData && report.patternSentences.length > 0 ? (
        <Card padded={false}>
          {report.patternSentences.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              ) : null}
              <ListRow
                testID={`insight-pattern-${item.id}`}
                title={item.text}
                titleNumberOfLines={3}
                left={
                  <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                }
                showChevron
                onPress={() => openActivityWithQuery(item.filterQuery)}
              />
            </React.Fragment>
          ))}
        </Card>
      ) : (
        <Card testID="insights-patterns-insufficient" tone="alt" style={{ gap: theme.spacing.xs }}>
          <AppText variant="body" color="textMuted">
            {t('insights.notEnoughBody')}
          </AppText>
        </Card>
      )}

      {/* Month-to-date comparison card */}
      <SectionHeader title={t('insights.mtdTitle')} />
      <Card testID="insight-mtd-summary" style={{ gap: theme.spacing.sm }}>
        <Pressable
          testID="insight-mtd-card"
          accessibilityRole="button"
          accessibilityLabel={t('insights.mtdTitle')}
          onPress={() =>
            openActivityWithQuery({
              type: 'expense',
              fromIncl: report.mtdComparison ? addDays(today, -(report.mtdComparison.daysCompared - 1)) : today,
              toExcl: addDays(today, 1),
            })
          }
          style={{ gap: theme.spacing.sm }}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="textMuted">
                {t('insights.mtdSubtitle', { days: report.mtdComparison.daysCompared })}
              </AppText>
              <AppText variant="heading">
                {formatDiffTrend(report.mtdComparison.diffMinor, report.mtdComparison.pctChange)}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
          <View style={[styles.rowBetween, { gap: theme.spacing.md }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="textMuted">
                {t('overview.spentLabel')}
              </AppText>
              <Money
                amountMinor={report.mtdComparison.currentMinor}
                currency={settings.currency}
                variant="title"
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="textMuted">
                {t('insights.presetLastMonth')}
              </AppText>
              <Money
                amountMinor={report.mtdComparison.previousMinor}
                currency={settings.currency}
                variant="title"
                color="textMuted"
              />
            </View>
          </View>
        </Pressable>
      </Card>

      {/* Full complete months comparison */}
      <Card testID="insight-full-period-card" style={{ gap: theme.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('insights.fullPeriodTitle')}
          onPress={() =>
            openActivityWithQuery({
              type: 'expense',
              fromIncl: report.fullPeriodComparison.currentPeriod.start,
              toExcl: report.fullPeriodComparison.currentPeriod.endExcl,
            })
          }
          style={{ gap: theme.spacing.sm }}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label" color="textMuted">
                {t('insights.fullPeriodTitle')}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t('insights.fullPeriodSubtitle', {
                  curr: formatShortMonthYear(report.fullPeriodComparison.currentPeriod.start),
                  prev: formatShortMonthYear(report.fullPeriodComparison.previousPeriod.start),
                })}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
          <View style={[styles.rowBetween, { gap: theme.spacing.md }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="textMuted">
                {formatShortMonthYear(report.fullPeriodComparison.currentPeriod.start)}
              </AppText>
              <Money
                amountMinor={report.fullPeriodComparison.currentMinor}
                currency={settings.currency}
                variant="heading"
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" color="textMuted">
                {formatShortMonthYear(report.fullPeriodComparison.previousPeriod.start)}
              </AppText>
              <Money
                amountMinor={report.fullPeriodComparison.previousMinor}
                currency={settings.currency}
                variant="heading"
                color="textMuted"
              />
            </View>
          </View>
          <AppText variant="caption" color="primary">
            {formatDiffTrend(
              report.fullPeriodComparison.diffMinor,
              report.fullPeriodComparison.pctChange
            )}
          </AppText>
        </Pressable>
      </Card>

      {/* Average spending */}
      <SectionHeader
        title={t('insights.averagesSection')}
        actionLabel={t('insights.viewInActivity')}
        onActionPress={() => openActivityWithQuery(windowQuery)}
      />
      {!report.hasWindowExpenses ? (
        <Card tone="alt">
          <AppText variant="body" color="textMuted">
            {t('insights.noWindowExpenses')}
          </AppText>
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <View style={[styles.gridRow, { gap: theme.spacing.md }]}>
            <Card style={styles.avgCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('insights.avgPerDay')}
                onPress={() => openActivityWithQuery(windowQuery)}
                style={{ gap: 4 }}
              >
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgPerDay')}
                </AppText>
                <Money
                  amountMinor={report.averages.perDayMinor}
                  currency={settings.currency}
                  variant="heading"
                />
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgDaysBasis', { days: report.averages.calendarDays })}
                </AppText>
              </Pressable>
            </Card>
            <Card style={styles.avgCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('insights.avgPerTx')}
                onPress={() => openActivityWithQuery(windowQuery)}
                style={{ gap: 4 }}
              >
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgPerTx')}
                </AppText>
                <Money
                  amountMinor={report.averages.perTransactionMinor}
                  currency={settings.currency}
                  variant="heading"
                />
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgTxBasis', { count: report.averages.expenseCount })}
                </AppText>
              </Pressable>
            </Card>
          </View>

          <View style={[styles.gridRow, { gap: theme.spacing.md }]}>
            <Card style={styles.avgCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('insights.avgPerWeek')}
                onPress={() => openActivityWithQuery(windowQuery)}
                style={{ gap: 4 }}
              >
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgPerWeek')}
                </AppText>
                <Money
                  amountMinor={report.averages.perWeekMinor}
                  currency={settings.currency}
                  variant="heading"
                />
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgDaysBasis', { days: report.averages.calendarDays })}
                </AppText>
              </Pressable>
            </Card>
            <Card style={styles.avgCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('insights.avgMonthly', {
                  months: report.averages.monthlyAvgMonths,
                })}
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    fromIncl: report.fullPeriodComparison.previousPeriod.start,
                    toExcl: report.fullPeriodComparison.currentPeriod.endExcl,
                  })
                }
                style={{ gap: 4 }}
              >
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgMonthly', {
                    months: report.averages.monthlyAvgMonths,
                  })}
                </AppText>
                <Money
                  amountMinor={report.averages.monthlyAvgMinor}
                  currency={settings.currency}
                  variant="heading"
                />
                <AppText variant="caption" color="textMuted">
                  {t('insights.avgCompleteBasis')}
                </AppText>
              </Pressable>
            </Card>
          </View>
        </View>
      )}

      {/* Biggest spending (all interactive!) */}
      <SectionHeader title={t('insights.biggestSection')} />
      {report.hasWindowExpenses ? (
        <Card padded={false}>
          {report.biggest.topCategory ? (
            <ListRow
              testID="insight-top-category"
              title={t('insights.topCategory')}
              subtitle={
                categoriesById.get(report.biggest.topCategory.categoryId)?.name ??
                t('common.uncategorized')
              }
              right={
                <Money
                  amountMinor={report.biggest.topCategory.spentMinor}
                  currency={settings.currency}
                  variant="heading"
                />
              }
              showChevron
              onPress={() =>
                openActivityWithQuery({
                  type: 'expense',
                  categoryId: report.biggest.topCategory?.categoryId,
                  fromIncl: report.window.fromIncl,
                  toExcl: report.window.toExcl,
                })
              }
            />
          ) : null}

          {report.biggest.largestExpense ? (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <ListRow
                testID="insight-largest-expense"
                title={t('insights.largestExpense')}
                subtitle={`${
                  report.biggest.largestExpense.description ||
                  (report.biggest.largestExpense.categoryId
                    ? (categoriesById.get(report.biggest.largestExpense.categoryId)?.name ??
                      t('common.uncategorized'))
                    : t('common.uncategorized'))
                } · ${formatShortDate(report.biggest.largestExpense.occurredOn)}`}
                right={
                  <Money
                    amountMinor={report.biggest.largestExpense.amountMinor}
                    currency={settings.currency}
                    variant="heading"
                  />
                }
                showChevron
                onPress={() =>
                  router.push({
                    pathname: '/transaction/[id]',
                    params: { id: report.biggest.largestExpense?.transactionId ?? '' },
                  })
                }
              />
            </>
          ) : null}

          {report.biggest.mostFrequentCategory ? (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <ListRow
                testID="insight-most-frequent"
                title={t('insights.mostFrequent')}
                subtitle={t('insights.mostFrequentValue', {
                  name:
                    categoriesById.get(report.biggest.mostFrequentCategory.categoryId)?.name ??
                    t('common.uncategorized'),
                  count: report.biggest.mostFrequentCategory.count,
                })}
                right={
                  <Money
                    amountMinor={report.biggest.mostFrequentCategory.spentMinor}
                    currency={settings.currency}
                    variant="heading"
                  />
                }
                showChevron
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    categoryId: report.biggest.mostFrequentCategory?.categoryId,
                    fromIncl: report.window.fromIncl,
                    toExcl: report.window.toExcl,
                  })
                }
              />
            </>
          ) : null}

          {report.biggest.mostExpensiveDay ? (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <ListRow
                testID="insight-most-expensive-day"
                title={t('insights.mostExpensiveDay')}
                subtitle={formatShortDate(report.biggest.mostExpensiveDay.date)}
                right={
                  <Money
                    amountMinor={report.biggest.mostExpensiveDay.spentMinor}
                    currency={settings.currency}
                    variant="heading"
                  />
                }
                showChevron
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    fromIncl: report.biggest.mostExpensiveDay?.date,
                    toExcl: addDays(report.biggest.mostExpensiveDay?.date ?? today, 1),
                  })
                }
              />
            </>
          ) : null}

          {report.biggest.biggestCategoryChange ? (
            <>
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <ListRow
                testID="insight-biggest-change"
                title={t('insights.biggestChange')}
                subtitle={
                  categoriesById.get(report.biggest.biggestCategoryChange.categoryId)?.name ??
                  t('common.uncategorized')
                }
                right={
                  <AppText
                    variant="label"
                    color={
                      report.biggest.biggestCategoryChange.diffMinor > 0
                        ? 'expense'
                        : report.biggest.biggestCategoryChange.diffMinor < 0
                          ? 'income'
                          : 'textMuted'
                    }
                    tabularNums
                  >
                    {`${report.biggest.biggestCategoryChange.diffMinor >= 0 ? '+' : '−'}${formatMoney(
                      Math.abs(report.biggest.biggestCategoryChange.diffMinor),
                      settings.currency
                    )}`}
                  </AppText>
                }
                showChevron
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    categoryId: report.biggest.biggestCategoryChange?.categoryId,
                    fromIncl: addDays(today, -(report.mtdComparison.daysCompared - 1)),
                    toExcl: addDays(today, 1),
                  })
                }
              />
            </>
          ) : null}
        </Card>
      ) : (
        <Card tone="alt">
          <AppText variant="body" color="textMuted">
            {t('insights.noWindowExpenses')}
          </AppText>
        </Card>
      )}

      {/* Category changes list (MTD) */}
      <SectionHeader title={t('insights.categoryChangesSection')} />
      {report.categoryChanges.length > 0 ? (
        <Card padded={false}>
          {report.categoryChanges.slice(0, 6).map((item, idx) => {
            const cat = categoriesById.get(item.categoryId);
            const pctStr =
              item.pctChange !== null
                ? `${item.pctChange > 0 ? '+' : ''}${item.pctChange}%`
                : 'New';
            return (
              <React.Fragment key={item.categoryId}>
                {idx > 0 ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border }} />
                ) : null}
                <ListRow
                  testID={`insight-cat-change-${item.categoryId}`}
                  title={cat?.name ?? t('common.uncategorized')}
                  subtitle={`${formatMoney(item.currentMinor, settings.currency)} vs ${formatMoney(
                    item.previousMinor,
                    settings.currency
                  )}`}
                  right={
                    <AppText
                      variant="label"
                      color={
                        item.diffMinor > 0
                          ? 'expense'
                          : item.diffMinor < 0
                            ? 'income'
                            : 'textMuted'
                      }
                      tabularNums
                    >
                      {pctStr}
                    </AppText>
                  }
                  showChevron
                  onPress={() =>
                    openActivityWithQuery({
                      type: 'expense',
                      categoryId: item.categoryId,
                      fromIncl: addDays(today, -(report.mtdComparison.daysCompared - 1)),
                      toExcl: addDays(today, 1),
                    })
                  }
                />
              </React.Fragment>
            );
          })}
        </Card>
      ) : (
        <Card tone="alt">
          <AppText variant="body" color="textMuted">
            {t('insights.noChangeYet')}
          </AppText>
        </Card>
      )}

      {/* Monthly history chart with descriptive accessibilityLabel */}
      <SectionHeader title={t('insights.historyChartSection')} />
      <Card style={{ gap: theme.spacing.md }}>
        <View
          style={[
            styles.tooltipBox,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            },
          ]}
        >
          {selectedBar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatShortMonthYear(selectedBar.period.start)} ${t('insights.viewInActivity')}`}
              onPress={() =>
                openActivityWithQuery({
                  type: 'expense',
                  fromIncl: selectedBar.period.start,
                  toExcl: selectedBar.period.endExcl,
                })
              }
              style={styles.rowBetween}
            >
              <AppText variant="label" color="textMuted">
                {formatShortMonthYear(selectedBar.period.start)}
              </AppText>
              <AppText variant="heading" color="primary" tabularNums>
                {`${formatMoney(selectedBar.spentMinor, settings.currency)} →`}
              </AppText>
            </Pressable>
          ) : (
            <AppText variant="caption" color="textMuted">
              {t('insights.historyChartHint')}
            </AppText>
          )}
        </View>

        <View onLayout={handleChartLayout} style={styles.svgContainer}>
          <Svg
            testID="insights-history-svg"
            width={chartWidth}
            height={CHART_HEIGHT}
            accessibilityRole="image"
            accessibilityLabel={historySummaryLabel}
          >
            <Line
              x1={0}
              y1={TOP_PAD + PLOT_HEIGHT}
              x2={chartWidth}
              y2={TOP_PAD + PLOT_HEIGHT}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
            {historyBars.map((bar, idx) => {
              const xCenter = idx * slotW + slotW / 2;
              const x = xCenter - barW / 2;
              const rawH =
                maxHistoryMinor > 0 ? (bar.spentMinor / maxHistoryMinor) * PLOT_HEIGHT : 0;
              const barH = bar.spentMinor > 0 ? Math.max(4, rawH) : 2;
              const y = TOP_PAD + PLOT_HEIGHT - barH;
              const isSelected = selectedHistoryIdx === idx;
              const fillOpacity =
                bar.spentMinor === 0
                  ? 0.55
                  : selectedHistoryIdx === null || isSelected
                    ? 1
                    : 0.45;
              const shortLabel = formatShortMonthYear(bar.period.start).split(' ')[0];

              return (
                <React.Fragment key={bar.period.start}>
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={Math.min(6, barW / 2)}
                    fill={bar.spentMinor === 0 ? theme.colors.border : theme.colors.primary}
                    fillOpacity={fillOpacity}
                  />
                  <SvgText
                    x={xCenter}
                    y={CHART_HEIGHT - 6}
                    fontSize={11}
                    fill={theme.colors.textMuted}
                    textAnchor="middle"
                  >
                    {shortLabel}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
          <View style={styles.hitOverlay}>
            {historyBars.map((bar, idx) => (
              <Pressable
                key={bar.period.start}
                accessibilityRole="button"
                accessibilityLabel={`${formatShortMonthYear(bar.period.start)}: ${formatMoney(
                  bar.spentMinor,
                  settings.currency
                )}`}
                onPress={() => setSelectedHistoryIdx(idx === selectedHistoryIdx ? null : idx)}
                style={styles.hitSlice}
              />
            ))}
          </View>
        </View>
      </Card>
    </Screen>
  );
}

export default function InsightsTab() {
  return <InsightsContent />;
}

const styles = StyleSheet.create({
  presetStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
  },
  avgCard: {
    flex: 1,
  },
  tooltipBox: {
    minHeight: 38,
    justifyContent: 'center',
  },
  svgContainer: {
    width: '100%',
    height: CHART_HEIGHT,
    position: 'relative',
  },
  hitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  hitSlice: {
    flex: 1,
    height: '100%',
  },
});
