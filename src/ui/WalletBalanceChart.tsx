import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  formatAccountBalance,
  type WalletBalancePoint,
} from '@/domain/accounts';
import { formatShortDate } from '@/domain/dates';
import { HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import type { AccountKind, CurrencyCode, LocalDate } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Surface } from './Surface';

export interface WalletBalanceChartProps {
  points: readonly WalletBalancePoint[];
  accountKind: AccountKind;
  currency: CurrencyCode;
  lineColor?: string;
  today?: LocalDate;
  hidden?: boolean;
}

const CHART_HEIGHT = 136;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_X = 8;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

export function WalletBalanceChart({
  points,
  accountKind,
  currency,
  lineColor,
  today,
  hidden = false,
}: WalletBalanceChartProps) {
  const locale = useLocale();
  const { theme } = useTheme();
  const [width, setWidth] = useState(280);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(text, fontSize) } : undefined;

  const formatPointBalance = (balanceMinor: number) => {
    if (hidden) return HIDDEN_AMOUNT_TEXT;
    if (accountKind === 'credit_card' && balanceMinor < 0) {
      return `${formatAccountBalance('other', Math.abs(balanceMinor), currency)} ${t('wallets.dueSuffix')}`;
    }
    return formatAccountBalance(accountKind, balanceMinor, currency);
  };

  const strokeColor = lineColor ?? theme.colors.accent;

  const metrics = useMemo(() => {
    if (points.length === 0) return null;
    let minVal = points[0].balanceMinor;
    let maxVal = points[0].balanceMinor;
    for (const pt of points) {
      if (pt.balanceMinor < minVal) minVal = pt.balanceMinor;
      if (pt.balanceMinor > maxVal) maxVal = pt.balanceMinor;
    }

    const rawSpan = maxVal - minVal;
    const pad = rawSpan > 0 ? Math.max(100, Math.round(rawSpan * 0.14)) : 10000;
    const low = minVal - pad;
    const high = maxVal + pad;
    const span = high - low || 1;
    const plotW = Math.max(1, width - PAD_X * 2);

    const coords = points.map((pt, idx) => {
      const x =
        points.length === 1
          ? PAD_X + plotW / 2
          : PAD_X + (idx / (points.length - 1)) * plotW;
      const ratio = (pt.balanceMinor - low) / span;
      const y = PAD_TOP + PLOT_HEIGHT * (1 - ratio);
      return { x, y, pt };
    });

    const zeroRatio = (0 - low) / span;
    const zeroY =
      minVal <= 0 && maxVal >= 0 && rawSpan > 0
        ? PAD_TOP + PLOT_HEIGHT * (1 - zeroRatio)
        : null;

    return {
      coords,
      zeroY,
      polylinePoints: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
      firstLabel: formatShortDate(points[0].date, locale),
      lastLabel:
        today && points[points.length - 1].date === today
          ? t('common.today')
          : formatShortDate(points[points.length - 1].date, locale),
    };
  }, [points, today, width, locale]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const measured = Math.floor(e.nativeEvent.layout.width);
    if (measured > 40 && measured !== width) {
      setWidth(measured);
    }
  };

  if (!metrics) return null;

  const activeIndex =
    selectedIndex !== null && selectedIndex < metrics.coords.length
      ? selectedIndex
      : metrics.coords.length - 1;
  const activeCoord = metrics.coords[activeIndex];
  const activeDateLabel =
    today && activeCoord.pt.date === today
      ? t('common.today')
      : formatShortDate(activeCoord.pt.date, locale);
  const activeFormatted = formatPointBalance(activeCoord.pt.balanceMinor);
  const activeSummary = `${activeDateLabel} · ${activeFormatted}`;

  return (
    <Surface testID="wallet-balance-chart" style={{ gap: theme.spacing.xs }}>
      <View style={styles.headerRow}>
        <AppText
          variant="label"
          color="textSecondary"
          numberOfLines={1}
          style={bnMinWidth(t('wallets.balanceHistoryTitle'), theme.typography.label.fontSize)}
        >
          {t('wallets.balanceHistoryTitle')}
        </AppText>
        <AppText
          variant="label"
          color="text"
          tabularNums
          numberOfLines={1}
          style={bnMinWidth(activeSummary, theme.typography.label.fontSize)}
        >
          {activeSummary}
        </AppText>
      </View>

      <View
        onLayout={handleLayout}
        accessible
        accessibilityLabel={`${t('wallets.balanceHistoryTitle')}: ${activeDateLabel} ${activeFormatted}`}
        style={styles.plotContainer}
      >
        <Svg width={width} height={CHART_HEIGHT}>
          {metrics.zeroY !== null ? (
            <Line
              x1={PAD_X}
              x2={width - PAD_X}
              y1={metrics.zeroY}
              y2={metrics.zeroY}
              stroke={theme.colors.separator}
              strokeWidth={1}
            />
          ) : (
            <Line
              x1={PAD_X}
              x2={width - PAD_X}
              y1={PAD_TOP + PLOT_HEIGHT}
              y2={PAD_TOP + PLOT_HEIGHT}
              stroke={theme.colors.separator}
              strokeWidth={1}
            />
          )}

          {metrics.coords.length > 1 ? (
            <Polyline
              points={metrics.polylinePoints}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          <Circle
            cx={activeCoord.x}
            cy={activeCoord.y}
            r={4.5}
            fill={strokeColor}
            stroke={theme.colors.surface}
            strokeWidth={2}
          />

          <SvgText
            x={PAD_X}
            y={CHART_HEIGHT - 6}
            fontSize={10.5}
            fill={theme.colors.textTertiary}
            textAnchor="start"
          >
            {metrics.firstLabel}
          </SvgText>
          {points.length > 1 ? (
            <SvgText
              x={width - PAD_X}
              y={CHART_HEIGHT - 6}
              fontSize={10.5}
              fill={theme.colors.textSecondary}
              textAnchor="end"
            >
              {metrics.lastLabel}
            </SvgText>
          ) : null}
        </Svg>

        <View style={[StyleSheet.absoluteFill, styles.touchOverlay]} pointerEvents="box-none">
          {metrics.coords.map((coord, idx) => (
            <Pressable
              key={coord.pt.date}
              accessibilityRole="button"
              accessibilityLabel={`${formatShortDate(coord.pt.date, locale)} ${formatPointBalance(coord.pt.balanceMinor)}`}
              onPress={() =>
                setSelectedIndex((prev) => (prev === idx ? null : idx))
              }
              style={styles.touchColumn}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  plotContainer: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  touchOverlay: {
    flexDirection: 'row',
    paddingBottom: PAD_BOTTOM,
  },
  touchColumn: {
    flex: 1,
    height: '100%',
  },
});
