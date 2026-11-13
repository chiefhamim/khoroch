import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import {
  getCompactNumberPart,
  getCurrencySymbol,
  groupThousands,
  HIDDEN_AMOUNT_TEXT,
  roundMinorToWhole,
} from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { usePrivacyStore } from '@/state/privacyStore';
import { TAKA_FONT_FAMILY, type ColorPalette, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface MoneyProps {
  amountMinor: number;
  currency: CurrencyCode;
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  symbolColor?: keyof ColorPalette;
  prefix?: string;
  showSign?: 'auto' | 'none';
  compact?: boolean;
  /** Enables Settings -> Appearance -> Short numbers (`৳48.4k`) on card/KPI surfaces only. */
  allowCompact?: boolean;
  roundToWhole?: boolean;
  showDecimals?: boolean;
  hidden?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export interface TakaSignMetrics {
  fontFamily: typeof TAKA_FONT_FAMILY;
  fontSize: number;
  opacity: number;
  baselineNudge: number;
  spacerWidth: number;
}

/**
 * Computes the raised currency mark beside the amount.
 */
export function getTakaSignMetrics(numberFontSize: number): TakaSignMetrics {
  return {
    fontFamily: TAKA_FONT_FAMILY,
    fontSize: Math.max(8, Math.round(numberFontSize * 0.52)),
    opacity: 1,
    baselineNudge: -Math.round(numberFontSize * 0.18),
    spacerWidth: 0,
  };
}

interface TakaSignProps {
  numberFontSize: number;
  symbol: string;
  color: string;
  testID?: string;
}

function TakaSign({ numberFontSize, symbol, color, testID }: TakaSignProps) {
  const metrics = getTakaSignMetrics(numberFontSize);

  return (
    <Text
      testID={testID}
      style={{
        fontFamily: metrics.fontFamily,
        fontSize: metrics.fontSize,
        opacity: metrics.opacity,
        color,
        position: 'relative',
        top: metrics.baselineNudge,
        includeFontPadding: false,
      }}
    >
      {symbol}
    </Text>
  );
}

/**
 * Formats integer minor units with a dedicated Hind Siliguri `TakaSign` (0.72x, 0.8 opacity,
 * baseline-tuned across 12/15/17/28/40 size buckets), tabular numerals, omitted `.00` unless
 * `showDecimals` is enabled, optional `compact` `k`/`M` cards display, and `Hidden` masking.
 */
export function Money({
  amountMinor,
  currency,
  variant = 'body',
  color = 'text',
  symbolColor,
  prefix = '',
  showSign = 'auto',
  compact,
  allowCompact = false,
  roundToWhole = false,
  showDecimals,
  hidden,
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
}: MoneyProps) {
  const { theme } = useTheme();
  const storeHideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const storeShowPoisha = usePrivacyStore((s) => s.showPoisha);
  const storeCompactNumbers = usePrivacyStore((s) => s.compactNumbers);

  const resolvedHidden = hidden ?? storeHideAmounts;
  const resolvedCompact = compact ?? (allowCompact ? storeCompactNumbers : false);
  const resolvedShowDecimals =
    showDecimals ?? (roundToWhole ? false : storeShowPoisha);

  const typeStyle = theme.typography[variant];
  const flattened = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as TextStyle | undefined) ?? {});
  const mainFontSize = flattened.fontSize ?? typeStyle.fontSize;

  const resolvedMainColor = theme.colors[color];
  const resolvedSymbolColor =
    symbolColor !== undefined ? theme.colors[symbolColor] : resolvedMainColor;

  if (resolvedHidden) {
    return (
      <Text
        testID={testID}
        numberOfLines={numberOfLines}
        ellipsizeMode={numberOfLines !== undefined ? 'clip' : undefined}
        accessibilityLabel={accessibilityLabel ?? HIDDEN_AMOUNT_TEXT}
        style={[
          typeStyle,
          {
            color: resolvedMainColor,
            fontVariant: ['tabular-nums'],
          },
          style,
        ]}
      >
        {HIDDEN_AMOUNT_TEXT}
      </Text>
    );
  }

  const normalizedMinor = roundToWhole
    ? roundMinorToWhole(amountMinor)
    : Math.trunc(amountMinor);
  const isNegative = normalizedMinor < 0;
  const absMinor = Math.abs(normalizedMinor);

  let numberPart: string;
  if (resolvedCompact) {
    numberPart = getCompactNumberPart(normalizedMinor).numberPart;
  } else {
    const frac = absMinor % 100;
    const whole = (absMinor - frac) / 100;
    const wholeStr = groupThousands(String(whole));
    const includeDecimals = frac !== 0 || resolvedShowDecimals;
    numberPart = includeDecimals
      ? `${wholeStr}.${String(frac).padStart(2, '0')}`
      : wholeStr;
  }

  const symbol = getCurrencySymbol(currency);
  const resolvedSign =
    prefix === '-'
      ? '−'
      : prefix.length > 0
        ? prefix
        : showSign === 'auto' && isNegative
          ? '−'
          : '';

  const formattedPlain = `${resolvedSign}${symbol}${numberPart}`;
  const computedA11y =
    accessibilityLabel ??
    (resolvedSign && !formattedPlain.startsWith(resolvedSign)
      ? `${resolvedSign}${formattedPlain}`
      : formattedPlain);

  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      ellipsizeMode={numberOfLines !== undefined ? 'clip' : undefined}
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
      <TakaSign
        testID={testID ? `${testID}-taka` : undefined}
        numberFontSize={mainFontSize}
        symbol={symbol}
        color={resolvedSymbolColor}
      />
      {numberPart}
    </Text>
  );
}
