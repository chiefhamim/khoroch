import React from 'react';
import { PixelRatio, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useLocale } from '@/i18n';
import { localizeDisplayText } from '@/i18n/displayText';
import {
  BANGLA_FONTS,
  containsBengali,
  mapFontToBangla,
  type ColorPalette,
  type TypographyVariant,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ZERO_ADVANCE_BN_MARKS = /[\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3]/;
const HALF_ADVANCE_BN_MARKS = /[\u09BE\u09BF\u09C0\u09C7\u09C8\u09CB\u09CC]/;

/** Counts visual advance units for Bangla text, discounting combining virama/vowel marks. */
export function estimateBanglaWeightedUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    if (ch === ' ') units += 0.35;
    else if (ZERO_ADVANCE_BN_MARKS.test(ch)) units += 0.1;
    else if (HALF_ADVANCE_BN_MARKS.test(ch)) units += 0.5;
    else units += 1;
  }
  return units;
}

/**
 * Estimates a generous single-line minimum width (dp) so Android Fabric does not wrap or drop
 * the final word/glyph when Yoga quantizes shrink-wrapped text across locale/theme changes.
 */
export function estimateSingleLineMinWidth(text: string, fontSize = 13): number {
  const fontScale = Math.max(1, PixelRatio.getFontScale?.() ?? 1);
  if (containsBengali(text)) {
    const units = estimateBanglaWeightedUnits(text);
    return Math.ceil((units * (fontSize * 0.68) + 12) * fontScale);
  }
  const perChar = fontSize * 0.54;
  return Math.ceil((text.length * perChar + 10) * fontScale);
}

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  tabularNums?: boolean;
}

/** Converts primitive children into Bangla numerals/labels when locale is `'bn'`. */
function localizeBnChildren(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return localizeDisplayText(node, 'bn');
  if (typeof node === 'number') return localizeDisplayText(String(node), 'bn');
  if (Array.isArray(node)) {
    return React.Children.map(node, (child) =>
      typeof child === 'string' || typeof child === 'number'
        ? localizeDisplayText(String(child), 'bn')
        : child
    );
  }
  return node;
}

function collectTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectTextContent).join('');
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return collectTextContent(node.props.children);
  }
  return '';
}

export function AppText({
  variant = 'body',
  color = 'text',
  tabularNums = false,
  numberOfLines,
  ellipsizeMode,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { theme } = useTheme();
  const locale = useLocale();
  const typeStyle = theme.typography[variant];
  const resolvedEllipsize =
    ellipsizeMode ?? (numberOfLines !== undefined ? 'clip' : undefined);

  const flatStyle = style ? (StyleSheet.flatten(style) as TextStyle) : undefined;
  const displayChildren = locale === 'bn' ? localizeBnChildren(children) : children;
  const textSample = collectTextContent(displayChildren);
  const useBanglaFont = locale === 'bn' || containsBengali(textSample);
  const baseFontFamily = flatStyle?.fontFamily ?? typeStyle.fontFamily ?? 'default';
  const mappedBanglaFont = useBanglaFont
    ? mapFontToBangla(flatStyle?.fontFamily ?? typeStyle.fontFamily, flatStyle?.fontWeight)
    : baseFontFamily;
  // HindSiliguri_500Medium renders U+09E7 ('১') without its upper loop; promote medium runs containing '১'.
  const resolvedFontFamily =
    mappedBanglaFont === BANGLA_FONTS.medium && textSample.includes('\u09E7')
      ? BANGLA_FONTS.semibold
      : mappedBanglaFont;

  const resolvedFontStyle: TextStyle | null = useBanglaFont
    ? {
        fontFamily: resolvedFontFamily,
        fontWeight: undefined,
        letterSpacing: 0,
      }
    : null;

  return (
    <Text
      key={`${locale}:${resolvedFontFamily}`}
      numberOfLines={numberOfLines}
      ellipsizeMode={resolvedEllipsize}
      style={[
        typeStyle,
        { color: theme.colors[color] },
        tabularNums ? { fontVariant: ['tabular-nums'] } : null,
        style,
        resolvedFontStyle,
      ]}
      {...rest}
    >
      {displayChildren}
    </Text>
  );
}
