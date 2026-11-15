import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { BudgetStatus } from '@/domain/types';
import { t, type TranslationKey } from '@/i18n';
import { hexToRgba } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { PressableScale } from '@/ui/PressableScale';

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
  /** Warnings open on every visit, then fold into a small icon button. Tap to open again. */
  collapsible?: boolean;
  testID?: string;
}

export function BudgetStatusBadge({
  status,
  label,
  surface = 'default',
  collapsible = false,
  testID,
}: BudgetStatusBadgeProps) {
  const { theme, reducedMotion } = useTheme();
  const cfg = STATUS_MAP[status];
  const displayLabel = label ?? t(cfg.labelKey);

  const isHero = surface === 'hero';
  const isDark = theme.scheme === 'dark';

  const fgColor = isHero
    ? isDark
      ? cfg.tone === 'danger'
        ? theme.colors.danger
        : cfg.tone === 'warning'
          ? theme.colors.warning
          : theme.colors.heroText
      : cfg.tone === 'danger'
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
    ? isDark
      ? cfg.tone === 'danger'
        ? theme.colors.dangerSoft
        : cfg.tone === 'warning'
          ? theme.colors.warningBg
          : theme.colors.heroLine
      : cfg.tone === 'danger'
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

  const canCollapse = collapsible && (cfg.tone === 'danger' || cfg.tone === 'warning');
  const [open, setOpen] = useState(true);
  const openAnim = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 2800);
  }, []);
  // Every time Home comes back into view the warning opens again, then folds away.
  useFocusEffect(
    useCallback(() => {
      if (!canCollapse) return undefined;
      setOpen(true);
      armTimer();
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }, [canCollapse, armTimer])
  );
  useEffect(() => {
    const target = !canCollapse || open ? 1 : 0;
    openAnim.set(
      reducedMotion ? target : withTiming(target, { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );
  }, [open, canCollapse, reducedMotion, openAnim]);
  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: openAnim.get() * (minTextWidth + 24),
    opacity: openAnim.get(),
    marginLeft: openAnim.get() * theme.spacing.xs,
  }));

  const Wrapper: React.ElementType = canCollapse ? PressableScale : View;
  const wrapperProps = canCollapse
    ? {
        accessibilityRole: 'button' as const,
        accessibilityHint: displayLabel,
        pressScale: 0.94,
        onPress: () => {
          setOpen((v) => !v);
          armTimer();
        },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      key={`${displayLabel}:${fgColor}`}
      testID={testID}
      accessibilityLabel={displayLabel}
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          ...(isDark && (cfg.tone === 'danger' || cfg.tone === 'warning')
            ? {
                borderWidth: 1,
                borderColor: hexToRgba(fgColor, 0.28),
              }
            : null),
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: theme.spacing.xs,
          gap: 0,
        },
        isHero && styles.heroBadge,
      ]}
    >
      <AppIcon name={cfg.icon} size={14} color={fgColor} />
      <Animated.View style={[{ overflow: 'hidden' }, labelStyle]}>
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
      </Animated.View>
    </Wrapper>
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
  heroBadge: {
    height: 34,
    alignSelf: 'center',
    paddingHorizontal: 11,
    paddingVertical: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
});
