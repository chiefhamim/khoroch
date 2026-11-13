import React, { useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { AppText } from "./AppText";
import { hapticSelection } from "./haptics";
import { PressableScale } from "@/ui/PressableScale";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
  disabled?: boolean;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const { theme, reducedMotion } = useTheme();
  const isCompact = size === "sm";
  const padding = 3;
  const itemMinHeight = isCompact ? 32 : theme.touch.min - padding * 2;

  // One thumb slides between options instead of each option painting its own background.
  const [layouts, setLayouts] = useState<
    Record<string, { x: number; width: number }>
  >({});
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);
  const ready = useRef(false);
  const target = layouts[value];
  useEffect(() => {
    if (!target) return;
    if (!ready.current || reducedMotion) {
      thumbX.set(target.x);
      thumbW.set(target.width);
      ready.current = true;
      return;
    }
    thumbX.set(withSpring(target.x, THUMB_SPRING));
    thumbW.set(withSpring(target.width, THUMB_SPRING));
  }, [target?.x, target?.width, reducedMotion, thumbX, thumbW, target]);
  const thumbStyle = useAnimatedStyle(() => ({
    width: thumbW.get(),
    transform: [{ translateX: thumbX.get() }],
  }));

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          padding,
          gap: 2,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      {target ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              top: padding,
              bottom: padding,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.separator,
              borderWidth:
                theme.scheme === "light" ? StyleSheet.hairlineWidth : 0,
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            pressScale={0.96}
            key={opt.value}
            disabled={disabled}
            hitSlop={isCompact ? 6 : undefined}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, disabled }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setLayouts((prev) =>
                prev[opt.value]?.x === x && prev[opt.value]?.width === width
                  ? prev
                  : { ...prev, [opt.value]: { x, width } },
              );
            }}
            onPress={() => {
              if (opt.value !== value) hapticSelection();
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              styles.option,
              !isCompact && styles.optionFill,
              {
                minHeight: itemMinHeight,
                paddingHorizontal: isCompact
                  ? theme.spacing.md
                  : theme.spacing.lg,
                borderRadius: theme.radius.pill,
                // Before the first layout pass, paint the active option directly.
                backgroundColor:
                  active && !target
                    ? theme.colors.surfaceRaised
                    : "transparent",
                opacity: pressed && !reducedMotion ? 0.84 : 1,
              },
            ]}
          >
            <AppText
              variant={isCompact ? "caption" : "label"}
              color={active ? "text" : "textSecondary"}
              numberOfLines={1}
            >
              {opt.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const THUMB_SPRING = { damping: 24, stiffness: 300, mass: 0.8 } as const;

const styles = StyleSheet.create({
  thumb: {
    position: "absolute",
    left: 0,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  option: {
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionFill: {
    flex: 1,
  },
});
