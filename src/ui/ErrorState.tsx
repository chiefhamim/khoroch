import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

export interface ErrorStateProps {
  title: string;
  body: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, body, retryLabel, onRetry }: ErrorStateProps) {
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
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <Ionicons name="alert-circle-outline" size={28} color={theme.colors.danger} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {body}
      </AppText>
      {retryLabel && onRetry ? (
        <Button
          title={retryLabel}
          variant="secondary"
          onPress={onRetry}
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
