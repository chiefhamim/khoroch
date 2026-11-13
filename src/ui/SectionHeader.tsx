import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { PressableScale } from '@/ui/PressableScale';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  right?: React.ReactNode;
}

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  right,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, { minHeight: theme.touch.min - theme.spacing.md }]}>
      <AppText variant="headline" style={styles.title}>
        {title}
      </AppText>
      {right}
      {actionLabel && onActionPress ? (
        <PressableScale pressScale={0.97}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          style={[styles.actionBtn, { minHeight: theme.touch.min, paddingHorizontal: theme.spacing.sm }]}
        >
          <AppText variant="label" color="accent">
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
