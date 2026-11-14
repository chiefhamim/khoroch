import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';
import { listLayoutTransition, staggerEnter } from './motion';

export type SurfaceVariant = 'card' | 'raised' | 'sunken' | 'soft' | 'dangerSoft';
export type ElevationLevel = 'none' | 'e1' | 'e2' | 'e3';

export interface SurfaceProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
  elevation?: ElevationLevel;
  enterIndex?: number;
  animateLayout?: boolean;
  padded?: boolean;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Surface({
  children,
  variant = 'card',
  elevation,
  enterIndex,
  animateLayout = false,
  padded = true,
  padding,
  radius: radiusOverride,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: SurfaceProps) {
  const { theme, reducedMotion } = useTheme();

  const backgroundColor =
    variant === 'sunken'
      ? theme.colors.surfaceSunken
      : variant === 'soft'
        ? theme.colors.accentSoft
        : variant === 'dangerSoft'
          ? theme.colors.dangerSoft
          : variant === 'raised'
            ? theme.colors.surfaceRaised
            : theme.colors.surface;

  const defaultElevation: ElevationLevel =
    variant === 'raised' ? 'e2' : variant === 'card' ? 'e1' : 'none';
  const resolvedElevation = elevation ?? defaultElevation;
  const elevationStyle = theme.elevation[resolvedElevation];

  const resolvedPadding = padding ?? (padded ? theme.geometry.cardPadding : 0);
  const resolvedRadius = radiusOverride ?? theme.radius.card;

  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.base,
    elevationStyle,
    {
      backgroundColor,
      borderRadius: resolvedRadius,
      padding: resolvedPadding,
    },
    style,
  ];

  const entering =
    enterIndex !== undefined ? staggerEnter(enterIndex, reducedMotion) : undefined;
  const layout = animateLayout ? listLayoutTransition(reducedMotion) : undefined;

  if (onPress) {
    const pressable = (
      <PressableScale
        pressScale={0.97}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          surfaceStyle,
          { opacity: pressed && !reducedMotion ? 0.92 : 1 },
        ]}
      >
        {children}
      </PressableScale>
    );
    if (entering || layout) {
      return (
        <Animated.View entering={entering} layout={layout}>
          {pressable}
        </Animated.View>
      );
    }
    return pressable;
  }

  if (entering || layout) {
    return (
      <Animated.View testID={testID} entering={entering} layout={layout} style={surfaceStyle}>
        {children}
      </Animated.View>
    );
  }

  return (
    <View testID={testID} style={surfaceStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
});
