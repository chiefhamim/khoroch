import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatUtilizationPct } from '@/domain/calc';
import {
  addDays,
  formatPeriodRange,
  formatShortDate,
  formatShortMonthYear,
  todayLocalDate,
} from '@/domain/dates';
import type { CustomDateRange, InsightsPeriodPreset } from '@/domain/insights';
import { formatMoney } from '@/domain/money';
import { formatCycleLabel } from '@/domain/period';
import type { LocalDate, TxQuery } from '@/domain/types';
import { t } from '@/i18n';
import { useActivityFilterStore } from '@/state/activityFilterStore';
import { useAppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { useInsights } from '@/state/useInsights';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { DateField } from '@/ui/DateField';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { hapticLight } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { PressableScale } from '@/ui/PressableScale';

const CHART_HEIGHT = 152;
const TOP_PAD = 12;
const BOTTOM_PAD = 24;
const PLOT_HEIGHT = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

const PRESET_OPTIONS: { value: InsightsPeriodPreset; labelKey: Parameters<typeof t>[0] }[] = [
  { value: 'this_week', labelKey: 'insights.presetThisWeek' },
  { value: 'this_month', labelKey: 'insights.presetThisMonth' },
  { value: 'last_month', labelKey: 'insights.presetLastMonth' },
  { value: 'last_3_months', labelKey: 'insights.presetLast3Months' },
  { value: 'last_6_months', labelKey: 'insights.presetLast6Months' },
  { value: 'this_year', labelKey: 'insights.presetThisYear' },
  { value: 'custom', labelKey: 'insights.presetCustom' },
];

function isValidPreset(value: string | undefined): value is InsightsPeriodPreset {
  return PRESET_OPTIONS.some((opt) => opt.value === value);
}

export interface InsightsContentProps {
  todayOverride?: LocalDate;
  showBack?: boolean;
}

export function InsightsContent({ todayOverride, showBack = false }: InsightsContentProps) {
  const { settings } = useAppContext();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const compactNumbers = usePrivacyStore((s) => s.compactNumbers);
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ preset?: string }>();
  const applyExternalFilters = useActivityFilterStore((s) => s.applyExternalFilters);

  const todayDefault = todayOverride ?? todayLocalDate();
  const initialPreset = isValidPreset(params?.preset) ? params.preset : 'this_month';

  const [preset, setPreset] = useState<InsightsPeriodPreset>(initialPreset);
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState<LocalDate>(addDays(todayDefault, -30));
  const [toDraft, setToDraft] = useState<LocalDate>(todayDefault);
  const [customRange, setCustomRange] = useState<CustomDateRange>({
    fromIncl: addDays(todayDefault, -30),
    toIncl: todayDefault,
  });
  const [customError, setCustomError] = useState<string | null>(null);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(280);
  const lastRoutePresetRef = useRef<string | undefined>(params?.preset);

  useEffect(() => {
    const incoming = params?.preset;
    if (incoming && incoming !== lastRoutePresetRef.current && isValidPreset(incoming)) {
      lastRoutePresetRef.current = incoming;
      setPreset(incoming);
      setSelectedHistoryIdx(null);
    }
  }, [params?.preset]);

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
      categoryIds: query.categoryId ? [query.categoryId] : [],
      datePreset: query.fromIncl || inclusiveTo ? 'custom' : 'all',
      customFromIncl: (query.fromIncl ?? '') as LocalDate | '',
      customToIncl: inclusiveTo as LocalDate | '',
    });
    router.push('/(tabs)/ledger');
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
      total: formatMoney(total, settings.currency, { hidden: hideAmounts, showPoisha }),
      peakLabel: formatCycleLabel(peak.period, settings.monthStartDay, {
        includeYear: true,
      }),
      peakAmount: formatMoney(peak.spentMinor, settings.currency, {
        hidden: hideAmounts,
        showPoisha,
      }),
    });
  }, [historyBars, settings.currency, settings.monthStartDay, hideAmounts, showPoisha]);

  const handleApplyCustom = () => {
    if (fromDraft > toDraft) {
      setCustomError(t('activity.invalidCustomDates'));
      return;
    }
    setCustomError(null);
    setCustomRange({ fromIncl: fromDraft, toIncl: toDraft });
    setPreset('custom');
    setSelectedHistoryIdx(null);
    setPeriodSheetOpen(false);
  };

  const handleChartLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 40 && w !== chartWidth) setChartWidth(w);
  };

  const activePresetLabel = useMemo(() => {
    const found = PRESET_OPTIONS.find((opt) => opt.value === preset);
    return found ? t(found.labelKey) : t('insights.presetThisMonth');
  }, [preset]);

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
          testID="insights-empty-state"
          icon="chart-column"
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

  const formatDiffTrend = (
    diffMinor: number,
    pctChange: number | null,
    daysCompared?: number
  ) => {
    if (pctChange === null) {
      return daysCompared !== undefined
        ? t('insights.mtdNoPriorBaseline', { days: daysCompared })
        : t('overview.vsLastMonthNoBaseline');
    }
    if (daysCompared !== undefined) {
      if (diffMinor > 0) {
        return `${t('insights.mtdDiffMore', {
          diff: formatMoney(diffMinor, settings.currency, { hidden: hideAmounts, showPoisha }),
          days: daysCompared,
        })} ↑`;
      }
      if (diffMinor < 0) {
        return `${t('insights.mtdDiffLess', {
          diff: formatMoney(Math.abs(diffMinor), settings.currency, {
            hidden: hideAmounts,
            showPoisha,
          }),
          days: daysCompared,
        })} ↓`;
      }
      return t('insights.mtdDiffSame', { days: daysCompared });
    }
    const pctStr = formatUtilizationPct(Math.abs(pctChange));
    if (diffMinor > 0) {
      return `${t('overview.vsLastMonthUp', {
        pct: pctStr,
        diff: formatMoney(diffMinor, settings.currency, { hidden: hideAmounts, showPoisha }),
      })} ↑`;
    }
    if (diffMinor < 0) {
      return `${t('overview.vsLastMonthDown', {
        pct: pctStr,
        diff: formatMoney(Math.abs(diffMinor), settings.currency, {
          hidden: hideAmounts,
          showPoisha,
        }),
      })} ↓`;
    }
    return t('overview.vsLastMonthSame');
  };

  const currCompMinor = report.mtdComparison.currentMinor;
  const prevCompMinor = report.mtdComparison.previousMinor;
  const compMax = Math.max(currCompMinor, prevCompMinor, 1);
  const currBarPct = currCompMinor > 0 ? Math.max(4, (currCompMinor / compMax) * 100) : 0;
  const prevBarPct = prevCompMinor > 0 ? Math.max(4, (prevCompMinor / compMax) * 100) : 0;

  const fullCurrLabel = formatCycleLabel(
    report.fullPeriodComparison.currentPeriod,
    settings.monthStartDay
  );
  const fullPrevLabel = formatCycleLabel(
    report.fullPeriodComparison.previousPeriod,
    settings.monthStartDay
  );

  const selectedBar =
    selectedHistoryIdx !== null &&
    selectedHistoryIdx >= 0 &&
    selectedHistoryIdx < historyBars.length
      ? historyBars[selectedHistoryIdx]
      : null;

  const slotW = chartWidth / Math.max(1, historyBars.length);
  const barW = Math.min(28, Math.max(8, Math.floor(slotW * 0.56)));

  const mtdToneColor =
    report.mtdComparison.diffMinor > 0
      ? 'danger'
      : report.mtdComparison.diffMinor < 0
        ? 'accent'
        : 'textSecondary';

  return (
    <Screen scroll bottomSpacer={!showBack}>
      {/* Top header with Period dropdown */}
      <View style={[styles.headerRow, { gap: theme.spacing.sm }]}>
        <View style={[styles.headerLeft, { gap: theme.spacing.sm }]}>
          {showBack ? (
            <IconButton
              testID="insights-back-button"
              icon="arrow-left"
              variant="ghost"
              size={40}
              iconSize={20}
              accessibilityLabel={t('common.back')}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/plan');
                }
              }}
            />
          ) : null}
          <AppText variant="title">{t('insights.title')}</AppText>
        </View>
        <PressableScale pressScale={0.98}
          testID="insights-period-dropdown"
          accessibilityRole="button"
          accessibilityLabel={`${t('insights.periodTitle')}: ${activePresetLabel}`}
          onPress={() => {
            hapticLight();
            setPeriodSheetOpen(true);
          }}
          style={({ pressed }) => [
            styles.periodDropdown,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
              opacity: pressed && !reducedMotion ? 0.72 : 1,
            },
          ]}
        >
          <AppText variant="label" color="text">
            {activePresetLabel}
          </AppText>
          <AppIcon name="chevron-down" size={14} color={theme.colors.textSecondary} />
        </PressableScale>
      </View>

      <AppText variant="caption" color="textSecondary" style={{ marginTop: -theme.spacing.sm }}>
        {formatPeriodRange(report.window.fromIncl, report.window.toExcl)}
      </AppText>

      {/* Headline comparison card */}
      <Surface testID="insight-mtd-summary" style={{ gap: theme.spacing.md }}>
        {!report.hasSufficientPatternData &&
        currCompMinor === 0 &&
        prevCompMinor === 0 &&
        !report.hasWindowExpenses ? (
          <AppText variant="body" color="textSecondary">
            {t('insights.notEnoughBody')}
          </AppText>
        ) : (
          <PressableScale pressScale={0.98}
            testID="insight-mtd-card"
            accessibilityRole="button"
            accessibilityLabel={t('insights.mtdTitle')}
            onPress={() =>
              openActivityWithQuery({
                type: 'expense',
                fromIncl: report.window.fromIncl,
                toExcl: report.window.toExcl,
              })
            }
            style={{ gap: theme.spacing.sm }}
          >
            <View style={{ gap: 4 }}>
              <AppText variant="display" tabularNums style={{ fontSize: 25, lineHeight: 31 }}>
                {preset === 'this_month'
                  ? t('insights.spentSoFarHeadline', {
                      amount: formatMoney(currCompMinor, settings.currency, {
                        hidden: hideAmounts,
                        showPoisha,
                        compact: compactNumbers,
                      }),
                    })
                  : t('insights.spentWindowHeadline', {
                      amount: formatMoney(
                        report.averages.totalExpenseMinor,
                        settings.currency,
                        {
                          hidden: hideAmounts,
                          showPoisha,
                          compact: compactNumbers,
                        }
                      ),
                    })}
              </AppText>
              <AppText variant="label" color={mtdToneColor}>
                {formatDiffTrend(
                  report.mtdComparison.diffMinor,
                  report.mtdComparison.pctChange,
                  report.mtdComparison.daysCompared
                )}
              </AppText>
            </View>

            {/* Two compared bars: this cycle vs last cycle */}
            <View style={{ gap: theme.spacing.xs + 2, marginTop: theme.spacing.xs }}>
              <View style={styles.compBarWrap}>
                <View style={styles.compLabelRow}>
                  <AppText variant="caption" color="textSecondary">
                    {t('insights.thisCycleBar')}
                  </AppText>
                  <Money
                    amountMinor={currCompMinor}
                    currency={settings.currency}
                    variant="caption"
                    color="text"
                  />
                </View>
                <View
                  style={[
                    styles.compTrack,
                    { backgroundColor: theme.colors.surfaceSunken },
                  ]}
                >
                  <View
                    style={[
                      styles.compFill,
                      {
                        width: `${currBarPct}%`,
                        backgroundColor: theme.colors.accent,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.compBarWrap}>
                <View style={styles.compLabelRow}>
                  <AppText variant="caption" color="textSecondary">
                    {t('insights.lastCycleBar')}
                  </AppText>
                  <Money
                    amountMinor={prevCompMinor}
                    currency={settings.currency}
                    variant="caption"
                    color="textSecondary"
                  />
                </View>
                <View
                  style={[
                    styles.compTrack,
                    { backgroundColor: theme.colors.surfaceSunken },
                  ]}
                >
                  <View
                    style={[
                      styles.compFill,
                      {
                        width: `${prevBarPct}%`,
                        backgroundColor: theme.colors.textTertiary,
                        opacity: 0.45,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </PressableScale>
        )}
      </Surface>

      {/* Last complete cycle comparison */}
      <Surface testID="insight-full-period-card" style={{ gap: theme.spacing.sm }}>
        <PressableScale pressScale={0.98}
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
            <View style={[styles.flexOne, { gap: 2 }]}>
              <AppText variant="label" color="textSecondary">
                {t('insights.fullPeriodTitle')}
              </AppText>
              <AppText variant="bodyStrong">
                {t('insights.fullPeriodSubtitle', {
                  curr: fullCurrLabel,
                  prev: fullPrevLabel,
                })}
              </AppText>
            </View>
            <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
          </View>
          <View style={[styles.rowBetween, { gap: theme.spacing.md }]}>
            <View style={[styles.flexOne, { gap: 2 }]}>
              <AppText variant="caption" color="textSecondary">
                {fullCurrLabel}
              </AppText>
              <Money
                amountMinor={report.fullPeriodComparison.currentMinor}
                currency={settings.currency}
                variant="headline"
                allowCompact
              />
            </View>
            <View style={[styles.flexOne, { gap: 2 }]}>
              <AppText variant="caption" color="textSecondary">
                {fullPrevLabel}
              </AppText>
              <Money
                amountMinor={report.fullPeriodComparison.previousMinor}
                currency={settings.currency}
                variant="headline"
                color="textSecondary"
                allowCompact
              />
            </View>
          </View>
        </PressableScale>
      </Surface>

      {/* Pattern observations (strictly gated on >=7 days & >=5 txs) */}
      {report.hasSufficientPatternData && report.patternSentences.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="headline">{t('insights.patternsSection')}</AppText>
          <Surface padded={false}>
            {report.patternSentences.map((item, idx) => (
              <ListRow
                key={item.id}
                testID={`insight-pattern-${item.id}`}
                title={item.text}
                titleNumberOfLines={3}
                left={
                  <AppIcon name="sparkles" size={18} color={theme.colors.accent} />
                }
                showChevron
                showDivider={idx < report.patternSentences.length - 1}
                onPress={() => openActivityWithQuery(item.filterQuery)}
              />
            ))}
          </Surface>
        </View>
      ) : (
        <Surface testID="insights-patterns-insufficient" variant="sunken">
          <AppText variant="body" color="textSecondary">
            {t('insights.notEnoughBody')}
          </AppText>
        </Surface>
      )}

      {/* Averages 2x2 grid */}
      <View style={{ gap: theme.spacing.sm }}>
        <View style={styles.rowBetween}>
          <AppText variant="headline">{t('insights.averagesSection')}</AppText>
          <PressableScale pressScale={0.98}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => openActivityWithQuery(windowQuery)}
          >
            <AppText variant="label" color="accent">
              {t('insights.viewInActivity')}
            </AppText>
          </PressableScale>
        </View>

        {!report.hasWindowExpenses ? (
          <Surface variant="sunken">
            <AppText variant="body" color="textSecondary">
              {t('insights.noWindowExpenses')}
            </AppText>
          </Surface>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={[styles.gridRow, { gap: theme.spacing.sm }]}>
              <Surface
                style={[styles.avgCard, { gap: 4 }]}
                onPress={() => openActivityWithQuery(windowQuery)}
                accessibilityLabel={t('insights.avgPerDay')}
              >
                <AppText variant="caption" color="textSecondary">
                  {t('insights.avgPerDay')}
                </AppText>
                <Money
                  amountMinor={report.averages.perDayMinor}
                  currency={settings.currency}
                  variant="headline"
                  roundToWhole
                  allowCompact
                />
              </Surface>

              <Surface
                style={[styles.avgCard, { gap: 4 }]}
                onPress={() => openActivityWithQuery(windowQuery)}
                accessibilityLabel={t('insights.avgPerWeek')}
              >
                <AppText variant="caption" color="textSecondary">
                  {t('insights.avgPerWeek')}
                </AppText>
                <Money
                  amountMinor={report.averages.perWeekMinor}
                  currency={settings.currency}
                  variant="headline"
                  roundToWhole
                  allowCompact
                />
              </Surface>
            </View>

            <View style={[styles.gridRow, { gap: theme.spacing.sm }]}>
              <Surface
                style={[styles.avgCard, { gap: 4 }]}
                onPress={() => openActivityWithQuery(windowQuery)}
                accessibilityLabel={t('insights.avgPerTx')}
              >
                <AppText variant="caption" color="textSecondary">
                  {t('insights.avgPerTx')}
                </AppText>
                <Money
                  amountMinor={report.averages.perTransactionMinor}
                  currency={settings.currency}
                  variant="headline"
                  roundToWhole
                  allowCompact
                />
              </Surface>

              <Surface
                style={[styles.avgCard, { gap: 4 }]}
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    fromIncl: report.fullPeriodComparison.previousPeriod.start,
                    toExcl: report.fullPeriodComparison.currentPeriod.endExcl,
                  })
                }
                accessibilityLabel={t('insights.avgMonthly')}
              >
                <AppText variant="caption" color="textSecondary">
                  {t('insights.avgMonthly')}
                </AppText>
                <Money
                  amountMinor={report.averages.monthlyAvgMinor}
                  currency={settings.currency}
                  variant="headline"
                  roundToWhole
                  allowCompact
                />
              </Surface>
            </View>
          </View>
        )}
      </View>

      {/* Biggest */}
      {report.hasWindowExpenses ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="headline">{t('insights.biggestSection')}</AppText>
          <Surface padded={false}>
            {report.biggest.topCategory ? (
              (() => {
                const cat = categoriesById.get(report.biggest.topCategory.categoryId);
                return (
                  <ListRow
                    testID="insight-top-category"
                    left={
                      <IconTile
                        icon={cat?.icon ?? 'shapes'}
                        colorKey={cat?.colorKey ?? 'gray'}
                        size="sm"
                      />
                    }
                    title={t('insights.topCategory')}
                    subtitle={cat?.name ?? t('common.uncategorized')}
                    right={
                      <Money
                        amountMinor={report.biggest.topCategory.spentMinor}
                        currency={settings.currency}
                        variant="bodyStrong"
                      />
                    }
                    showChevron
                    showDivider={
                      Boolean(
                        report.biggest.largestExpense ||
                          report.biggest.mostExpensiveDay ||
                          report.biggest.mostFrequentCategory
                      )
                    }
                    onPress={() =>
                      openActivityWithQuery({
                        type: 'expense',
                        categoryId: report.biggest.topCategory?.categoryId,
                        fromIncl: report.window.fromIncl,
                        toExcl: report.window.toExcl,
                      })
                    }
                  />
                );
              })()
            ) : null}

            {report.biggest.largestExpense ? (
              (() => {
                const cat = report.biggest.largestExpense.categoryId
                  ? categoriesById.get(report.biggest.largestExpense.categoryId)
                  : undefined;
                return (
                  <ListRow
                    testID="insight-largest-expense"
                    left={
                      <IconTile
                        icon={cat?.icon ?? 'shapes'}
                        colorKey={cat?.colorKey ?? 'gray'}
                        size="sm"
                      />
                    }
                    title={t('insights.largestExpense')}
                    subtitle={`${
                      report.biggest.largestExpense.description ||
                      cat?.name ||
                      t('common.uncategorized')
                    } · ${formatShortDate(report.biggest.largestExpense.occurredOn)}`}
                    right={
                      <Money
                        amountMinor={report.biggest.largestExpense.amountMinor}
                        currency={settings.currency}
                        variant="bodyStrong"
                      />
                    }
                    showChevron
                    showDivider={
                      Boolean(
                        report.biggest.mostExpensiveDay ||
                          report.biggest.mostFrequentCategory
                      )
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/transaction/[id]',
                        params: {
                          id: report.biggest.largestExpense?.transactionId ?? '',
                        },
                      })
                    }
                  />
                );
              })()
            ) : null}

            {report.biggest.mostExpensiveDay ? (
              <ListRow
                testID="insight-most-expensive-day"
                left={<IconTile icon="calendar" colorKey="amber" size="sm" />}
                title={t('insights.mostExpensiveDay')}
                subtitle={formatShortDate(report.biggest.mostExpensiveDay.date)}
                right={
                  <Money
                    amountMinor={report.biggest.mostExpensiveDay.spentMinor}
                    currency={settings.currency}
                    variant="bodyStrong"
                  />
                }
                showChevron
                showDivider={Boolean(report.biggest.mostFrequentCategory)}
                onPress={() =>
                  openActivityWithQuery({
                    type: 'expense',
                    fromIncl: report.biggest.mostExpensiveDay?.date,
                    toExcl: addDays(report.biggest.mostExpensiveDay?.date ?? today, 1),
                  })
                }
              />
            ) : null}

            {report.biggest.mostFrequentCategory ? (
              (() => {
                const cat = categoriesById.get(
                  report.biggest.mostFrequentCategory.categoryId
                );
                return (
                  <ListRow
                    testID="insight-most-frequent"
                    left={
                      <IconTile
                        icon={cat?.icon ?? 'shapes'}
                        colorKey={cat?.colorKey ?? 'gray'}
                        size="sm"
                      />
                    }
                    title={t('insights.mostFrequent')}
                    subtitle={t('insights.mostFrequentValue', {
                      name: cat?.name ?? t('common.uncategorized'),
                      count: report.biggest.mostFrequentCategory.count,
                    })}
                    right={
                      <Money
                        amountMinor={report.biggest.mostFrequentCategory.spentMinor}
                        currency={settings.currency}
                        variant="bodyStrong"
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
                );
              })()
            ) : null}
          </Surface>
        </View>
      ) : null}

      {/* Changes vs last cycle */}
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="headline">{t('insights.categoryChangesSection')}</AppText>
        {report.categoryChanges.length > 0 ? (
          <Surface padded={false}>
            {report.categoryChanges.slice(0, 6).map((item, idx, arr) => {
              const cat = categoriesById.get(item.categoryId);
              const pctLabel =
                item.pctChange !== null
                  ? item.pctChange > 0
                    ? `↑ +${item.pctChange}%`
                    : item.pctChange < 0
                      ? `↓ ${item.pctChange}%`
                      : '0%'
                  : 'New';

              return (
                <ListRow
                  key={item.categoryId}
                  testID={`insight-cat-change-${item.categoryId}`}
                  left={
                    <IconTile
                      icon={cat?.icon ?? 'shapes'}
                      colorKey={cat?.colorKey ?? 'gray'}
                      size="sm"
                    />
                  }
                  title={cat?.name ?? t('common.uncategorized')}
                  subtitle={`${formatMoney(item.currentMinor, settings.currency, { hidden: hideAmounts, showPoisha })} vs ${formatMoney(
                    item.previousMinor,
                    settings.currency,
                    { hidden: hideAmounts, showPoisha }
                  )}`}
                  right={
                    <AppText
                      variant="label"
                      color={
                        item.diffMinor > 0
                          ? 'danger'
                          : item.diffMinor < 0
                            ? 'accent'
                            : 'textSecondary'
                      }
                      tabularNums
                    >
                      {pctLabel}
                    </AppText>
                  }
                  showChevron
                  showDivider={idx < arr.length - 1}
                  onPress={() =>
                    openActivityWithQuery({
                      type: 'expense',
                      categoryId: item.categoryId,
                      fromIncl: addDays(today, -(report.mtdComparison.daysCompared - 1)),
                      toExcl: addDays(today, 1),
                    })
                  }
                />
              );
            })}
          </Surface>
        ) : (
          <Surface variant="sunken">
            <AppText variant="body" color="textSecondary">
              {t('insights.noChangeYet')}
            </AppText>
          </Surface>
        )}
      </View>

      {/* Spending history bar chart by cycle */}
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="headline">{t('insights.historyChartSection')}</AppText>
        <Surface style={{ gap: theme.spacing.sm }}>
          {selectedBar ? (
            <PressableScale pressScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${formatCycleLabel(selectedBar.period, settings.monthStartDay)} ${t('insights.viewInActivity')}`}
              onPress={() =>
                openActivityWithQuery({
                  type: 'expense',
                  fromIncl: selectedBar.period.start,
                  toExcl: selectedBar.period.endExcl,
                })
              }
              style={[
                styles.tooltipBox,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.sm,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs + 2,
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <AppText variant="label" color="textSecondary">
                  {formatCycleLabel(selectedBar.period, settings.monthStartDay, {
                    includeYear: true,
                  })}
                </AppText>
                <AppText variant="bodyStrong" color="accent" tabularNums>
                  {`${formatMoney(selectedBar.spentMinor, settings.currency, {
                    hidden: hideAmounts,
                    showPoisha,
                  })} →`}
                </AppText>
              </View>
            </PressableScale>
          ) : (
            <AppText variant="caption" color="textSecondary">
              {t('insights.historyChartHint')}
            </AppText>
          )}

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
                stroke={theme.colors.separator}
                strokeWidth={1}
              />
              {historyBars.map((bar, idx) => {
                const xCenter = idx * slotW + slotW / 2;
                const x = xCenter - barW / 2;
                const rawH =
                  maxHistoryMinor > 0 ? (bar.spentMinor / maxHistoryMinor) * PLOT_HEIGHT : 0;
                const barH = bar.spentMinor > 0 ? Math.max(5, rawH) : 2;
                const y = TOP_PAD + PLOT_HEIGHT - barH;
                const isSelected = selectedHistoryIdx === idx;
                const isLatest = idx === historyBars.length - 1;
                const fill =
                  bar.spentMinor === 0
                    ? theme.colors.textTertiary
                    : theme.colors.accent;
                const fillOpacity =
                  bar.spentMinor === 0
                    ? 0.3
                    : selectedHistoryIdx !== null
                      ? isSelected
                        ? 1
                        : 0.25
                      : isLatest
                        ? 1
                        : 0.35;
                const axisLabel =
                  settings.monthStartDay === 1
                    ? formatShortMonthYear(bar.period.start).split(' ')[0]
                    : formatShortDate(bar.period.start);

                return (
                  <React.Fragment key={bar.period.start}>
                    <Rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={bar.spentMinor === 0 ? 1 : Math.min(6, barW / 2)}
                      fill={fill}
                      fillOpacity={fillOpacity}
                    />
                    <SvgText
                      x={xCenter}
                      y={CHART_HEIGHT - 6}
                      fontSize={11}
                      fill={
                        isLatest ? theme.colors.text : theme.colors.textSecondary
                      }
                      fontWeight={isLatest ? '600' : '400'}
                      textAnchor="middle"
                    >
                      {axisLabel}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
            <View style={styles.hitOverlay}>
              {historyBars.map((bar, idx) => (
                <PressableScale pressScale={0.98}
                  key={bar.period.start}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatCycleLabel(bar.period, settings.monthStartDay)}: ${formatMoney(
                    bar.spentMinor,
                    settings.currency,
                    { hidden: hideAmounts, showPoisha }
                  )}`}
                  onPress={() =>
                    setSelectedHistoryIdx(idx === selectedHistoryIdx ? null : idx)
                  }
                  style={styles.hitSlice}
                />
              ))}
            </View>
          </View>
        </Surface>
      </View>

      {/* Time period selector bottom sheet (7 options + custom DateFields) */}
      <Sheet
        testID="insights-period-sheet"
        visible={periodSheetOpen}
        onClose={() => setPeriodSheetOpen(false)}
        title={t('insights.periodTitle')}
      >
        <Surface padded={false}>
          {PRESET_OPTIONS.map((opt, idx) => (
            <ListRow
              key={opt.value}
              testID={`insights-preset-${opt.value}`}
              compact
              title={t(opt.labelKey)}
              right={
                preset === opt.value ? (
                  <AppIcon name="check" size={18} color={theme.colors.accent} />
                ) : null
              }
              showDivider={idx < PRESET_OPTIONS.length - 1}
              onPress={() => {
                setSelectedHistoryIdx(null);
                setCustomError(null);
                if (opt.value === 'custom') {
                  setPreset('custom');
                } else {
                  setPreset(opt.value);
                  setPeriodSheetOpen(false);
                }
              }}
            />
          ))}
        </Surface>

        {preset === 'custom' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={[styles.gridRow, { gap: theme.spacing.sm }]}>
              <View style={[styles.flexOne, { gap: 4 }]}>
                <AppText variant="caption" color="textSecondary">
                  {t('activity.fromDateLabel')}
                </AppText>
                <DateField
                  testID="insights-custom-from"
                  value={fromDraft}
                  today={today}
                  onChange={(d) => {
                    setFromDraft(d);
                    if (customError) setCustomError(null);
                  }}
                />
              </View>
              <View style={[styles.flexOne, { gap: 4 }]}>
                <AppText variant="caption" color="textSecondary">
                  {t('activity.toDateLabel')}
                </AppText>
                <DateField
                  testID="insights-custom-to"
                  value={toDraft}
                  today={today}
                  onChange={(d) => {
                    setToDraft(d);
                    if (customError) setCustomError(null);
                  }}
                />
              </View>
            </View>
            {customError ? (
              <AppText variant="caption" color="danger">
                {customError}
              </AppText>
            ) : null}
            <Button
              testID="insights-custom-apply-btn"
              title={t('common.done')}
              onPress={handleApplyCustom}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

export default function InsightsTab() {
  return <InsightsContent />;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  periodDropdown: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compBarWrap: {
    gap: 4,
  },
  compLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  compFill: {
    height: 8,
    borderRadius: 999,
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
    minHeight: 34,
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
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
});
