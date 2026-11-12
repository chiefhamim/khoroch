import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BudgetStatus } from '@/domain/types';
import { t, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface StatusVisual {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TranslationKey;
  tone: 'muted' | 'primary' | 'warning' | 'danger';
}

const STATUS_MAP: Record<BudgetStatus, StatusVisual> = {
  no_budget: {
    icon: 'ellipse-outline',
    labelKey: 'status.no_budget',
    tone: 'muted',
  },
  ok: {
    icon: 'checkmark-circle',
    labelKey: 'status.ok',
    tone: 'primary',
  },
  info: {
    icon: 'information-circle',
    labelKey: 'status.info',
    tone: 'primary',
  },
  attention: {
    icon: 'alert-circle',
    labelKey: 'status.attention',
    tone: 'warning',
  },
  reached: {
    icon: 'flag',
    labelKey: 'status.reached',
    tone: 'warning',
  },
  over: {
    icon: 'warning',
    labelKey: 'status.over',
    tone: 'danger',
  },
};

export interface BudgetStatusBadgeProps {
  status: BudgetStatus;
  testID?: string;
}

export function BudgetStatusBadge({ status, testID }: BudgetStatusBadgeProps) {
  const { theme } = useTheme();
  const cfg = STATUS_MAP[status];

  const fgColor =
    cfg.tone === 'danger'
      ? theme.colors.danger
      : cfg.tone === 'warning'
        ? theme.colors.warning
        : cfg.tone === 'primary'
          ? theme.colors.primary
          : theme.colors.textMuted;

  const textKey =
    cfg.tone === 'danger'
      ? 'danger'
      : cfg.tone === 'warning'
        ? 'warning'
        : cfg.tone === 'primary'
          ? 'primary'
          : 'textMuted';

  const bgColor =
    cfg.tone === 'primary' ? theme.colors.primarySoft : theme.colors.surfaceAlt;

  return (
    <View
      testID={testID}
      accessibilityLabel={t(cfg.labelKey)}
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor: cfg.tone === 'muted' ? theme.colors.border : fgColor,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <Ionicons name={cfg.icon} size={14} color={fgColor} />
      <AppText variant="caption" color={textKey}>
        {t(cfg.labelKey)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
