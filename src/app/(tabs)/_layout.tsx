import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';

import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { hapticLight, hapticMedium } from '@/ui/haptics';
import { TAB_BAR_CONTENT_HEIGHT, useTabBarHeight } from '@/ui/Screen';

export type V2TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

interface TabItemConfig {
  routeName: 'index' | 'activity' | 'budget' | 'insights';
  labelKey: 'tabs.overview' | 'tabs.activity' | 'tabs.budget' | 'tabs.insights';
  icon: AppIconName;
}

const LEFT_TABS: TabItemConfig[] = [
  { routeName: 'index', labelKey: 'tabs.overview', icon: 'house' },
  { routeName: 'activity', labelKey: 'tabs.activity', icon: 'list' },
];

const RIGHT_TABS: TabItemConfig[] = [
  { routeName: 'budget', labelKey: 'tabs.budget', icon: 'pie-chart' },
  { routeName: 'insights', labelKey: 'tabs.insights', icon: 'chart-column' },
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
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigateToTab(route.key);
      }
    };

    const handleLongPress = () => {
      if (!route) return;
      emitter.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    return (
      <Pressable
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
        <AppIcon
          name={tab.icon}
          size={22}
          strokeWidth={isFocused ? 2 : 1.75}
          color={color}
        />
        <AppText
          variant="tab"
          numberOfLines={1}
          style={{ color }}
        >
          {t(tab.labelKey)}
        </AppText>
      </Pressable>
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
      ]}
    >
      {LEFT_TABS.map(renderTab)}

      <View style={styles.addSlot}>
        <Pressable
          testID="tab-add-button"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.addAccessibility')}
          accessibilityHint={t('tabs.addHint')}
          onPress={() => {
            hapticLight();
            router.push('/transaction/new');
          }}
          onLongPress={() => {
            hapticMedium();
            router.push('/quick-entry');
          }}
          style={({ pressed }) => [
            styles.addCircle,
            {
              backgroundColor: theme.colors.accent,
              shadowColor: theme.colors.accent,
              transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
              opacity: pressed ? 0.9 : 1,
            },
            theme.scheme === 'light' ? styles.addShadowLight : styles.addShadowDark,
          ]}
        >
          <AppIcon
            name="plus"
            size={26}
            strokeWidth={2.25}
            color={theme.colors.onAccent}
          />
        </Pressable>
      </View>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <V2TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.overview') }} />
      <Tabs.Screen name="activity" options={{ title: t('tabs.activity') }} />
      <Tabs.Screen name="budget" options={{ title: t('tabs.budget') }} />
      <Tabs.Screen name="insights" options={{ title: t('tabs.insights') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabSlot: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addShadowLight: {
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  addShadowDark: {
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
});
