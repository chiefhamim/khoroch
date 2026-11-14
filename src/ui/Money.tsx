import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import {
  getCompactNumberPart,
  getCurrencySymbol,
  groupThousands,
  HIDDEN_AMOUNT_TEXT,
  roundMinorToWhole,
} from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { useLocale } from '@/i18n';
import { usePrivacyStore } from '@/state/privacyStore';
import {
  containsBengali,
  mapFontToBangla,
  TAKA_FONT_FAMILY,
  type ColorPalette,
  type TypographyVariant,
} from '@/theme/tokens';
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
  /** Animates numeric changes over ~400ms (defaults true for hero/display amounts). */
  animate?: boolean;
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
    fontSize: Math.max(8, Math.round(numberFontSize * 0.6)),
    opacity: 1,
    baselineNudge: -Math.round(numberFontSize * 0.2),
    spacerWidth: 1,
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
        marginRight: metrics.spacerWidth,
        includeFontPadding: false,
      }}
    >
      {symbol}
    </Text>
  );
}

/**
 * Formats integer minor units with a dedicated Hind Siliguri `TakaSign`, tabular numerals,
 * omitted `.00` unless `showDecimals` is enabled, optional compact display, and ~400ms count-up on change.
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
  animate,
  style,
  numberOfLines,
  accessibilityLabel,
  testID,
}: MoneyProps) {
  const { theme, reducedMotion } = useTheme();
  const locale = useLocale();
  const storeHideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const storeShowPoisha = usePrivacyStore((s) => s.showPoisha);
  const storeCompactNumbers = usePrivacyStore((s) => s.compactNumbers);

  const resolvedHidden = hidden ?? storeHideAmounts;
  const resolvedCompact = compact ?? (allowCompact ? storeCompactNumbers : false);
  const resolvedShowDecimals =
    showDecimals ?? (roundToWhole ? false : storeShowPoisha);

  const shouldAnimate =
    (animate ?? (variant === 'hero' || variant === 'display')) &&
    !reducedMotion &&
    !resolvedHidden;

  const [animatedMinor, setAnimatedMinor] = useState(amountMinor);
  const fromRef = useRef(amountMinor);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate || fromRef.current === amountMinor) {
      fromRef.current = amountMinor;
      setAnimatedMinor(amountMinor);
      return;
    }

    const startVal = fromRef.current;
    const endVal = amountMinor;
    const duration = theme.motion.countMs;
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out for crisp deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      fromRef.current = current;
      setAnimatedMinor(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = endVal;
        setAnimatedMinor(endVal);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [amountMinor, shouldAnimate, theme.motion.countMs]);

  const effectiveMinor = shouldAnimate ? animatedMinor : amountMinor;

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
    ? roundMinorToWhole(effectiveMinor)
    : Math.trunc(effectiveMinor);
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

  // Compute exact accessibility label from target amountMinor
  const targetNormalized = roundToWhole ? roundMinorToWhole(amountMinor) : Math.trunc(amountMinor);
  const targetAbs = Math.abs(targetNormalized);
  const targetNumberPart = resolvedCompact
    ? getCompactNumberPart(targetNormalized).numberPart
    : (() => {
        const frac = targetAbs % 100;
        const wholeStr = groupThousands(String((targetAbs - frac) / 100));
        return frac !== 0 || resolvedShowDecimals
          ? `${wholeStr}.${String(frac).padStart(2, '0')}`
          : wholeStr;
      })();
  const targetSign =
    prefix === '-'
      ? '−'
      : prefix.length > 0
        ? prefix
        : showSign === 'auto' && targetNormalized < 0
          ? '−'
          : '';
  const formattedPlain = `${targetSign}${symbol}${targetNumberPart}`;
  const computedA11y =
    accessibilityLabel ??
    (targetSign && !formattedPlain.startsWith(targetSign)
      ? `${targetSign}${formattedPlain}`
      : formattedPlain);

  const needsBanglaPrefix = locale === 'bn' || containsBengali(resolvedSign);

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
      {resolvedSign ? (
        <Text
          style={
            needsBanglaPrefix
              ? { fontFamily: mapFontToBangla(typeStyle.fontFamily), letterSpacing: 0 }
              : undefined
          }
        >
          {resolvedSign}
        </Text>
      ) : null}
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
