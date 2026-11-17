import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/** Glow strength per scheme: calm and low contrast, a touch quieter on dark and black grounds. */
const GLOW_OPACITY = { light: 0.18, dark: 0.12 } as const;
/** The second, softer wash uses accentSoft so the two layers stay in one hue family. */
const SOFT_OPACITY = { light: 0.9, dark: 0.7 } as const;

/** Static single-accent wash behind every onboarding page: accent glow top-right, accentSoft bottom-left. */
export function OnboardingBackdrop({ intensity = 1 }: { intensity?: number }) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const scheme = theme.scheme;
  const glow = GLOW_OPACITY[scheme] * intensity;
  const soft = SOFT_OPACITY[scheme] * intensity;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="accentGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.colors.accent} stopOpacity={glow} />
            <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="softWash" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.colors.accentSoft} stopOpacity={soft} />
            <Stop offset="100%" stopColor={theme.colors.accentSoft} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={width * 0.1} cy={height * 0.78} r={width * 0.9} fill="url(#softWash)" />
        <Circle cx={width * 0.95} cy={height * 0.04} r={width * 0.8} fill="url(#accentGlow)" />
      </Svg>
    </View>
  );
}
