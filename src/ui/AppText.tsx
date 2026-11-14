import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { getLocale } from '@/i18n';
import {
  containsBengali,
  mapFontToBangla,
  type ColorPalette,
  type TypographyVariant,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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
  const typeStyle = theme.typography[variant];
  const resolvedEllipsize =
    ellipsizeMode ?? (numberOfLines !== undefined ? 'clip' : undefined);

  const flatStyle = style ? (StyleSheet.flatten(style) as TextStyle) : undefined;
  const textSample = collectTextContent(children);
  const useBanglaFont = getLocale() === 'bn' || containsBengali(textSample);

  const resolvedFontStyle: TextStyle | null = useBanglaFont
    ? {
        fontFamily: mapFontToBangla(flatStyle?.fontFamily ?? typeStyle.fontFamily),
        letterSpacing: 0,
      }
    : null;

  return (
    <Text
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
