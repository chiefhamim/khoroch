import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import type { BudgetStatus } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';

export interface ProgressRingProps {
  pct: number | null;
  status?: BudgetStatus;
  tone?: 'accent' | 'warning' | 'danger' | 'neutral';
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  testID?: string;
}

export function ProgressRing({
  pct,
  status,
  tone,
  size = 196,
  strokeWidth = 14,
  children,
  testID,
}: ProgressRingProps) {
  const { theme } = useTheme();
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  const activeColor =
    tone === 'neutral'
      ? theme.colors.separator
      : tone === 'danger' || status === 'over'
        ? theme.colors.danger
        : tone === 'warning' || status === 'attention' || status === 'reached'
          ? theme.colors.warning
          : theme.colors.accent;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.colors.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 ? (
          <G transform={`rotate(-90 ${center} ${center})`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={activeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              fill="none"
            />
          </G>
        ) : null}
      </Svg>
      {children ? (
        <View
          style={[
            styles.center,
            { paddingHorizontal: Math.max(16, Math.round(strokeWidth + 6)) },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
