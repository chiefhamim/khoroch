import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/** Soft multi-colour glow field behind screens; OLED black stays pure pitch black. */
export function OnboardingBackdrop({ intensity = 1 }: { intensity?: number }) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();

  // OLED Black mode stays pure flat #000000 with zero glow.
  if (theme.mode === 'black') {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]} />;
  }

  // Dark mode uses a subtle charcoal depth canvas with atmospheric accent aura and micro-dot texture.
  if (theme.mode === 'dark') {
    const glowColor = theme.accent === 'graphite' ? '#7B8CA8' : theme.colors.accent;
    const secondaryGlow = theme.accent === 'graphite' ? '#475569' : theme.colors.income;
    const primaryOpacity = Math.min(0.22, 0.16 * intensity);
    const secondaryOpacity = Math.min(0.14, 0.09 * intensity);

    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="dark-canvas" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#181A20" stopOpacity={1} />
              <Stop offset="48%" stopColor={theme.colors.bg} stopOpacity={1} />
              <Stop offset="100%" stopColor="#0E0F12" stopOpacity={1} />
            </LinearGradient>
            <RadialGradient id="dark-glow-1" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={glowColor} stopOpacity={primaryOpacity} />
              <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="dark-glow-2" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={secondaryGlow} stopOpacity={secondaryOpacity} />
              <Stop offset="100%" stopColor={secondaryGlow} stopOpacity={0} />
            </RadialGradient>
            <Pattern id="dark-dots" width={16} height={16} patternUnits="userSpaceOnUse">
              <Circle cx={1.5} cy={1.5} r={0.9} fill="#FFFFFF" fillOpacity={0.042} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#dark-canvas)" />
          <Circle cx={width * 0.88} cy={height * 0.06} r={width * 0.85} fill="url(#dark-glow-1)" />
          <Circle cx={width * 0.08} cy={height * 0.52} r={width * 0.72} fill="url(#dark-glow-2)" />
          <Rect x={0} y={0} width={width} height={height} fill="url(#dark-dots)" />
        </Svg>
      </View>
    );
  }

  const a = 0.3 * intensity;

  const blobs = [
    { id: 'g1', cx: width * 0.92, cy: height * 0.06, r: width * 0.85, color: '#6366F1', o: a },
    { id: 'g2', cx: width * 0.02, cy: height * 0.5, r: width * 0.8, color: '#10B981', o: a * 0.85 },
    { id: 'g3', cx: width * 0.98, cy: height * 0.86, r: width * 0.75, color: '#F59E0B', o: a * 0.8 },
    { id: 'g4', cx: width * 0.1, cy: height * 0.02, r: width * 0.55, color: '#EC4899', o: a * 0.55 },
  ];

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
            <Stop offset="100%" stopColor={theme.colors.bg} stopOpacity={0.35} />
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
