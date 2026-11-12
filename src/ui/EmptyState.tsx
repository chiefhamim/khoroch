import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({
  icon = 'wallet-outline',
  title,
  body,
  ctaLabel,
  onCtaPress,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const iconBoxSize = theme.touch.min + theme.spacing.sm;

  return (
    <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
      <View
        style={[
          styles.iconCircle,
          {
            width: iconBoxSize,
            height: iconBoxSize,
            backgroundColor: theme.colors.primarySoft,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={theme.colors.primary} />
      </View>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {body}
      </AppText>
      {ctaLabel && onCtaPress ? (
        <Button
          title={ctaLabel}
          onPress={onCtaPress}
          style={[styles.cta, { marginTop: theme.spacing.xs }]}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
  },
});
