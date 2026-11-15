import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: AppIconName;
  title: string;
  body: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  testID?: string;
}

const LEGACY_ICON_MAP: Record<string, AppIconName> = {
  'wallet-outline': 'wallet',
  'receipt-outline': 'list',
  'analytics-outline': 'trending-up',
  'search-outline': 'search',
};

export function EmptyState({
  icon = 'wallet',
  title,
  body,
  ctaLabel,
  onCtaPress,
  testID,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const resolvedIcon = LEGACY_ICON_MAP[icon] ?? icon;

  return (
    <View testID={testID} style={[styles.wrap, { paddingVertical: theme.spacing.xxl, gap: theme.spacing.md }]}>
      <View
        style={[
          styles.badge,
          {
            width: 56,
            height: 56,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.accentSoft,
          },
        ]}
      >
        <AppIcon name={resolvedIcon} size={26} color={theme.colors.accent} />
      </View>
      <View style={[styles.textWrap, { gap: theme.spacing.xs }]}>
        <AppText variant="headline" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="body" color="textSecondary" style={[styles.center, styles.body]}>
          {body}
        </AppText>
      </View>
      {ctaLabel && onCtaPress ? (
        <Button
          title={ctaLabel}
          size="md"
          onPress={onCtaPress}
          style={{ marginTop: theme.spacing.xs, paddingHorizontal: theme.spacing.xxl }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  body: {
    maxWidth: 300,
  },
});
