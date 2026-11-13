import React, { useCallback, useEffect, useState } from "react";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";
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
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/useTheme";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";

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

  // Stay mounted while the closing animation plays (state adjusted during render, not in an effect).
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const sheetHeight = useSharedValue(OFFSCREEN);
  const translateY = useSharedValue(visible ? 0 : OFFSCREEN);
  const backdrop = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        translateY.set(0);
        backdrop.set(1);
        return;
      }
      translateY.set(sheetHeight.get());
      backdrop.set(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      );
      translateY.set(withSpring(0, OPEN_SPRING));
      return;
    }
    if (reducedMotion) {
      translateY.set(OFFSCREEN);
      backdrop.set(0);
      setMountedLater(setMounted);
      return;
    }
    backdrop.set(
      withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
    );
    translateY.set(
      withTiming(
        sheetHeight.get(),
        { duration: 220, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      ),
    );
  }, [visible, reducedMotion, translateY, backdrop, sheetHeight]);

  // Drag the handle or header down to dismiss (UI-thread gesture); small drags spring back.
  const [dragCloses, setDragCloses] = useState(0);
  const requestClose = useCallback(() => setDragCloses((n) => n + 1), []);
  const pan = usePanGesture({
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      "worklet";
      const dy = e.translationY;
      translateY.set(dy > 0 ? dy : dy / 6);
      backdrop.set(Math.max(0, 1 - Math.max(0, dy) / sheetHeight.get()));
    },
    onDeactivate: (e) => {
      "worklet";
      if (
        e.translationY > Math.min(140, sheetHeight.get() * 0.3) ||
        e.velocityY > 900
      ) {
        runOnJS(requestClose)();
      } else {
        translateY.set(withSpring(0, OPEN_SPRING));
        backdrop.set(withTiming(1, { duration: 160 }));
      }
    },
  });
  // A drag past the threshold asks the parent to close; the parent flips `visible`.
  useEffect(() => {
    if (dragCloses > 0) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragCloses]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

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
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}
            />
          </Animated.View>
          <Animated.View
            testID={testID}
            onLayout={(e) => {
              sheetHeight.set(Math.max(200, e.nativeEvent.layout.height + 24));
            }}
            style={[
              styles.sheet,
              {
                backgroundColor:
                  theme.scheme === "dark"
                    ? theme.colors.surfaceRaised
                    : theme.colors.surface,
                borderTopLeftRadius: theme.radius.sheetTop,
                borderTopRightRadius: theme.radius.sheetTop,
                borderColor: theme.colors.separator,
                borderTopWidth: theme.scheme === "dark" ? 1 : 0,
              },
              style,
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View>
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
                    <AppText
                      variant="headline"
                      style={styles.title}
                      numberOfLines={1}
                    >
                      {title ?? ""}
                    </AppText>
                    <View
                      style={[styles.headerRight, { gap: theme.spacing.sm }]}
                    >
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
              </View>
            </GestureDetector>
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
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const OFFSCREEN = 900;

/** Unmount on the next frame (reduced-motion close has no animation callback to wait for). */
function setMountedLater(set: (v: boolean) => void) {
  requestAnimationFrame(() => set(false));
}
const OPEN_SPRING = {
  damping: 32,
  stiffness: 320,
  mass: 0.9,
  overshootClamping: false,
} as const;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  title: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
});
