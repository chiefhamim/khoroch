import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

export default function TabsLayout() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabBarHeight = theme.touch.min + theme.spacing.xl + insets.bottom;
  const fabSize = theme.touch.min + theme.spacing.sm;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: theme.spacing.xs,
            paddingBottom: Math.max(insets.bottom, theme.spacing.xs),
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            paddingVertical: theme.spacing.xs,
          },
          tabBarLabelStyle: {
            fontFamily: theme.typography.caption.fontFamily,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.overview'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.textMuted}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: t('tabs.activity'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'list' : 'list-outline'}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.textMuted}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: t('tabs.budget'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'pie-chart' : 'pie-chart-outline'}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.textMuted}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: t('tabs.insights'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'trending-up' : 'trending-up-outline'}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.textMuted}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={22}
                color={focused ? theme.colors.primary : theme.colors.textMuted}
              />
            ),
          }}
        />
      </Tabs>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.addAccessibility')}
        onPress={() => router.push('/transaction/new')}
        style={({ pressed }) => [
          styles.fab,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            right: theme.spacing.xl,
            bottom: tabBarHeight + theme.spacing.lg,
            opacity: pressed && !reducedMotion ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={theme.colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
});
