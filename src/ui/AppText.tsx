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
  style,
  children,
  ...rest
}: AppTextProps) {
  const { theme } = useTheme();
  const typeStyle = theme.typography[variant];

  return (
    <Text
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
