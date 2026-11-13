import React from 'react';
import { Text, type TextProps } from 'react-native';
import type { ColorPalette, TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ColorPalette;
  tabularNums?: boolean;
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

  return (
    <Text
      numberOfLines={numberOfLines}
      ellipsizeMode={resolvedEllipsize}
      style={[
        typeStyle,
        { color: theme.colors[color] },
        tabularNums ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
