import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
 * Raised hero card with `e2` depth and subtle glass rim/specular accents.
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
    theme.elevation.e2,
    {
      backgroundColor: theme.colors.hero,
      borderRadius: theme.radius.heroCard,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      padding: theme.spacing.xl,
    },
    style,
  ];

  const glassOverlays = (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.ambientOrbTopRight,
          { backgroundColor: 'rgba(255, 255, 255, 0.075)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientOrbInnerRight,
          { backgroundColor: 'rgba(255, 255, 255, 0.045)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientOrbBottomLeft,
          { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
        ]}
      />
      <View pointerEvents="none" style={styles.diagonalSheen} />
      <View pointerEvents="none" style={styles.specularTop} />
    </>
  );

  if (onPress) {
    return (
      <PressableScale
        pressScale={0.985}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          { opacity: pressed && !reducedMotion ? 0.94 : 1 },
        ]}
      >
        {glassOverlays}
        {children}
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {glassOverlays}
      {children}
    </View>
  );
}

export interface HeroProgressBarProps {
  pct: number | null;
}

export function HeroProgressBar({ pct }: HeroProgressBarProps) {
  const { theme, reducedMotion } = useTheme();
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const widthPct = useSharedValue(clamped);

  useEffect(() => {
    if (reducedMotion) {
      widthPct.set(clamped);
    } else {
      widthPct.set(withSpring(clamped, { damping: 24, stiffness: 220, mass: 0.9 }));
    }
  }, [clamped, reducedMotion, widthPct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthPct.get()}%`,
  }));

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
      <Animated.View
        style={[
          {
            height: theme.geometry.progressBarHeight,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.heroBar,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  specularTop: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  diagonalSheen: {
    position: 'absolute',
    top: -68,
    left: -28,
    width: 220,
    height: 108,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.038)',
    transform: [{ rotate: '-14deg' }],
  },
  ambientOrbTopRight: {
    position: 'absolute',
    top: -48,
    right: -36,
    width: 150,
    height: 150,
    borderRadius: 999,
  },
  ambientOrbInnerRight: {
    position: 'absolute',
    top: -16,
    right: -12,
    width: 92,
    height: 92,
    borderRadius: 999,
  },
  ambientOrbBottomLeft: {
    position: 'absolute',
    bottom: -64,
    left: -48,
    width: 140,
    height: 140,
    borderRadius: 999,
  },
  barTrack: {
    width: '100%',
    overflow: 'hidden',
  },
});
