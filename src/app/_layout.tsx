import React, { useCallback, useEffect, useState } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initRepo } from '@/data/db';
import { DEFAULT_SETTINGS, type Repo } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';
import { ErrorState } from '@/ui/ErrorState';
import { Screen } from '@/ui/Screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppNavigator() {
  const { colorScheme, theme } = useTheme();

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
        <Stack.Screen
          name="transaction/new"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
        <ThemeProvider preference={DEFAULT_SETTINGS.theme}>
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
        <ThemeProvider preference={repoState.settings.theme}>
          <AppNavigator />
        </ThemeProvider>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
