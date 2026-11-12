import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { formatMoney } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import type { ColorPalette, TypographyVariant } from '@/theme/tokens';
import { AppText } from './AppText';

export interface MoneyProps {
  amountMinor: number;
  currency: CurrencyCode;
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  prefix?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function Money({
  amountMinor,
  currency,
  variant = 'body',
  color = 'text',
  prefix = '',
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
}: MoneyProps) {
  const formatted = formatMoney(amountMinor, currency);
  return (
    <AppText
      testID={testID}
      variant={variant}
      color={color}
      tabularNums
      style={style}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ?? `${prefix}${formatted}`}
    >
      {prefix}
      {formatted}
    </AppText>
  );
}
