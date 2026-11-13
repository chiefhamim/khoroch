import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          style={[styles.actionBtn, { minHeight: theme.touch.min, paddingHorizontal: theme.spacing.sm }]}
        >
          <AppText variant="label" color="accent">
            {actionLabel}
          </AppText>
        </Pressable>
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
