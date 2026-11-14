import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BudgetStatus } from '@/domain/types';
import { t, type TranslationKey } from '@/i18n';
import { hexToRgba } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';

interface StatusVisual {
  icon: AppIconName;
  labelKey: TranslationKey;
  tone: 'neutral' | 'accent' | 'warning' | 'danger';
}

const STATUS_MAP: Record<BudgetStatus, StatusVisual> = {
  no_budget: {
    icon: 'minus',
    labelKey: 'status.no_budget',
    tone: 'neutral',
  },
  ok: {
    icon: 'circle-check',
    labelKey: 'status.ok',
    tone: 'accent',
  },
  info: {
    icon: 'info',
    labelKey: 'status.info',
    tone: 'accent',
  },
  attention: {
    icon: 'circle-alert',
    labelKey: 'status.attention',
    tone: 'warning',
  },
  reached: {
    icon: 'circle-alert',
    labelKey: 'status.reached',
    tone: 'warning',
  },
  over: {
    icon: 'triangle-alert',
    labelKey: 'status.over',
    tone: 'danger',
  },
};

export interface BudgetStatusBadgeProps {
  status: BudgetStatus;
  label?: string;
  surface?: 'default' | 'hero';
  testID?: string;
}

export function BudgetStatusBadge({
  status,
  label,
  surface = 'default',
  testID,
}: BudgetStatusBadgeProps) {
  const { theme } = useTheme();
  const cfg = STATUS_MAP[status];
  const displayLabel = label ?? t(cfg.labelKey);

  const isHero = surface === 'hero';

  const fgColor = isHero
    ? cfg.tone === 'danger'
      ? '#991B1B'
      : cfg.tone === 'warning'
        ? '#92400E'
        : theme.colors.heroText
    : cfg.tone === 'danger'
      ? theme.colors.danger
      : cfg.tone === 'warning'
        ? theme.colors.warning
        : cfg.tone === 'accent'
          ? theme.colors.accent
          : theme.colors.textSecondary;

  const bgColor = isHero
    ? cfg.tone === 'danger'
      ? '#FCEBEB'
      : cfg.tone === 'warning'
        ? '#FEF3C7'
        : theme.colors.heroLine
    : cfg.tone === 'danger'
      ? theme.colors.dangerSoft
      : cfg.tone === 'warning'
        ? hexToRgba(theme.colors.warning, 0.14)
        : cfg.tone === 'accent'
          ? theme.colors.accentSoft
          : theme.colors.surfaceSunken;

  const minTextWidth = estimateSingleLineMinWidth(displayLabel, 12);

  return (
    <View
      key={`${displayLabel}:${fgColor}`}
      testID={testID}
      accessibilityLabel={displayLabel}
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <AppIcon name={cfg.icon} size={14} color={fgColor} />
      <AppText
        variant="caption"
        numberOfLines={1}
        style={[
          styles.text,
          { color: fgColor, minWidth: minTextWidth, textAlign: 'center' },
          isHero && styles.heroText,
        ]}
      >
        {displayLabel}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'Manrope_600SemiBold',
  },
  heroText: {
    flexShrink: 0,
  },
});
