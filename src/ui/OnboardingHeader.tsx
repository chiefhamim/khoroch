import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { t } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

/** One friendly glyph per step: welcome, basics, plan, categories, habit, wallets, ready. */
const STEP_ICONS: readonly AppIconName[] = [
  'sparkles',
  'sliders-horizontal',
  'target',
  'tag',
  'bell',
  'wallet',
  'circle-check',
];

/** Each step has its own colour pair: [light, deep]. */
const STEP_COLORS: readonly (readonly [string, string])[] = [
  ['#818CF8', '#4338CA'],
  ['#38BDF8', '#0369A1'],
  ['#34D399', '#047857'],
  ['#FBBF24', '#B45309'],
  ['#F472B6', '#BE185D'],
  ['#2DD4BF', '#0F766E'],
  ['#4ADE80', '#15803D'],
];

export interface OnboardingHeaderProps {
  step: number;
  total?: number;
  /** Kept for older call sites; the new header shows progress and a glyph instead. */
  overline?: string;
  title: string;
  subtitle?: string;
}

function Segment({ filled, active, color }: { filled: boolean; active: boolean; color: string }) {
  const { theme, reducedMotion } = useTheme();
  const progress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    progress.set(
      reducedMotion
        ? filled
          ? 1
          : 0
        : withTiming(filled ? 1 : 0, { duration: 360, easing: Easing.out(Easing.cubic) })
    );
  }, [filled, reducedMotion, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View
      style={[
        styles.segment,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          opacity: active || filled ? 1 : 0.9,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.segmentFill,
          { backgroundColor: color, borderRadius: theme.radius.pill },
          fill,
        ]}
      />
    </View>
  );
}

export function OnboardingHeader({ step, total = 7, title, subtitle }: OnboardingHeaderProps) {
  const { theme, locale } = useTheme();
  const pair = STEP_COLORS[Math.min(Math.max(step, 1), STEP_COLORS.length) - 1];
  const icon = STEP_ICONS[Math.min(Math.max(step, 1), STEP_ICONS.length) - 1];
  const counter = t('onboarding.stepOf', {
    step: locale === 'bn' ? toBnDigits(String(step)) : String(step),
    total: locale === 'bn' ? toBnDigits(String(total)) : String(total),
  });

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={counter}
        accessibilityValue={{ min: 1, max: total, now: step }}
        style={{ gap: theme.spacing.sm }}
      >
        <View style={[styles.segments, { gap: 5 }]}>
          {Array.from({ length: total }, (_, idx) => (
            <Segment key={idx} filled={idx < step} active={idx === step - 1} color={STEP_COLORS[Math.min(idx, STEP_COLORS.length - 1)][1]} />
          ))}
        </View>
        <AppText variant="caption" color="textTertiary" tabularNums style={styles.counter}>
          {counter}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <View style={[styles.glyphRing, { shadowColor: pair[1], shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="gl" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={pair[0]} />
                <Stop offset="100%" stopColor={pair[1]} />
              </LinearGradient>
              <LinearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.35} />
                <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={20} fill="url(#gl)" />
            <Rect x="0" y="0" width="100%" height="100%" rx={20} fill="url(#gs)" />
          </Svg>
          <AppIcon name={icon} size={28} color="#FFFFFF" />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="display" style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
  },
  counter: {
    alignSelf: 'flex-end',
  },
  glyphRing: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
});
