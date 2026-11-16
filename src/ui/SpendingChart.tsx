import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { DailySeriesPoint, MonthlySeriesPoint, WeeklySeriesPoint } from '@/domain/calc';
import {
  diffDays,
  formatShortDate,
  formatShortMonthYear,
  parseLocalDate,
} from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { CurrencyCode, LocalDate } from '@/domain/types';
import { getLocale, t } from '@/i18n';
import { localizeDisplayText } from '@/i18n/displayText';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Money } from './Money';
import { SegmentedControl } from './SegmentedControl';
import { Surface } from './Surface';

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

export interface SpendingChartProps {
  currency: CurrencyCode;
  daily: DailySeriesPoint[];
  weekly: WeeklySeriesPoint[];
  monthly: MonthlySeriesPoint[];
  today?: LocalDate;
  dailyBudgetLimitMinor?: number | null;
  granularity?: ChartGranularity;
  onGranularityChange?: (next: ChartGranularity) => void;
  showHeader?: boolean;
}

interface ChartBarItem {
  key: string;
  label: string;
  axisLabel: string;
  spentMinor: number;
  incomeMinor?: number;
  isCurrent: boolean;
}

const CHART_HEIGHT = 148;
const TOP_PAD = 10;
const BOTTOM_PAD = 24;
const PLOT_HEIGHT = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;
const MAX_AXIS_LABELS = 5;
const MIN_TICK_GAP_DAYS = 3;

/**
 * Picks up to 5 readable daily x-axis tick labels, never placing two labels
 * closer than 3 calendar days apart and marking `today` as "Today" (last label
 * when `today` is present in the series).
 */
export function pickDailyAxisLabels(
  days: readonly LocalDate[],
  today?: LocalDate
): string[] {
  const n = days.length;
  if (n === 0) return [];

  const labels = new Array<string>(n).fill('');
  const todayIdx = today ? days.indexOf(today) : -1;
  const endIdx = todayIdx >= 0 ? todayIdx : n - 1;

  if (endIdx === 0) {
    labels[0] = todayIdx === 0 ? t('common.today') : formatShortDate(days[0]);
    return labels;
  }

  const spanDays = diffDays(days[endIdx], days[0]);
  const chosen: number[] = [];

  if (spanDays >= 16) {
    chosen.push(
      0,
      Math.round(endIdx * 0.25),
      Math.round(endIdx * 0.5),
      Math.round(endIdx * 0.75),
      endIdx
    );
  } else if (spanDays >= 10) {
    chosen.push(0, Math.round(endIdx / 3), Math.round((endIdx * 2) / 3), endIdx);
  } else if (spanDays >= 6) {
    chosen.push(0, Math.round(endIdx / 2), endIdx);
  } else if (spanDays >= MIN_TICK_GAP_DAYS) {
    chosen.push(0, endIdx);
  } else {
    chosen.push(endIdx);
  }

  // Enforce >= 3 calendar days between every adjacent selected index, always keeping endIdx
  const validReverse: number[] = [endIdx];
  for (let i = chosen.length - 2; i >= 0; i--) {
    const candidate = chosen[i];
    if (candidate >= validReverse[validReverse.length - 1]) continue;
    const prevKept = validReverse[validReverse.length - 1];
    if (diffDays(days[prevKept], days[candidate]) >= MIN_TICK_GAP_DAYS) {
      validReverse.push(candidate);
    }
  }
  const finalIndices = validReverse.reverse().slice(0, MAX_AXIS_LABELS);

  let prevMonth: number | null = null;
  for (const idx of finalIndices) {
    const d = days[idx];
    const { month, day } = parseLocalDate(d);
    if (todayIdx >= 0 && idx === todayIdx) {
      labels[idx] = t('common.today');
    } else if (idx === 0 || (prevMonth !== null && month !== prevMonth)) {
      labels[idx] = formatShortDate(d);
    } else if (idx === endIdx) {
      labels[idx] = formatShortDate(d);
    } else {
      labels[idx] = String(day);
    }
    prevMonth = month;
  }

  return labels;
}

export function SpendingChart({
  currency,
  daily,
  weekly,
  monthly,
  today,
  dailyBudgetLimitMinor = null,
  granularity: controlledGranularity,
  onGranularityChange,
  showHeader = true,
}: SpendingChartProps) {
  const { theme } = useTheme();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const [internalGranularity, setInternalGranularity] = useState<ChartGranularity>('daily');
  const granularity = controlledGranularity ?? internalGranularity;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState(280);

  const setGranularity = (next: ChartGranularity) => {
    setSelectedIndex(null);
    if (onGranularityChange) {
      onGranularityChange(next);
    } else {
      setInternalGranularity(next);
    }
  };

  const visibleDaily = useMemo(() => {
    if (!today) return daily;
    const todayIdx = daily.findIndex((pt) => pt.day === today);
    if (todayIdx < 0) return daily;
    let lastNonZeroIdx = -1;
    for (let i = daily.length - 1; i >= 0; i--) {
      if (daily[i].spentMinor > 0) {
        lastNonZeroIdx = i;
        break;
      }
    }
    const endIdx = Math.max(todayIdx, lastNonZeroIdx);
    return daily.slice(0, endIdx + 1);
  }, [daily, today]);

  const bars = useMemo<ChartBarItem[]>(() => {
    if (granularity === 'daily') {
      const axisLabels = pickDailyAxisLabels(
        visibleDaily.map((d) => d.day),
        today
      );
      return visibleDaily.map((pt, idx) => ({
        key: pt.day,
        label: pt.day === today ? t('common.today') : formatShortDate(pt.day),
        axisLabel: axisLabels[idx] ?? '',
        spentMinor: pt.spentMinor,
        isCurrent: today ? pt.day === today : idx === visibleDaily.length - 1,
      }));
    }
    if (granularity === 'weekly') {
      return weekly.map((pt, idx) => ({
        key: pt.start,
        label: `${formatShortDate(pt.start)} – ${formatShortDate(pt.endExcl)}`,
        axisLabel: t('overview.chartWeekLabel', { week: pt.weekIndex }),
        spentMinor: pt.spentMinor,
        isCurrent: idx === weekly.length - 1,
      }));
    }
    return monthly.map((pt, idx) => {
      const monthLabel = formatShortMonthYear(pt.period.start);
      return {
        key: pt.period.start,
        label: monthLabel,
        axisLabel: monthLabel.split(' ')[0],
        spentMinor: pt.spentMinor,
        incomeMinor: pt.incomeMinor,
        isCurrent: idx === monthly.length - 1,
      };
    });
  }, [granularity, visibleDaily, weekly, monthly, today]);

  const maxMinor = useMemo(() => {
    let max = 0;
    for (const b of bars) {
      if (b.spentMinor > max) max = b.spentMinor;
      if ((b.incomeMinor ?? 0) > max) max = b.incomeMinor ?? 0;
    }
    return max;
  }, [bars]);

  const referenceInfo = useMemo(() => {
    if (granularity === 'monthly') return null;
    if (granularity === 'daily' && dailyBudgetLimitMinor && dailyBudgetLimitMinor > 0) {
      return {
        valueMinor: dailyBudgetLimitMinor,
        label: t('overview.chartLimitLabel'),
      };
    }
    const nonZero = bars.filter((b) => b.spentMinor > 0);
    if (nonZero.length === 0) return null;
    const avg = Math.round(nonZero.reduce((s, b) => s + b.spentMinor, 0) / nonZero.length);
    return avg > 0 ? { valueMinor: avg, label: t('overview.chartAvgLabel') } : null;
  }, [granularity, dailyBudgetLimitMinor, bars]);

  const scaleMaxMinor = useMemo(() => {
    if (!referenceInfo || maxMinor === 0) return maxMinor;
    return Math.max(maxMinor, Math.round(referenceInfo.valueMinor * 1.15));
  }, [maxMinor, referenceInfo]);

  const stats = useMemo(() => {
    const total = bars.reduce((acc, b) => acc + b.spentMinor, 0);
    let peak: ChartBarItem | null = null;
    for (const b of bars) {
      if (b.spentMinor > 0 && (peak === null || b.spentMinor > peak.spentMinor)) peak = b;
    }
    const counted = bars.length > 0 ? bars.length : 1;
    return { total, avg: Math.round(total / counted), peak };
  }, [bars]);

  const activeBar =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < bars.length
      ? bars[selectedIndex]
      : null;

  const chartSummaryLabel = useMemo(() => {
    const totalMinor = bars.reduce((acc, b) => acc + b.spentMinor, 0);
    if (totalMinor === 0) {
      return t('overview.chartNoData');
    }
    let peak = bars[0];
    for (const b of bars) {
      if (b.spentMinor > peak.spentMinor) peak = b;
    }
    return t('overview.chartA11ySummary', {
      mode: granularity,
      count: bars.length,
      total: formatMoney(totalMinor, currency, { hidden: hideAmounts, showPoisha }),
      peakLabel: peak.label,
      peakAmount: formatMoney(peak.spentMinor, currency, { hidden: hideAmounts, showPoisha }),
    });
  }, [bars, currency, granularity, hideAmounts, showPoisha]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 40 && w !== plotWidth) {
      setPlotWidth(w);
    }
  };

  const count = Math.max(1, bars.length);
  const slotWidth = plotWidth / count;
  const gapRatio = count > 14 ? 0.34 : 0.4;
  const barWidth = Math.min(12, Math.max(3, Math.floor(slotWidth * (1 - gapRatio))));

  return (
    <Surface style={{ gap: theme.spacing.sm }}>
      {showHeader ? (
        <View style={styles.headerRow}>
          <AppText variant="headline">{t('overview.spendingTitle')}</AppText>
          <SegmentedControl<ChartGranularity>
            size="sm"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'daily', label: t('overview.chartDaily') },
              { value: 'weekly', label: t('overview.chartWeekly') },
              { value: 'monthly', label: t('overview.chartMonthly') },
            ]}
          />
        </View>
      ) : null}

      {stats.total > 0 ? (
        <View style={[styles.statRow, { gap: theme.spacing.sm }]}>
          {[
            { key: 'total', label: t('overview.chartTotal'), minor: stats.total, sub: null as string | null },
            {
              key: 'avg',
              label: t(
                granularity === 'daily'
                  ? 'overview.chartAvgDay'
                  : granularity === 'weekly'
                    ? 'overview.chartAvgWeek'
                    : 'overview.chartAvgMonth'
              ),
              minor: stats.avg,
              sub: null as string | null,
            },
            {
              key: 'peak',
              label: t('overview.chartPeak'),
              minor: stats.peak?.spentMinor ?? 0,
              sub: stats.peak?.label ?? null,
            },
          ].map((tile) => (
            <View
              key={tile.key}
              style={[
                styles.statTile,
                { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.md },
              ]}
            >
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {tile.label}
              </AppText>
              <Money
                amountMinor={tile.minor}
                currency={currency}
                variant="bodyStrong"
                numberOfLines={1}
                hidden={hideAmounts}
                animate={false}
              />
              {tile.sub ? (
                <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                  {localizeDisplayText(tile.sub, getLocale())}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {activeBar ? (
        <View
          style={[
            styles.tooltipBar,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderRadius: theme.radius.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs + 2,
            },
          ]}
        >
          <View style={styles.tooltipRow}>
            <AppText variant="label" color="textSecondary">
              {activeBar.label}
            </AppText>
            <AppText variant="bodyStrong" color="accent" tabularNums>
              {granularity === 'monthly' && activeBar.incomeMinor !== undefined
                ? `${t('overview.chartInLabel')}: ${formatMoney(activeBar.incomeMinor, currency, { hidden: hideAmounts, showPoisha })} · ${t('overview.chartOutLabel')}: ${formatMoney(activeBar.spentMinor, currency, { hidden: hideAmounts, showPoisha })}`
                : formatMoney(activeBar.spentMinor, currency, {
                    hidden: hideAmounts,
                    showPoisha,
                  })}
            </AppText>
          </View>
        </View>
      ) : maxMinor === 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('overview.chartNoData')}
        </AppText>
      ) : granularity === 'monthly' ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.income }]} />
            <AppText variant="caption" color="textSecondary">
              {t('overview.chartInLabel')}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.expense }]} />
            <AppText variant="caption" color="textSecondary">
              {t('overview.chartOutLabel')}
            </AppText>
          </View>
        </View>
      ) : null}

      <View onLayout={handleLayout} style={styles.svgContainer}>
        <Svg
          width={plotWidth}
          height={CHART_HEIGHT}
          accessibilityRole="image"
          accessibilityLabel={chartSummaryLabel}
        >
          {[0.5, 1].map((level) => (
            <Line
              key={`grid-${level}`}
              x1={0}
              y1={TOP_PAD + PLOT_HEIGHT * (1 - level)}
              x2={plotWidth}
              y2={TOP_PAD + PLOT_HEIGHT * (1 - level)}
              stroke={theme.colors.separator}
              strokeOpacity={0.55}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}
          <Line
            x1={0}
            y1={TOP_PAD + PLOT_HEIGHT}
            x2={plotWidth}
            y2={TOP_PAD + PLOT_HEIGHT}
            stroke={theme.colors.separator}
            strokeWidth={1}
          />
          {scaleMaxMinor > 0 ? (
            <SvgText
              x={0}
              y={TOP_PAD - 2}
              fontSize={10}
              fill={theme.colors.textTertiary}
              textAnchor="start"
            >
              {hideAmounts ? '' : formatMoney(scaleMaxMinor, currency, { showPoisha: false })}
            </SvgText>
          ) : null}
          {referenceInfo && scaleMaxMinor > 0 ? (() => {
            const refH = Math.pow(Math.min(1, referenceInfo.valueMinor / scaleMaxMinor), 0.65) * PLOT_HEIGHT;
            const refY = TOP_PAD + PLOT_HEIGHT - Math.min(PLOT_HEIGHT - 6, Math.max(4, refH));
            return (
              <>
                <Line
                  x1={0}
                  y1={refY}
                  x2={plotWidth}
                  y2={refY}
                  stroke={theme.colors.accent}
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={plotWidth}
                  y={Math.max(11, refY - 3)}
                  fontSize={10}
                  fill={theme.colors.accent}
                  textAnchor="end"
                >
                  {localizeDisplayText(referenceInfo.label, getLocale())}
                </SvgText>
              </>
            );
          })() : null}
          {bars.map((bar, idx) => {
            const xCenter = idx * slotWidth + slotWidth / 2;
            const x = xCenter - barWidth / 2;
            const hasSpend = bar.spentMinor > 0;
            const hasIncome = granularity === 'monthly' && (bar.incomeMinor ?? 0) > 0;
            // Gentle curve so one large day does not flatten every other bar; tap a bar for exact amounts.
            const rawH = scaleMaxMinor > 0 ? Math.pow(bar.spentMinor / scaleMaxMinor, 0.65) * PLOT_HEIGHT : 0;
            const barH = hasSpend ? Math.max(5, rawH) : 0;
            const y = TOP_PAD + PLOT_HEIGHT - barH;
            const isSelected = selectedIndex === idx;
            const overDailyLimit =
              granularity === 'daily' &&
              dailyBudgetLimitMinor !== null &&
              dailyBudgetLimitMinor > 0 &&
              bar.spentMinor > dailyBudgetLimitMinor;
            const fill = overDailyLimit
              ? theme.colors.warning
              : theme.colors.accent;
            const fillOpacity =
              selectedIndex !== null
                ? isSelected
                  ? 1
                  : 0.25
                : bar.isCurrent || overDailyLimit
                  ? 1
                  : 0.5;

            const pairedWidth = Math.max(4, Math.min(10, Math.floor(slotWidth * 0.34)));
            const incH =
              hasIncome && scaleMaxMinor > 0
                ? Math.max(5, Math.pow((bar.incomeMinor ?? 0) / scaleMaxMinor, 0.65) * PLOT_HEIGHT)
                : 0;

            return (
              <React.Fragment key={bar.key}>
                {granularity === 'monthly' ? (
                  hasIncome || hasSpend ? (
                    <>
                      {hasIncome ? (
                        <Rect
                          x={xCenter - pairedWidth - 1.5}
                          y={TOP_PAD + PLOT_HEIGHT - incH}
                          width={pairedWidth}
                          height={incH}
                          rx={pairedWidth / 2}
                          fill={theme.colors.income}
                          fillOpacity={selectedIndex !== null ? (isSelected ? 1 : 0.3) : 0.85}
                        />
                      ) : null}
                      {hasSpend ? (
                        <Rect
                          x={xCenter + 1.5}
                          y={y}
                          width={pairedWidth}
                          height={barH}
                          rx={pairedWidth / 2}
                          fill={theme.colors.expense}
                          fillOpacity={selectedIndex !== null ? (isSelected ? 1 : 0.3) : 0.85}
                        />
                      ) : null}
                    </>
                  ) : (
                    <Rect
                      x={xCenter - Math.min(barWidth, 6) / 2}
                      y={TOP_PAD + PLOT_HEIGHT - Math.min(barWidth, 6)}
                      width={Math.min(barWidth, 6)}
                      height={Math.min(barWidth, 6)}
                      rx={Math.min(barWidth, 6) / 2}
                      fill={theme.colors.separator}
                    />
                  )
                ) : hasSpend ? (
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={barWidth / 2}
                    fill={fill}
                    fillOpacity={fillOpacity}
                  />
                ) : (
                  <Rect
                    x={xCenter - Math.min(barWidth, 6) / 2}
                    y={TOP_PAD + PLOT_HEIGHT - Math.min(barWidth, 6)}
                    width={Math.min(barWidth, 6)}
                    height={Math.min(barWidth, 6)}
                    rx={Math.min(barWidth, 6) / 2}
                    fill={theme.colors.separator}
                  />
                )}
                {bar.axisLabel ? (
                  <SvgText
                    x={
                      bars.length === 1
                        ? xCenter
                        : idx === 0
                          ? 0
                          : idx === bars.length - 1
                            ? plotWidth
                            : xCenter
                    }
                    y={CHART_HEIGHT - 6}
                    fontSize={11}
                    fill={
                      bar.isCurrent
                        ? theme.colors.text
                        : theme.colors.textSecondary
                    }
                    fontWeight={bar.isCurrent ? '600' : '400'}
                    textAnchor={
                      bars.length === 1
                        ? 'middle'
                        : idx === 0
                          ? 'start'
                          : idx === bars.length - 1
                            ? 'end'
                            : 'middle'
                    }
                  >
                    {localizeDisplayText(bar.axisLabel, getLocale())}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Accessible tap targets overlay across bars */}
        <View style={styles.hitOverlay}>
          {bars.map((bar, idx) => (
            <Pressable
              key={bar.key}
              accessibilityRole="button"
              accessibilityLabel={`${bar.label}: ${formatMoney(bar.spentMinor, currency)}`}
              onPress={() => setSelectedIndex(idx === selectedIndex ? null : idx)}
              style={styles.hitSlice}
            />
          ))}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tooltipBar: {
    minHeight: 32,
    justifyContent: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRow: { flexDirection: 'row' },
  statTile: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
