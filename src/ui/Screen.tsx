import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

export const TAB_BAR_CONTENT_HEIGHT = 64;
export const TAB_SCROLL_EXTRA_GAP = 16;

export function computeTabBarHeight(bottomInset: number): number {
  return TAB_BAR_CONTENT_HEIGHT + Math.max(bottomInset, 10);
}

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return computeTabBarHeight(insets?.bottom ?? 0);
}

export function useTabScrollPadding(): number {
  return useTabBarHeight() + TAB_SCROLL_EXTRA_GAP;
}

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomSpacer?: boolean;
}

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  keyboardAvoiding = false,
  style,
  contentContainerStyle,
  bottomSpacer = false,
}: ScreenProps) {
  const { theme } = useTheme();
  const tabScrollPadding = useTabScrollPadding();

  const inner = scroll ? (
    <ScrollView
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingHorizontal: theme.geometry.screenMargin,
          paddingTop: theme.spacing.lg,
          paddingBottom: bottomSpacer ? tabScrollPadding : theme.spacing.xxl,
          gap: theme.spacing.lg,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        {
          paddingHorizontal: theme.geometry.screenMargin,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.bg }, style]}
    >
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
