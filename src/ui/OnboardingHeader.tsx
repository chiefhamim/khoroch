import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { t, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

const CHAPTER_KEYS: readonly TranslationKey[] = [
  'onboarding.chap1',
  'onboarding.chap2',
  'onboarding.chap3',
  'onboarding.chap4',
  'onboarding.chap5',
  'onboarding.chap6',
  'onboarding.chap7',
];

const OVERLINE_KEYS: readonly TranslationKey[] = [
  'onboarding.overline1',
  'onboarding.overline2',
  'onboarding.overline3',
  'onboarding.overline4',
  'onboarding.overline5',
  'onboarding.overline6',
  'onboarding.overline7',
];

export interface OnboardingHeaderProps {
  step: number;
  total?: number;
  overline?: string;
  title: string;
  subtitle?: string;
}

export function OnboardingHeader({
  step,
  total = 7,
  overline,
  title,
  subtitle,
}: OnboardingHeaderProps) {
  const { theme } = useTheme();
  const resolvedOverline =
    overline ?? (step >= 1 && step <= OVERLINE_KEYS.length ? t(OVERLINE_KEYS[step - 1]) : undefined);

  return (
    <View style={{ gap: 4 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chaptersRow, { gap: 4, marginBottom: 8 }]}
      >
        {Array.from({ length: total }, (_, idx) => {
          const index = idx + 1;
          const active = index === step;
          const done = index < step;
          const chapKey = CHAPTER_KEYS[idx];
          const label = done
            ? `${index} ✓`
            : chapKey
              ? t(chapKey)
              : String(index);

          return (
            <View
              key={index}
              style={[
                styles.chapterPill,
                {
                  borderRadius: 6,
                  backgroundColor: active
                    ? theme.colors.ink
                    : done
                      ? theme.colors.accentSoft
                      : theme.colors.surfaceSunken,
                },
              ]}
            >
              <AppText
                variant="tab"
                style={[
                  styles.chapterText,
                  {
                    color: active
                      ? theme.colors.onInk
                      : done
                        ? theme.colors.accent
                        : theme.colors.textTertiary,
                  },
                ]}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </ScrollView>

      {resolvedOverline ? (
        <AppText variant="overline" color="accent" style={styles.overline}>
          {resolvedOverline}
        </AppText>
      ) : null}

      <AppText variant="title" style={styles.heroTitle}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="label" color="textSecondary" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chaptersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: 'Manrope_700Bold',
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
