import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { DailySeriesPoint, MonthlySeriesPoint, WeeklySeriesPoint } from '@/domain/calc';
import { formatShortDate, formatShortMonthYear, parseLocalDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Card } from './Card';
import { SegmentedControl } from './SegmentedControl';

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

export interface SpendingChartProps {
  currency: CurrencyCode;
  daily: DailySeriesPoint[];
  weekly: WeeklySeriesPoint[];
  monthly: MonthlySeriesPoint[];
}

interface ChartBarItem {
  key: string;
  label: string;
  axisLabel: string;
  spentMinor: number;
}

const CHART_HEIGHT = 156;
const TOP_PAD = 12;
const BOTTOM_PAD = 24;
const PLOT_HEIGHT = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD;

export function SpendingChart({ currency, daily, weekly, monthly }: SpendingChartProps) {
  const { theme } = useTheme();
  const [granularity, setGranularity] = useState<ChartGranularity>('daily');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState(280);

  const bars = useMemo<ChartBarItem[]>(() => {
    if (granularity === 'daily') {
      const step = daily.length > 20 ? 7 : 5;
      return daily.map((pt, idx) => {
        const { day } = parseLocalDate(pt.day);
        const showAxis = idx === 0 || idx === daily.length - 1 || idx % step === 0;
        return {
          key: pt.day,
          label: formatShortDate(pt.day),
          axisLabel: showAxis ? String(day) : '',
          spentMinor: pt.spentMinor,
        };
      });
    }
    if (granularity === 'weekly') {
      return weekly.map((pt) => ({
        key: pt.start,
        label: `${formatShortDate(pt.start)} – ${formatShortDate(pt.endExcl)}`,
        axisLabel: t('overview.chartWeekLabel', { week: pt.weekIndex }),
        spentMinor: pt.spentMinor,
      }));
    }
    return monthly.map((pt) => {
      const monthLabel = formatShortMonthYear(pt.period.start);
      return {
        key: pt.period.start,
        label: monthLabel,
        axisLabel: monthLabel.split(' ')[0],
        spentMinor: pt.spentMinor,
      };
    });
  }, [granularity, daily, weekly, monthly]);

  const maxMinor = useMemo(() => {
    let max = 0;
    for (const b of bars) {
      if (b.spentMinor > max) max = b.spentMinor;
    }
    return max;
  }, [bars]);

  const activeBar =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < bars.length
      ? bars[selectedIndex]
      : null;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 40 && w !== plotWidth) {
      setPlotWidth(w);
    }
  };

  const count = Math.max(1, bars.length);
  const slotWidth = plotWidth / count;
  const gapRatio = count > 14 ? 0.32 : 0.42;
  const barWidth = Math.max(3, Math.floor(slotWidth * (1 - gapRatio)));

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={styles.headerRow}>
        <AppText variant="heading">{t('overview.chartTitle')}</AppText>
        <View style={styles.switcherWrap}>
          <SegmentedControl<ChartGranularity>
            value={granularity}
            onChange={(next) => {
              setGranularity(next);
              setSelectedIndex(null);
            }}
            options={[
              { value: 'daily', label: t('overview.chartDaily') },
              { value: 'weekly', label: t('overview.chartWeekly') },
              { value: 'monthly', label: t('overview.chartMonthly') },
            ]}
          />
        </View>
      </View>

      <View
        style={[
          styles.tooltipBar,
          {
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        {activeBar ? (
          <View style={styles.tooltipRow}>
            <AppText variant="label" color="textMuted">
              {activeBar.label}
            </AppText>
            <AppText variant="heading" color="primary" tabularNums>
              {formatMoney(activeBar.spentMinor, currency)}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="textMuted">
            {maxMinor > 0 ? t('overview.chartHint') : t('overview.chartNoData')}
          </AppText>
        )}
      </View>

      <View onLayout={handleLayout} style={styles.svgContainer}>
        <Svg width={plotWidth} height={CHART_HEIGHT}>
          <Line
            x1={0}
            y1={TOP_PAD + PLOT_HEIGHT}
            x2={plotWidth}
            y2={TOP_PAD + PLOT_HEIGHT}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
          {bars.map((bar, idx) => {
            const xCenter = idx * slotWidth + slotWidth / 2;
            const x = xCenter - barWidth / 2;
            const rawH = maxMinor > 0 ? (bar.spentMinor / maxMinor) * PLOT_HEIGHT : 0;
            const barH = bar.spentMinor > 0 ? Math.max(4, rawH) : 2;
            const y = TOP_PAD + PLOT_HEIGHT - barH;
            const isSelected = selectedIndex === idx;
            const fill =
              bar.spentMinor === 0
                ? theme.colors.border
                : isSelected
                  ? theme.colors.primary
                  : theme.colors.primary;
            const fillOpacity =
              bar.spentMinor === 0
                ? 0.65
                : selectedIndex === null || isSelected
                  ? 1
                  : 0.45;

            return (
              <React.Fragment key={bar.key}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={Math.min(4, barWidth / 2)}
                  fill={fill}
                  fillOpacity={fillOpacity}
                />
                {bar.axisLabel ? (
                  <SvgText
                    x={xCenter}
                    y={CHART_HEIGHT - 6}
                    fontSize={10}
                    fill={theme.colors.textMuted}
                    textAnchor="middle"
                  >
                    {bar.axisLabel}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    gap: 8,
  },
  switcherWrap: {
    width: '100%',
  },
  tooltipBar: {
    minHeight: 38,
    justifyContent: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
