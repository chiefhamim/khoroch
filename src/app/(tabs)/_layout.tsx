import React, { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Easing as RNEasing, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";

import { t } from "@/i18n";
import { useTheme } from "@/theme/useTheme";
import { AppIcon, type AppIconName } from "@/ui/AppIcon";
import { AppText } from "@/ui/AppText";
import { hapticLight, hapticMedium, hapticSelection } from "@/ui/haptics";
import { TAB_BAR_CONTENT_HEIGHT, useTabBarHeight } from "@/ui/Screen";
import { PressableScale } from "@/ui/PressableScale";
import { GlassContext } from "@/ui/glass";

export type V2TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

interface TabItemConfig {
  routeName: "index" | "ledger" | "plan" | "people";
  labelKey: "tabs.overview" | "tabs.ledger" | "tabs.plan" | "tabs.people";
  icon: AppIconName;
}

const LEFT_TABS: TabItemConfig[] = [
  { routeName: "index", labelKey: "tabs.overview", icon: "house" },
  { routeName: "ledger", labelKey: "tabs.ledger", icon: "scroll-text" },
];

const RIGHT_TABS: TabItemConfig[] = [
  { routeName: "plan", labelKey: "tabs.plan", icon: "target" },
  { routeName: "people", labelKey: "tabs.people", icon: "users" },
];

export function V2TabBar({ state, emitter, navigateToTab }: V2TabBarProps) {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const bottomPadding = Math.max(tabBarHeight - TAB_BAR_CONTENT_HEIGHT, 10);

  const activeRouteName = state.routes[state.index]?.name;

  const renderTab = (tab: TabItemConfig) => {
    const route = state.routes.find((r) => r.name === tab.routeName);
    const isFocused = activeRouteName === tab.routeName;
    const color = isFocused ? theme.colors.accent : theme.colors.textTertiary;

    const handlePress = () => {
      if (!route) return;
      const event = emitter.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        hapticSelection();
        navigateToTab(route.key);
      }
    };

    const handleLongPress = () => {
      if (!route) return;
      emitter.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    return (
      <PressableScale
        pressScale={0.98}
        key={tab.routeName}
        testID={`tab-item-${tab.routeName}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={t(tab.labelKey)}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={({ pressed }) => [
          styles.tabSlot,
          {
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.tabPill,
            {
              borderRadius: 999,
              backgroundColor: isFocused ? theme.colors.accentSoft : "transparent",
              borderWidth: isFocused ? 1 : 0,
              borderColor: isFocused ? theme.colors.cardBorder : "transparent",
            },
          ]}
        >
          <TabIcon
            icon={tab.icon}
            focused={isFocused}
            color={color}
            reducedMotion={reducedMotion}
          />
        </View>
        <AppText variant="tab" numberOfLines={1} style={[styles.tabLabel, { color }]}>
          {t(tab.labelKey)}
        </AppText>
      </PressableScale>
    );
  };

  return (
    <View
      testID="v2-tab-bar"
      style={[
        styles.bar,
        {
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.separator,
        },
        theme.elevation.tabBar,
      ]}
    >
      {LEFT_TABS.map(renderTab)}

      <View style={styles.addSlot}>
        <PressableScale
          pressScale={0.9}
          testID="tab-add-button"
          accessibilityRole="button"
          accessibilityLabel={t("tabs.addAccessibility")}
          accessibilityHint={t("tabs.addHint")}
          onPress={() => {
            hapticLight();
            router.push("/transaction/new");
          }}
          onLongPress={() => {
            hapticMedium();
            router.push("/quick-entry");
          }}
          style={({ pressed }) => [
            styles.addSquircle,
            theme.elevation.e2,
            {
              backgroundColor: theme.colors.accent,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <AppIcon
            name="plus"
            size={22}
            strokeWidth={2.25}
            color={theme.colors.onAccent}
          />
        </PressableScale>
      </View>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}

/** Selected tab icon lifts slightly with a spring; unselected settles back. */
function TabIcon({
  icon,
  focused,
  color,
  reducedMotion,
}: {
  icon: AppIconName;
  focused: boolean;
  color: string;
  reducedMotion: boolean;
}) {
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    lift.set(
      reducedMotion
        ? focused
          ? 1
          : 0
        : withSpring(focused ? 1 : 0, {
            damping: 14,
            stiffness: 260,
            mass: 0.7,
          }),
    );
  }, [focused, lift, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -1.5 * lift.get() },
      { scale: 1 + 0.08 * lift.get() },
    ],
  }));
  return (
    <Animated.View style={style}>
      <AppIcon
        name={icon}
        size={20}
        strokeWidth={focused ? 2.1 : 1.75}
        color={color}
      />
    </Animated.View>
  );
}

/** Tab scenes glide sideways with a soft cross-fade and a long, gentle deceleration. */
const glideInterpolator: NonNullable<
  React.ComponentProps<typeof Tabs>["screenOptions"] extends infer O
    ? O extends { sceneStyleInterpolator?: infer I }
      ? { sceneStyleInterpolator?: I }
      : never
    : never
>["sceneStyleInterpolator"] = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, -0.35, 0, 0.35, 1],
      outputRange: [0, 0.15, 1, 0.15, 0],
    }),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-70, 0, 70],
        }),
      },
    ],
  },
});

const GLIDE_SPEC = {
  animation: "timing" as const,
  config: { duration: 380, easing: RNEasing.bezier(0.22, 1, 0.36, 1) },
};

const APP_GLASS = { tint: null, backdrop: 0.6 };

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <GlassContext.Provider value={APP_GLASS}>
    <Tabs
      screenOptions={{
        headerShown: false,
        // Short horizontal shift between tabs, run with the native driver.
        animation: "shift",
        sceneStyleInterpolator: glideInterpolator,
        transitionSpec: GLIDE_SPEC,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
      tabBar={(props) => <V2TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.overview") }} />
      <Tabs.Screen name="ledger" options={{ title: t("tabs.ledger") }} />
      <Tabs.Screen name="plan" options={{ title: t("tabs.plan") }} />
      <Tabs.Screen name="people" options={{ title: t("tabs.people") }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="budget" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
    </Tabs>
    </GlassContext.Provider>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabSlot: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabPill: {
    width: 58,
    height: 32,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    alignSelf: "stretch",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  addSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addSquircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
