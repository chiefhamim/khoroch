import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
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
      reducedMotion ? target : withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) })
    );
  }, [showA, reducedMotion, progress]);

  const styleA = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * -6 }],
  }));
  const styleB = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateY: progress.get() * 6 }],
  }));

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
