import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrencySymbol, normalizeDigits } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

export interface AmountPadProps {
  value: string;
  onChange: (next: string) => void;
  currency: CurrencyCode;
  testID?: string;
}

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'BACK'],
];

function sanitizeAmountString(raw: string): string {
  const normalized = normalizeDigits(raw).replace(/,/g, '');
  let out = '';
  let seenDot = false;
  let fracCount = 0;
  let wholeCount = 0;

  for (const ch of normalized) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (fracCount < 2) {
          out += ch;
          fracCount++;
        }
      } else if (wholeCount < 9) {
        out += ch;
        wholeCount++;
      }
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      out = out === '' ? '0.' : `${out}.`;
    }
  }
  return out;
}

export function AmountPad({ value, onChange, currency, testID }: AmountPadProps) {
  const { theme, reducedMotion } = useTheme();
  const symbol = getCurrencySymbol(currency);

  const handleKey = (key: string) => {
    if (key === 'BACK') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }
    const dotIdx = value.indexOf('.');
    if (dotIdx !== -1) {
      const frac = value.slice(dotIdx + 1);
      if (frac.length >= 2) return;
      onChange(`${value}${key}`);
      return;
    }
    if (value === '0') {
      onChange(key);
      return;
    }
    if (value.length >= 9) return;
    onChange(`${value}${key}`);
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={[
          styles.displayCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.xl,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <AppText variant="title" color="textMuted">
          {symbol}
        </AppText>
        <TextInput
          testID={testID ?? 'amount-input'}
          value={value}
          onChangeText={(txt) => onChange(sanitizeAmountString(txt))}
          placeholder={t('tx.amountPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          showSoftInputOnFocus={false}
          accessibilityLabel={t('common.amount')}
          style={[
            theme.typography.display,
            styles.amountInput,
            Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null,
            {
              color: theme.colors.text,
              fontVariant: ['tabular-nums'],
            },
          ]}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.padRow, { gap: theme.spacing.sm }]}>
            {row.map((key) => {
              const isBack = key === 'BACK';
              const a11yLabel = isBack
                ? t('tx.padBackspace')
                : key === '.'
                  ? t('tx.padDecimal')
                  : t('tx.padDigit', { digit: key });

              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel}
                  onPress={() => handleKey(key)}
                  style={({ pressed }) => [
                    styles.keyBtn,
                    {
                      minHeight: theme.touch.min,
                      borderRadius: theme.radius.md,
                      backgroundColor: isBack ? theme.colors.surfaceAlt : theme.colors.surface,
                      borderColor: theme.colors.border,
                      opacity: pressed && !reducedMotion ? 0.7 : 1,
                    },
                  ]}
                >
                  {isBack ? (
                    <Ionicons name="backspace-outline" size={22} color={theme.colors.text} />
                  ) : (
                    <AppText variant="title" tabularNums>
                      {key}
                    </AppText>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  displayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
  },
  padRow: {
    flexDirection: 'row',
  },
  keyBtn: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
