import React, { useCallback, useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { HindSiliguri_500Medium } from '@expo-google-fonts/hind-siliguri/500Medium';
import { HindSiliguri_600SemiBold } from '@expo-google-fonts/hind-siliguri/600SemiBold';
import { HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri/700Bold';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isDevVariant } from '@/config/appVariant';

import { initRepo } from '@/data/db';
import { DEFAULT_SETTINGS, type Repo } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { t } from '@/i18n';
import {
  configureNotificationHandler,
  subscribeToCheckInResponses,
  syncReminderSchedule,
} from '@/notifications/reminders';
import { AppContext, useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';
import { ErrorState } from '@/ui/ErrorState';
import { Screen } from '@/ui/Screen';
import { ToastProvider } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

function AppNavigator() {
  const { colorScheme, theme } = useTheme();
  const { settings } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;
    const inOnboarding = segments[0] === 'onboarding';
    const inDev = isDevVariant() && (segments[0] as string) === 'dev';
    if (!settings.onboardingDone && !inOnboarding && !inDev) {
      router.replace('/onboarding');
    } else if (settings.onboardingDone && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [navigationState?.key, settings.onboardingDone, segments, router]);

  useEffect(() => {
    if (!navigationState?.key || !settings.onboardingDone) return;
    return subscribeToCheckInResponses(() => {
      router.push('/check-in');
    });
  }, [navigationState?.key, settings.onboardingDone, router]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/new"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="transfer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="wallets/index" options={{ headerShown: false }} />
        <Stack.Screen name="wallets/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="quick-entry"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen name="check-in" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/categories" options={{ headerShown: false }} />
        <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="plan/insights" options={{ headerShown: false }} />
        <Stack.Screen name="dev/gallery" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });

  const [repoState, setRepoState] = useState<{
    repo: Repo;
    backend: 'sqlite' | 'memory';
    settings: Settings;
  } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { repo, backend } = await initRepo();
        const settings = await repo.getSettings();
        if (!cancelled) {
          setRepoState({ repo, backend, settings });
          if (settings.onboardingDone && settings.reminder.enabled && !settings.notificationPermissionDenied) {
            // Re-sync on app start so timezone changes take effect without duplicate triggers.
            syncReminderSchedule(settings.reminder).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) {
          setDbError(t('error.dbInitBody'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  const handleRetryBoot = useCallback(() => {
    setDbError(null);
    setBootAttempt((n) => n + 1);
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && (repoState !== null || dbError !== null);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  const refreshSettings = useCallback(async () => {
    if (!repoState) return;
    const latest = await repoState.repo.getSettings();
    setRepoState((prev) => (prev ? { ...prev, settings: latest } : null));
  }, [repoState]);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      if (!repoState) return;
      await repoState.repo.setSetting(key, value);
      const latest = await repoState.repo.getSettings();
      setRepoState((prev) => (prev ? { ...prev, settings: latest } : null));
      bumpDataVersion();
    },
    [repoState]
  );

  if (!ready) {
    return null;
  }

  if (dbError || !repoState) {
    return (
      <SafeAreaProvider>
        <ThemeProvider preference={DEFAULT_SETTINGS.theme} accent={DEFAULT_SETTINGS.accent}>
          <Screen>
            <ErrorState
              title={t('error.dbInitTitle')}
              body={dbError ?? t('error.dbInitBody')}
              retryLabel={t('common.retry')}
              onRetry={handleRetryBoot}
            />
          </Screen>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContext.Provider
        value={{
          repo: repoState.repo,
          backend: repoState.backend,
          settings: repoState.settings,
          updateSetting,
          refreshSettings,
        }}
      >
        <ThemeProvider preference={repoState.settings.theme} accent={repoState.settings.accent}>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </ThemeProvider>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
