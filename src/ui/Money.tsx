import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatMoney, getCurrencySymbol, groupThousands } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import type { ColorPalette, TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface MoneyProps {
  amountMinor: number;
  currency: CurrencyCode;
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  symbolColor?: keyof ColorPalette;
  prefix?: string;
  showSign?: 'auto' | 'none';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Formats integer minor units with a smaller baseline-aligned currency symbol
 * (0.6x in `textSecondary` by default), tabular numerals, omitted `.00` on whole
 * units, and typographic minus (`U+2212`).
 */
export function Money({
  amountMinor,
  currency,
  variant = 'body',
  color = 'text',
  symbolColor,
  prefix = '',
  showSign = 'auto',
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
}: MoneyProps) {
  const { theme } = useTheme();
  const typeStyle = theme.typography[variant];
  const flattened = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as TextStyle | undefined) ?? {});
  const mainFontSize = flattened.fontSize ?? typeStyle.fontSize;
  const symbolSize = Math.max(9, Math.round(mainFontSize * 0.6));

  const safeMinor = Math.trunc(amountMinor);
  const isNegative = safeMinor < 0;
  const absMinor = Math.abs(safeMinor);

  const frac = absMinor % 100;
  const whole = (absMinor - frac) / 100;
  const wholeStr = groupThousands(String(whole));
  const numberPart =
    frac === 0 ? wholeStr : `${wholeStr}.${String(frac).padStart(2, '0')}`;

  const symbol = getCurrencySymbol(currency);
  const resolvedSign =
    prefix === '-'
      ? '−'
      : prefix.length > 0
        ? prefix
        : showSign === 'auto' && isNegative
          ? '−'
          : '';

  const resolvedMainColor = theme.colors[color];
  const resolvedSymbolColor =
    symbolColor !== undefined
      ? theme.colors[symbolColor]
      : color === 'text'
        ? theme.colors.textSecondary
        : resolvedMainColor;

  const formattedPlain = formatMoney(amountMinor, currency).replace('-', '−');
  const computedA11y =
    accessibilityLabel ??
    (resolvedSign && !formattedPlain.startsWith(resolvedSign)
      ? `${resolvedSign}${formattedPlain}`
      : formattedPlain);

  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      accessibilityLabel={computedA11y}
      style={[
        typeStyle,
        {
          color: resolvedMainColor,
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
    >
      {resolvedSign ? <Text>{resolvedSign}</Text> : null}
      <Text
        style={{
          fontSize: symbolSize,
          fontFamily: theme.typography.label.fontFamily,
          color: resolvedSymbolColor,
        }}
      >
        {symbol}
      </Text>
      <Text style={{ fontSize: Math.max(2, Math.round(mainFontSize * 0.14)) }}>{' '}</Text>
      {numberPart}
    </Text>
  );
}
