import React, { useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { AppText, estimateSingleLineMinWidth } from "./AppText";
import { hapticSelection } from "./haptics";
import { PressableScale } from "@/ui/PressableScale";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testID?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
  /** "hero" renders on the dark HeroCard fill using the hero palette. */
  tone?: "default" | "hero";
  disabled?: boolean;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  tone = "default",
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const { theme, reducedMotion } = useTheme();
  const isCompact = size === "sm";
  const padding = 3;
  const isHero = tone === "hero";
  const itemMinHeight = isCompact ? theme.geometry.chipVisualHeight : theme.touch.min - padding * 2;

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
        isCompact && !isHero && styles.compactNoShrink,
        isHero && styles.heroContainer,
        {
          backgroundColor: isHero ? theme.colors.heroLine : theme.colors.surfaceSunken,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: isHero ? theme.colors.heroLine : theme.colors.cardBorder,
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
            theme.elevation.e1,
            {
              top: padding,
              bottom: padding,
              borderRadius: theme.radius.pill,
              // Dark mode: a solid light thumb so the selection is unmistakable.
              backgroundColor: isHero
                ? theme.colors.heroText
                : theme.scheme === "dark"
                  ? theme.colors.ink
                  : theme.colors.surfaceRaised,
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
            key={`${opt.value}:${opt.label}`}
            testID={opt.testID}
            disabled={disabled}
            hitSlop={isCompact ? { top: theme.spacing.sm, bottom: theme.spacing.sm } : undefined}
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
              isCompact && !isHero ? styles.compactOption : styles.optionFill,
              {
                minHeight: itemMinHeight,
                paddingHorizontal: isCompact
                  ? theme.spacing.sm + 2
                  : theme.spacing.md,
                borderRadius: theme.radius.pill,
                backgroundColor:
                  active && !target
                    ? isHero
                      ? theme.colors.heroText
                      : theme.scheme === "dark"
                        ? theme.colors.ink
                        : theme.colors.surfaceRaised
                    : "transparent",
                opacity: pressed && !reducedMotion ? 0.86 : 1,
              },
            ]}
          >
            <AppText
              variant={isCompact ? "caption" : "label"}
              color={
                isHero
                  ? active
                    ? "hero"
                    : "heroTextSecondary"
                  : active
                    ? theme.scheme === "dark"
                      ? "onInk"
                      : "text"
                    : "textSecondary"
              }
              numberOfLines={1}
              adjustsFontSizeToFit={isHero}
              minimumFontScale={isHero ? HERO_MIN_FONT_SCALE : undefined}
              style={[
                styles.label,
                (!isCompact || isHero) && styles.labelStretch,
                isCompact && !isHero
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
  );
}

const HERO_MIN_FONT_SCALE = 0.85;
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
  heroContainer: {
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
    minWidth: 68,
  },
  optionFill: {
    flex: 1,
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    textAlign: "center",
  },
  labelStretch: {
    alignSelf: "stretch",
  },
});
