import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
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
/** True when the hero fill is light, so rims and orbs must be dark tints instead of white ones. */
function isLightFill(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

export function HeroCard({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: HeroCardProps) {
  const { theme, reducedMotion } = useTheme();

  const light = isLightFill(theme.colors.hero);
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    theme.elevation.e2,
    {
      backgroundColor: theme.colors.hero,
      borderRadius: theme.radius.heroCard,
      borderWidth: 1,
      borderColor: light ? theme.colors.cardBorder : theme.colors.cardBorder,
      padding: theme.spacing.xl,
    },
    style,
  ];

  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
  };
  // One global card style in light and dark. The chosen accent only adds a soft, blurred tint.
  const hue = theme.accent === 'graphite' ? '#94A3B8' : theme.accentDef.dark.accent;
  const { w, h } = box;
  const glassOverlays =
    w === 0 ? null : (
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        <Defs>
          <RadialGradient id="hc-a" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={hue} stopOpacity={light ? 0.34 : 0.3} />
            <Stop offset="100%" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hc-b" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={hue} stopOpacity={light ? 0.2 : 0.16} />
            <Stop offset="100%" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w * 0.94} cy={h * 0.04} rx={w * 0.62} ry={h * 0.95} fill="url(#hc-a)" />
        <Ellipse cx={w * 0.02} cy={h * 1.06} rx={w * 0.55} ry={h * 0.8} fill="url(#hc-b)" />
      </Svg>
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
        onLayout={onLayout}
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
    <View testID={testID} style={cardStyle} onLayout={onLayout}>
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
