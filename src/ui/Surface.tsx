import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';

export type SurfaceVariant = 'card' | 'raised' | 'sunken' | 'soft' | 'dangerSoft';

export interface SurfaceProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
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

  const isElevated = variant === 'card' || variant === 'raised';
  const borderColor = isElevated ? theme.colors.cardBorder : 'transparent';
  const resolvedPadding = padding ?? (padded ? theme.geometry.cardPadding : 0);
  const resolvedRadius = radiusOverride ?? theme.radius.card;

  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      backgroundColor,
      borderColor,
      borderWidth: isElevated ? 1 : 0,
      borderRadius: resolvedRadius,
      padding: resolvedPadding,
    },
    style,
  ];

  if (onPress) {
    return (
      <PressableScale pressScale={0.985}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          surfaceStyle,
          { opacity: pressed && !reducedMotion ? 0.88 : 1 },
        ]}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={surfaceStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
