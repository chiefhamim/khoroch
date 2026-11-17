import React, { useEffect, useRef, useState } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import { fitMoney, formatNumberPart } from '@/domain/fitMoney';
import { getCurrencySymbol, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { useLocale } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
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
  /** Animates numeric changes over `motion.countMs`; only honoured for hero/display variants (default on). */
  animate?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /**
   * Available width in dp. When set, Money picks the first of `fitVariants` whose estimated width
   * fits, and switches to compact numbers if none does (see `src/domain/fitMoney.ts`). Renders on one line.
   */
  fitWidth?: number;
  /** Candidate type variants, largest first. Defaults to `[variant]`. Never goes below the label size. */
  fitVariants?: readonly TypographyVariant[];
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
    baselineNudge: -Math.round(numberFontSize * 0.34),
    spacerWidth: Math.max(1, Math.round(numberFontSize * 0.06)),
  };
}

interface TakaSignProps {
  numberFontSize: number;
  symbol: string;
  color: string;
  testID?: string;
}

/**
 * Nested `<Text>` spans ignore `top`/`transform` on Android, so the sign lives in an inline
 * `<View>` (supported inside Text on Fabric) that is translated upward into a true superscript.
 */
export function TakaSign({ numberFontSize, symbol, color, testID }: TakaSignProps) {
  const metrics = getTakaSignMetrics(numberFontSize);

  return (
    <View
      style={{
        transform: [{ translateY: metrics.baselineNudge }],
        marginLeft: metrics.spacerWidth,
      }}
    >
      <Text
        testID={testID}
        style={{
          fontFamily: metrics.fontFamily,
          fontSize: metrics.fontSize,
          lineHeight: Math.round(metrics.fontSize * 1.2),
          opacity: metrics.opacity,
          color,
          includeFontPadding: false,
        }}
      >
        {symbol}
      </Text>
    </View>
  );
}

/**
 * Formats integer minor units with a dedicated Hind Siliguri `TakaSign`, tabular numerals,
 * omitted `.00` unless `showDecimals` is enabled, optional compact display, and `motion.countMs` count-up on change (hero/display only).
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
  fitWidth,
  fitVariants,
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

  // Count-up runs on the JS thread, so it is limited to hero and display amounts (never list rows).
  const shouldAnimate =
    (variant === 'hero' || variant === 'display') &&
    (animate ?? true) &&
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
  const resolvedMainColor = theme.colors[color];
  const resolvedSymbolColor =
    symbolColor !== undefined ? theme.colors[symbolColor] : resolvedMainColor;

  if (resolvedHidden) {
    const hiddenStyle = theme.typography[variant];
    return (
      <Text
        testID={testID}
        numberOfLines={fitWidth !== undefined ? 1 : numberOfLines}
        ellipsizeMode="clip"
        accessibilityLabel={accessibilityLabel ?? HIDDEN_AMOUNT_TEXT}
        style={[
          hiddenStyle,
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

  const symbol = getCurrencySymbol(currency);
  const partOptions = {
    compact: resolvedCompact,
    showDecimals: resolvedShowDecimals,
    roundToWhole,
  };

  // The exact amount (as the user's own compact setting would show it) drives the accessibility
  // label and the fit decision, so neither flickers during count-up or changes when Money shrinks.
  const target = formatNumberPart(amountMinor, partOptions);
  const signFor = (isNegative: boolean) =>
    prefix === '-'
      ? '−'
      : prefix.length > 0
        ? prefix
        : showSign === 'auto' && isNegative
          ? '−'
          : '';
  const targetSign = signFor(target.isNegative);

  const fit =
    fitWidth !== undefined
      ? fitMoney({
          amountMinor,
          availableWidth: fitWidth,
          variants: (fitVariants && fitVariants.length > 0 ? fitVariants : [variant]).map((key) => ({
            key,
            fontSize: theme.typography[key].fontSize,
          })),
          bangla: locale === 'bn',
          hasSign: targetSign.length > 0,
          symbolChars: symbol.length,
          ...partOptions,
        })
      : null;

  const chosenVariant = fit ? fit.variant : variant;
  const typeStyle = theme.typography[chosenVariant];
  const flattened = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as TextStyle | undefined) ?? {});
  const mainFontSize = flattened.fontSize ?? typeStyle.fontSize;

  const shown = formatNumberPart(effectiveMinor, {
    ...partOptions,
    compact: fit ? fit.compact : resolvedCompact,
  });
  const numberPart = shown.numberPart;
  const resolvedSign = signFor(shown.isNegative);

  const formattedPlain = `${targetSign}${symbol}${target.numberPart}`;
  const computedA11y =
    accessibilityLabel ??
    (targetSign && !formattedPlain.startsWith(targetSign)
      ? `${targetSign}${formattedPlain}`
      : formattedPlain);

  const needsBanglaPrefix = locale === 'bn' || containsBengali(resolvedSign);

  return (
    <Text
      testID={testID}
      numberOfLines={fitWidth !== undefined ? 1 : numberOfLines}
      ellipsizeMode="clip"
      accessibilityLabel={computedA11y}
      style={[
        typeStyle,
        {
          color: resolvedMainColor,
          fontVariant: ['tabular-nums'],
        },
        style,
        locale === 'bn'
          ? {
              fontFamily: mapFontToBangla(
                flattened.fontFamily ?? typeStyle.fontFamily,
                flattened.fontWeight,
                theme.banglaFont
              ),
              fontWeight: undefined,
              letterSpacing: 0,
            }
          : null,
      ]}
    >
      {resolvedSign ? (
        <Text
          style={
            needsBanglaPrefix
              ? {
                  fontFamily: mapFontToBangla(
                    typeStyle.fontFamily,
                    undefined,
                    theme.banglaFont
                  ),
                  letterSpacing: 0,
                }
              : undefined
          }
        >
          {resolvedSign}
        </Text>
      ) : null}
      {locale === 'bn' ? toBnDigits(numberPart) : numberPart}
      <TakaSign
        testID={testID ? `${testID}-taka` : undefined}
        numberFontSize={mainFontSize}
        symbol={symbol}
        color={resolvedSymbolColor}
      />
    </Text>
  );
}
