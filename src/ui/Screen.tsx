import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
} from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { useGlass } from './glass';
import { OnboardingBackdrop } from './OnboardingBackdrop';

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
  const glass = useGlass();
  const tabScrollPadding = useTabScrollPadding();

  const scrollContentStyle: StyleProp<ViewStyle> = [
    {
      paddingHorizontal: theme.geometry.screenMargin,
      paddingTop: theme.spacing.lg,
      paddingBottom: bottomSpacer ? tabScrollPadding : theme.spacing.xxl,
      gap: theme.spacing.lg,
    },
    contentContainerStyle,
  ];

  const inner = scroll ? (
    keyboardAvoiding ? (
      <KeyboardAwareScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={scrollContentStyle}
      >
        {children}
      </KeyboardAwareScrollView>
    ) : (
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={scrollContentStyle}
      >
        {children}
      </ScrollView>
    )
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

  const wrapped =
    keyboardAvoiding && !scroll ? (
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {inner}
      </KeyboardAvoidingView>
    ) : (
      inner
    );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: glass ? 'transparent' : theme.colors.bg }, style]}
    >
      {glass?.backdrop ? <OnboardingBackdrop intensity={glass.backdrop} /> : null}
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
