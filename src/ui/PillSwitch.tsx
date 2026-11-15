import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';

export interface PillSwitchProps {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  /** Accepted for drop-in Switch compatibility; uses theme palette colors when omitted. */
  trackColor?: { false?: string; true?: string };
  /** Accepted for drop-in Switch compatibility. */
  thumbColor?: string;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const THUMB_TRAVEL = 22;
const SPRING_CONFIG = { damping: 22, stiffness: 280, mass: 0.7 } as const;

/**
 * Full-capsule pill toggle whose rounded track encloses a floating thumb knob.
 */
export function PillSwitch({
  value,
  onValueChange,
  disabled = false,
  testID,
  accessibilityLabel,
  trackColor,
  thumbColor = '#FFFFFF',
}: PillSwitchProps) {
  const { theme, reducedMotion } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  const offTrack = trackColor?.false ?? theme.colors.surfaceSunken;
  const onTrack = trackColor?.true ?? theme.colors.accent;
  const offBorder = theme.colors.cardBorder;

  useEffect(() => {
    if (reducedMotion) {
      progress.set(value ? 1 : 0);
    } else {
      progress.set(withSpring(value ? 1 : 0, SPRING_CONFIG));
    }
  }, [value, reducedMotion, progress]);

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offTrack, onTrack]),
    borderColor: interpolateColor(progress.get(), [0, 1], [offBorder, onTrack]),
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
  }));

  const handleToggle = () => {
    if (disabled) return;
    onValueChange?.(!value);
  };

  const handleDirectValueChange = (next: boolean) => {
    if (disabled) return;
    onValueChange?.(Boolean(next));
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={6}
      disabled={disabled}
      onPress={handleToggle}
      // @ts-expect-error Preserves `fireEvent(el, 'valueChange', next)` compatibility in tests.
      onValueChange={handleDirectValueChange}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: value ? onTrack : offTrack,
            borderColor: value ? onTrack : offBorder,
          },
          trackAnimatedStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: thumbColor },
            thumbAnimatedStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 999,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28), 0 1px 1px rgba(0, 0, 0, 0.16)',
  },
});
