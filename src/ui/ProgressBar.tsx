import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BudgetStatus } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';

export interface ProgressBarProps {
  pct: number | null;
  status: BudgetStatus;
  height?: number;
}

export function ProgressBar({ pct, status, height }: ProgressBarProps) {
  const { theme } = useTheme();
  const barHeight = height ?? theme.spacing.sm;
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));

  const fillColor =
    status === 'over'
      ? theme.colors.danger
      : status === 'attention' || status === 'reached'
        ? theme.colors.warning
        : theme.colors.primary;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[
        styles.track,
        {
          height: barHeight,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceAlt,
        },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            height: barHeight,
            borderRadius: theme.radius.pill,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {},
});
