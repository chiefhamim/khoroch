import React from 'react';
import { PixelRatio, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useLocale } from '@/i18n';
import {
  containsBengali,
  mapFontToBangla,
  type ColorPalette,
  type TypographyVariant,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Estimates a generous single-line minimum width (dp) so Android Fabric does not wrap or drop
 * the final word/glyph when Yoga quantizes shrink-wrapped text across locale/theme changes.
 */
export function estimateSingleLineMinWidth(text: string, fontSize = 13): number {
  const fontScale = Math.max(1, PixelRatio.getFontScale?.() ?? 1);
  const perChar = fontSize * (containsBengali(text) ? 0.6 : 0.54);
  const buffer = containsBengali(text) ? 12 : 10;
  return Math.ceil((text.length * perChar + buffer) * fontScale);
}

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  tabularNums?: boolean;
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
  const textSample = collectTextContent(children);
  const useBanglaFont = locale === 'bn' || containsBengali(textSample);
  const baseFontFamily = flatStyle?.fontFamily ?? typeStyle.fontFamily ?? 'default';
  const resolvedFontFamily = useBanglaFont
    ? mapFontToBangla(flatStyle?.fontFamily ?? typeStyle.fontFamily)
    : baseFontFamily;

  const resolvedFontStyle: TextStyle | null = useBanglaFont
    ? {
        fontFamily: resolvedFontFamily,
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
      {children}
    </Text>
  );
}
