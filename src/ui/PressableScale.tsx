import React, { useCallback, useState } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press-in spring: quick, critically damped, no wobble. */
const PRESS_IN = { damping: 26, stiffness: 520, mass: 0.6 } as const;
/** Release spring: a touch softer so the element settles back. */
const PRESS_OUT = { damping: 18, stiffness: 340, mass: 0.6 } as const;

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Scale while pressed. Buttons ~0.97, rows ~0.985, small icon buttons ~0.9. */
  pressScale?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}

/**
 * Drop-in replacement for `Pressable` that scales on the UI thread while pressed.
 * Accepts the same props, including the `({ pressed }) => style` form, so existing
 * call sites only change the component name. Honours reduced motion.
 */
export function PressableScale({
  pressScale = 0.97,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const { reducedMotion } = useTheme();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      if (!reducedMotion) scale.set(withSpring(pressScale, PRESS_IN));
      onPressIn?.(e);
    },
    [onPressIn, pressScale, reducedMotion, scale]
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(false);
      scale.set(withSpring(1, PRESS_OUT));
      onPressOut?.(e);
    },
    [onPressOut, scale]
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false }) : style;

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[resolved, animatedStyle]}
    />
  );
}
