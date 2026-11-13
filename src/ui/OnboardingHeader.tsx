import React from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

export interface OnboardingHeaderProps {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
}

export function OnboardingHeader({
  step,
  total = 7,
  title,
  subtitle,
}: OnboardingHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={[styles.topRow, { gap: theme.spacing.md }]}>
        <View style={[styles.dotsRow, { gap: theme.spacing.xs }]}>
          {Array.from({ length: total }, (_, idx) => {
            const index = idx + 1;
            const active = index === step;
            const done = index < step;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: active ? 22 : 8,
                    height: 8,
                    borderRadius: theme.radius.pill,
                    backgroundColor:
                      active || done ? theme.colors.accent : theme.colors.surfaceSunken,
                    opacity: done ? 0.55 : 1,
                  },
                ]}
              />
            );
          })}
        </View>
        <AppText variant="caption" color="textSecondary">
          {t('onboarding.stepLabel', { step, total })}
        </AppText>
      </View>

      <AppText variant="display" style={styles.heroTitle}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {},
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
});
