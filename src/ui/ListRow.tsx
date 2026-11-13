import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  titleNumberOfLines?: number;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
  dividerInset?: number;
  compact?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  titleNumberOfLines = 2,
  left,
  right,
  onPress,
  showChevron = false,
  showDivider = false,
  dividerInset,
  compact = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { theme, reducedMotion } = useTheme();
  const minHeight = compact ? theme.touch.min : theme.geometry.listRowHeight;
  const resolvedInset = dividerInset ?? (left ? 68 : theme.spacing.lg);

  const rowInner = (
    <View>
      <View
        style={[
          styles.row,
          {
            minHeight,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.md,
          },
        ]}
      >
        {left ? <View style={styles.left}>{left}</View> : null}
        <View style={styles.center}>
          <AppText
            variant="bodyStrong"
            numberOfLines={titleNumberOfLines > 0 ? titleNumberOfLines : undefined}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
        {showChevron ? (
          <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
        ) : null}
      </View>
      {showDivider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth > 0 ? 1 : 1,
            backgroundColor: theme.colors.separator,
            marginLeft: resolvedInset,
            marginRight: theme.spacing.lg,
          }}
        />
      ) : null}
    </View>
  );

  if (!onPress) return rowInner;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed && !reducedMotion ? 0.72 : 1,
      })}
    >
      {rowInner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
