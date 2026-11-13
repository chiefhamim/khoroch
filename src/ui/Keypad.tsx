import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { hapticSelection } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'BACK'],
];

export function applyKeypadKey(current: string, key: string): string {
  if (key === 'BACK') {
    return current.slice(0, -1);
  }
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  const dotIdx = current.indexOf('.');
  if (dotIdx !== -1) {
    const frac = current.slice(dotIdx + 1);
    if (frac.length >= 2) return current;
    return `${current}${key}`;
  }
  if (current === '0') {
    return key;
  }
  if (current.length >= 9) return current;
  return `${current}${key}`;
}

export interface KeypadProps {
  value: string;
  onChange: (next: string) => void;
  keyHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Keypad({ value, onChange, keyHeight = 52, style, testID }: KeypadProps) {
  const { theme, reducedMotion } = useTheme();

  const handlePress = (key: string) => {
    const next = applyKeypadKey(value, key);
    if (next !== value) {
      hapticSelection();
      onChange(next);
    }
  };

  return (
    <View testID={testID} style={[{ gap: theme.spacing.sm }, style]}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap: theme.spacing.sm }]}>
          {row.map((key) => {
            const isBack = key === 'BACK';
            const a11yLabel = isBack
              ? t('tx.padBackspace')
              : key === '.'
                ? t('tx.padDecimal')
                : t('tx.padDigit', { digit: key });

            return (
              <PressableScale pressScale={0.9}
                key={key}
                testID={testID ? `${testID}-key-${key === '.' ? 'dot' : key}` : undefined}
                accessibilityRole="button"
                accessibilityLabel={a11yLabel}
                onPress={() => handlePress(key)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    height: Math.max(keyHeight, theme.touch.min),
                    borderRadius: theme.radius.keypadKey,
                    backgroundColor: theme.colors.surfaceSunken,
                    opacity: pressed && !reducedMotion ? 0.65 : 1,
                  },
                ]}
              >
                {isBack ? (
                  <AppIcon name="delete" size={21} color={theme.colors.textSecondary} />
                ) : (
                  <AppText variant="title" tabularNums style={styles.keyText}>
                    {key}
                  </AppText>
                )}
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: 'Manrope_500Medium',
  },
});
