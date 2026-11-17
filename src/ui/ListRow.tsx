import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { PressableScale } from '@/ui/PressableScale';
import { listLayoutTransition } from './motion';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Optional extra caption line under the subtitle; wraps, never truncates. */
  caption?: string;
  captionTone?: 'danger' | 'textSecondary';
  titleNumberOfLines?: number;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
  dividerInset?: number;
  compact?: boolean;
  animateLayout?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  caption,
  captionTone = 'textSecondary',
  titleNumberOfLines = 2,
  left,
  right,
  onPress,
  showChevron = false,
  showDivider = false,
  dividerInset,
  compact = false,
  animateLayout = false,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { theme, reducedMotion } = useTheme();
  const minHeight = compact ? theme.touch.min : theme.geometry.listRowHeight;
  const resolvedInset = dividerInset ?? (left ? theme.geometry.dividerInset : theme.spacing.lg);

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
          {caption ? (
            <AppText variant="caption" color={captionTone}>
              {caption}
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
            height: Math.max(StyleSheet.hairlineWidth, 0.5),
            backgroundColor: theme.colors.separator,
            marginLeft: resolvedInset,
            marginRight: theme.spacing.lg,
          }}
        />
      ) : null}
    </View>
  );

  const pressable = onPress ? (
    <PressableScale
      pressScale={0.985}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        [title, subtitle, caption].filter((p): p is string => typeof p === 'string' && p.length > 0).join('. ')
      }
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed && !reducedMotion ? 0.78 : 1,
      })}
    >
      {rowInner}
    </PressableScale>
  ) : (
    rowInner
  );

  if (animateLayout) {
    return (
      <Animated.View layout={listLayoutTransition(reducedMotion)}>
        {pressable}
      </Animated.View>
    );
  }

  return pressable;
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
