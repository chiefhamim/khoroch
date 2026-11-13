import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';

export interface HeroCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Solid-filled hero summary container (no gradient, no glow, no shadow per PLAN §3).
 */
export function HeroCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: HeroCardProps) {
  const { theme, reducedMotion } = useTheme();

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: theme.colors.hero,
      borderRadius: theme.radius.heroCard,
      padding: theme.spacing.xl,
    },
    style,
  ];

  if (onPress) {
    return (
      <PressableScale pressScale={0.985}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          { opacity: pressed && !reducedMotion ? 0.92 : 1 },
        ]}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

export interface HeroProgressBarProps {
  pct: number | null;
}

export function HeroProgressBar({ pct }: HeroProgressBarProps) {
  const { theme } = useTheme();
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[
        styles.barTrack,
        {
          height: theme.geometry.progressBarHeight,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.heroLine,
        },
      ]}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: theme.geometry.progressBarHeight,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.heroBar,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  barTrack: {
    width: '100%',
    overflow: 'hidden',
  },
});
