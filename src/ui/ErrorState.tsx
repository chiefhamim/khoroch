import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { Surface } from './Surface';

export interface ErrorStateProps {
  title: string;
  body: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, body, retryLabel, onRetry }: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <Surface style={{ alignItems: 'center', gap: theme.spacing.md }}>
      <View
        style={[
          styles.iconCircle,
          {
            width: 56,
            height: 56,
            backgroundColor: theme.colors.dangerSoft,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <AppIcon name="circle-alert" size={26} color={theme.colors.danger} />
      </View>
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.center}>
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
    </Surface>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
  },
});
