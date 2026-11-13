import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getWalletIconName, resolveWalletColorHex } from '@/domain/accounts';
import type { Account } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export interface WalletAvatarProps {
  account?: Pick<Account, 'kind' | 'provider' | 'colorKey' | 'monogram'> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZE_METRICS = {
  xs: { box: 24, radius: 7, font: 9.5, icon: 13 },
  sm: { box: 30, radius: 9, font: 11.5, icon: 15 },
  md: { box: 36, radius: 11, font: 13.5, icon: 18 },
  lg: { box: 44, radius: 13, font: 16, icon: 22 },
} as const;

/**
 * Renders a flat brand monogram badge (bK, N, U, R, CF) or crisp icon tile (Cash, Bank, Card, Other).
 * Uses editorial solid colors without borders, gradients, or shadows.
 */
export function WalletAvatar({
  account,
  size = 'sm',
  style,
  testID,
}: WalletAvatarProps) {
  const { theme } = useTheme();
  const metrics = SIZE_METRICS[size];

  if (!account) {
    return (
      <View
        testID={testID}
        style={[
          styles.tile,
          {
            width: metrics.box,
            height: metrics.box,
            borderRadius: metrics.radius,
            backgroundColor: theme.colors.surfaceSunken,
          },
          style,
        ]}
      >
        <AppIcon name="wallet" size={metrics.icon} color={theme.colors.textTertiary} />
      </View>
    );
  }

  const bgColor = resolveWalletColorHex(account);
  const monogram = account.monogram?.trim();

  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        {
          width: metrics.box,
          height: metrics.box,
          borderRadius: metrics.radius,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      {monogram ? (
        <AppText
          style={{
            color: '#FFFFFF',
            fontFamily: 'PlusJakartaSans_700Bold',
            fontSize: metrics.font,
            lineHeight: metrics.font + 2,
            letterSpacing: -0.2,
          }}
        >
          {monogram}
        </AppText>
      ) : (
        <AppIcon name={getWalletIconName(account.kind)} size={metrics.icon} color="#FFFFFF" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
