import React, { useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { useLocale } from "@/i18n";
import { useTheme } from "@/theme/useTheme";
import { AppText, estimateSingleLineMinWidth } from "./AppText";
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
  const locale = useLocale();
  const isCompact = size === "sm";
  const padding = 3;
  const itemMinHeight = isCompact ? 32 : theme.touch.min - padding * 2;
  const thumbBg = theme.colors.accent;

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
        isCompact && styles.compactNoShrink,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
          padding,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={[styles.track, !isCompact && styles.trackFill]}>
        {target ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              theme.elevation.e1,
              {
                top: 0,
                bottom: 0,
                borderRadius: 999,
                backgroundColor: thumbBg,
              },
              thumbStyle,
            ]}
          />
        ) : null}
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <PressableScale
              pressScale={0.99}
              key={`${opt.value}:${opt.label}`}
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
                isCompact ? styles.compactOption : styles.optionFill,
                {
                  minHeight: itemMinHeight,
                  paddingHorizontal: isCompact
                    ? theme.spacing.sm + 3
                    : theme.spacing.md,
                  borderRadius: theme.radius.pill,
                  backgroundColor: active && !target ? thumbBg : "transparent",
                  opacity: pressed && !reducedMotion ? 0.88 : 1,
                },
              ]}
            >
              <AppText
                variant={isCompact ? "caption" : "label"}
                color={active ? "onAccent" : "textSecondary"}
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    fontFamily: active ? "Manrope_700Bold" : "Manrope_600SemiBold",
                  },
                  !isCompact && styles.labelStretch,
                  isCompact && locale === "bn"
                    ? { minWidth: estimateSingleLineMinWidth(opt.label, 13) }
                    : null,
                ]}
              >
                {opt.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
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
  track: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trackFill: {
    flex: 1,
  },
  compactNoShrink: {
    flexShrink: 0,
  },
  option: {
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compactOption: {
    flexShrink: 0,
    minWidth: 58,
  },
  optionFill: {
    flex: 1,
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  labelStretch: {
    alignSelf: "stretch",
  },
});
