import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/** Plain flat background behind every onboarding page (UI-FOUNDATION 1: no decorative glow). `intensity` is kept so callers do not change. */
export function OnboardingBackdrop(_props: { intensity?: number }) {
  const { theme } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg }]} />
  );
}
