import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/** Soft multi-colour glow field behind every onboarding page. */
export function OnboardingBackdrop({ intensity = 1 }: { intensity?: number }) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const dark = theme.scheme === 'dark';
  const a = 0.3 * intensity;

  const blobs = [
    { id: 'g1', cx: width * 0.92, cy: height * 0.06, r: width * 0.85, color: '#6366F1', o: a },
    { id: 'g2', cx: width * 0.02, cy: height * 0.5, r: width * 0.8, color: '#10B981', o: a * 0.85 },
    { id: 'g3', cx: width * 0.98, cy: height * 0.86, r: width * 0.75, color: '#F59E0B', o: a * 0.8 },
    { id: 'g4', cx: width * 0.1, cy: height * 0.02, r: width * 0.55, color: '#EC4899', o: a * 0.55 },
  ];

  // Dark mode is flat and quiet, like a SaaS dashboard: no colour glows.
  if (dark) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]} />;
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]}>
      <Svg width={width} height={height}>
        <Defs>
          {blobs.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.color} stopOpacity={b.o} />
              <Stop offset="100%" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
          <LinearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.colors.bg} stopOpacity={0} />
            <Stop offset="100%" stopColor={theme.colors.bg} stopOpacity={dark ? 0.5 : 0.35} />
          </LinearGradient>
        </Defs>
        {blobs.map((b) => (
          <Circle key={b.id} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${b.id})`} />
        ))}
        <Rect x={0} y={0} width={width} height={height} fill="url(#veil)" />
      </Svg>
    </View>
  );
}
