import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/ui/PressableScale';
import { glassFill, useGlass } from './glass';
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

const INNER_STYLE_KEYS = new Set<string>([
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingHorizontal',
  'paddingVertical',
  'paddingStart',
  'paddingEnd',
  'gap',
  'rowGap',
  'columnGap',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignContent',
]);

function splitSurfaceStyle(style: StyleProp<ViewStyle>): {
  outer: ViewStyle;
  inner: ViewStyle;
} {
  if (!style) return { outer: {}, inner: {} };
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
  if (!flat) return { outer: {}, inner: {} };
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v === undefined) continue;
    if (INNER_STYLE_KEYS.has(k)) {
      inner[k] = v;
    } else {
      outer[k] = v;
    }
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
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
  const glass = useGlass();
  const g = glassFill(theme.mode);

  const backgroundColor =
    glass && (variant === 'card' || variant === 'raised')
      ? g.fill
      : glass && variant === 'sunken'
        ? g.soft
        : variant === 'sunken'
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
  const { outer: outerCustom, inner: innerCustom } = splitSurfaceStyle(style);
  const showGlassChrome = variant === 'card' || variant === 'raised';
  const defaultBorderWidth = showGlassChrome ? 1 : 0;
  const borderWidth =
    outerCustom.borderWidth !== undefined ? Number(outerCustom.borderWidth) : defaultBorderWidth;
  const defaultBorderColor = showGlassChrome
    ? glass
      ? g.rim
      : theme.colors.cardBorder
    : undefined;
  const innerRadius = Math.max(0, resolvedRadius - borderWidth);

  const outerStyle: StyleProp<ViewStyle> = [
    styles.base,
    elevationStyle,
    {
      backgroundColor,
      borderRadius: resolvedRadius,
      borderWidth: defaultBorderWidth,
      borderColor: defaultBorderColor,
    },
    outerCustom,
  ];

  const innerStyle: StyleProp<ViewStyle> = [
    styles.innerClip,
    {
      borderRadius: innerRadius,
      padding: resolvedPadding,
    },
    innerCustom,
  ];

  const wrappedChildren = (
    <View style={innerStyle}>
      {children}
    </View>
  );

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
          outerStyle,
          { opacity: pressed && !reducedMotion ? 0.92 : 1 },
        ]}
      >
        {wrappedChildren}
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
      <Animated.View testID={testID} entering={entering} layout={layout} style={outerStyle}>
        {wrappedChildren}
      </Animated.View>
    );
  }

  return (
    <View testID={testID} style={outerStyle}>
      {wrappedChildren}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  innerClip: {
    flexGrow: 1,
    overflow: 'hidden',
  },

});
