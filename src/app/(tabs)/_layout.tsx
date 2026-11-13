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
  routeName: 'index' | 'ledger' | 'plan' | 'people';
  labelKey: 'tabs.overview' | 'tabs.ledger' | 'tabs.plan' | 'tabs.people';
  icon: AppIconName;
}

const LEFT_TABS: TabItemConfig[] = [
  { routeName: 'index', labelKey: 'tabs.overview', icon: 'house' },
  { routeName: 'ledger', labelKey: 'tabs.ledger', icon: 'scroll-text' },
];

const RIGHT_TABS: TabItemConfig[] = [
  { routeName: 'plan', labelKey: 'tabs.plan', icon: 'target' },
  { routeName: 'people', labelKey: 'tabs.people', icon: 'users' },
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
    const color = isFocused ? theme.colors.text : theme.colors.textTertiary;

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
          size={20}
          strokeWidth={isFocused ? 2.1 : 1.75}
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
          backgroundColor: theme.colors.bg,
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
            styles.addSquircle,
            {
              backgroundColor: theme.colors.ink,
              transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <AppIcon
            name="plus"
            size={22}
            strokeWidth={2.25}
            color={theme.colors.onInk}
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
      <Tabs.Screen name="ledger" options={{ title: t('tabs.ledger') }} />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan') }} />
      <Tabs.Screen name="people" options={{ title: t('tabs.people') }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="budget" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
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
  addSquircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
