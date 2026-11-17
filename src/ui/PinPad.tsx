import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/security/pin';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { hapticSelection } from './haptics';
import { PressableScale } from './PressableScale';

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'BACK'],
];

/** Total shake time stays well under the 300 ms ceiling: 4 steps of 55 ms. */
const SHAKE_STEP_MS = 55;

export interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /** Show the circles in the error colour. The message text is always shown separately. */
  errored?: boolean;
  /** Increment to play one short shake of the circles (transform only, skipped in reduced motion). */
  shakeKey?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function PinPad({
  value,
  onChange,
  maxLength = PIN_MAX_LENGTH,
  disabled = false,
  errored = false,
  shakeKey = 0,
  testID,
  style,
}: PinPadProps) {
  const { theme, reducedMotion } = useTheme();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (shakeKey <= 0 || reducedMotion) return;
    const d = theme.spacing.sm;
    shake.set(
      withSequence(
        withTiming(-d, { duration: SHAKE_STEP_MS }),
        withTiming(d, { duration: SHAKE_STEP_MS }),
        withTiming(-d, { duration: SHAKE_STEP_MS }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeKey]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.get() }],
  }));

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'BACK') {
      if (value.length > 0) {
        hapticSelection();
        onChange(value.slice(0, -1));
      }
      return;
    }
    if (value.length >= maxLength) return;
    hapticSelection();
    onChange(`${value}${key}`);
  };

  const dotCount = Math.min(maxLength, Math.max(PIN_MIN_LENGTH, value.length));
  const dotSize = theme.spacing.lg;
  const activeColor = errored ? theme.colors.danger : theme.colors.accent;

  return (
    <View testID={testID} style={[{ gap: theme.spacing.xxl }, styles.center, style]}>
      <Animated.View
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('lock.dotsA11y', { count: value.length, max: maxLength })}
        style={[styles.dots, { gap: theme.spacing.lg }, shakeStyle]}
        testID={testID ? `${testID}-dots` : undefined}
      >
        {Array.from({ length: dotCount }, (_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                borderWidth: theme.spacing.xs / 2,
                borderColor: filled || errored ? activeColor : theme.colors.textSecondary,
                backgroundColor: filled ? activeColor : 'transparent',
              }}
            />
          );
        })}
      </Animated.View>

      <View style={[styles.grid, { gap: theme.spacing.sm }]}>
        {ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap: theme.spacing.sm }]}>
            {row.map((key, colIndex) => {
              const keyHeight = theme.touch.min + theme.spacing.md;
              if (key === '') {
                return <View key={`blank-${colIndex}`} style={styles.key} />;
              }
              const isBack = key === 'BACK';
              return (
                <PressableScale
                  key={key}
                  pressScale={0.92}
                  testID={testID ? `${testID}-key-${key}` : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isBack ? t('tx.padBackspace') : t('tx.padDigit', { digit: key })
                  }
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => press(key)}
                  style={[
                    styles.key,
                    {
                      height: keyHeight,
                      borderRadius: theme.radius.keypadKey,
                      backgroundColor: theme.colors.surfaceSunken,
                      opacity: disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  {isBack ? (
                    <AppIcon name="delete" size={21} color={theme.colors.textSecondary} />
                  ) : (
                    <AppText variant="title" tabularNums>
                      {key}
                    </AppText>
                  )}
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', alignSelf: 'stretch' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  grid: { alignSelf: 'stretch' },
  row: { flexDirection: 'row' },
  key: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
