import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Sheet({
  visible,
  onClose,
  title,
  headerRight,
  footer,
  children,
  scroll = true,
  style,
  testID,
}: SheetProps) {
  const { theme, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const bottomPad = footer
    ? theme.spacing.md
    : Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.sm;

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      bounces={false}
      contentContainerStyle={{
        paddingHorizontal: theme.geometry.screenMargin,
        paddingBottom: bottomPad,
        gap: theme.spacing.md,
      }}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={{
        paddingHorizontal: theme.geometry.screenMargin,
        paddingBottom: bottomPad,
        gap: theme.spacing.md,
      }}
    >
      {children}
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}
        />
        <View
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor:
                theme.scheme === 'dark' ? theme.colors.surfaceRaised : theme.colors.surface,
              borderTopLeftRadius: theme.radius.sheetTop,
              borderTopRightRadius: theme.radius.sheetTop,
              borderColor: theme.colors.separator,
              borderTopWidth: theme.scheme === 'dark' ? 1 : 0,
            },
            style,
          ]}
        >
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.handle,
                {
                  width: theme.geometry.sheetHandleWidth,
                  height: theme.geometry.sheetHandleHeight,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.separator,
                },
              ]}
            />
          </View>
          {title || headerRight ? (
            <View
              style={[
                styles.header,
                {
                  paddingHorizontal: theme.geometry.screenMargin,
                  paddingBottom: theme.spacing.sm,
                },
              ]}
            >
              <AppText variant="headline" style={styles.title} numberOfLines={1}>
                {title ?? ''}
              </AppText>
              <View style={[styles.headerRight, { gap: theme.spacing.sm }]}>
                {headerRight}
                <IconButton
                  icon="x"
                  size={34}
                  iconSize={18}
                  accessibilityLabel="Close"
                  onPress={onClose}
                />
              </View>
            </View>
          ) : null}
          {content}
          {footer ? (
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.separator,
                paddingHorizontal: theme.geometry.screenMargin,
                paddingTop: theme.spacing.sm + 2,
                paddingBottom: Math.max(insets.bottom, theme.spacing.md),
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
