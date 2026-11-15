import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';

export interface HeroSwapProps {
  /** true shows `a`, false shows `b`. */
  showA: boolean;
  a: React.ReactNode;
  b: React.ReactNode;
  gap?: number;
}

/**
 * Cross-fades two hero bodies inside a container that is always as tall as the taller one,
 * so switching modes never resizes the card or shifts what sits below it.
 */
export function HeroSwap({ showA, a, b, gap = 0 }: HeroSwapProps) {
  const { reducedMotion } = useTheme();
  const [heightA, setHeightA] = useState(0);
  const [heightB, setHeightB] = useState(0);
  const progress = useSharedValue(showA ? 1 : 0);

  useEffect(() => {
    const target = showA ? 1 : 0;
    progress.set(
      reducedMotion ? target : withTiming(target, { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );
  }, [showA, reducedMotion, progress]);

  // A soft directional glide: the outgoing body drifts away and fades first, the incoming one
  // settles in from the opposite side. Reversing the switch reverses the direction.
  const styleA = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0.3, 0.9], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: (1 - p) * 26 }, { scale: 0.985 + 0.015 * p }],
    };
  });
  const styleB = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0.1, 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: -p * 26 }, { scale: 1 - 0.015 * p }],
    };
  });

  const measured = heightA > 0 && heightB > 0;

  return (
    <View style={measured ? { height: Math.max(heightA, heightB) } : undefined}>
      <Animated.View
        pointerEvents={showA ? 'auto' : 'none'}
        accessibilityElementsHidden={!showA}
        importantForAccessibility={showA ? 'auto' : 'no-hide-descendants'}
        onLayout={(e) => setHeightA(Math.round(e.nativeEvent.layout.height))}
        style={[measured || !showA ? styles.layer : null, { gap }, styleA]}
      >
        {a}
      </Animated.View>
      <Animated.View
        pointerEvents={showA ? 'none' : 'auto'}
        accessibilityElementsHidden={showA}
        importantForAccessibility={showA ? 'no-hide-descendants' : 'auto'}
        onLayout={(e) => setHeightB(Math.round(e.nativeEvent.layout.height))}
        style={[measured || showA ? styles.layer : null, { gap }, styleB]}
      >
        {b}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
