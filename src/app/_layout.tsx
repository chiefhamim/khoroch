import { useOnboardingPreview } from "@/state/onboardingPreview";
import React, { useCallback, useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { HindSiliguri_400Regular } from "@expo-google-fonts/hind-siliguri/400Regular";
import { HindSiliguri_500Medium } from "@expo-google-fonts/hind-siliguri/500Medium";
import { HindSiliguri_600SemiBold } from "@expo-google-fonts/hind-siliguri/600SemiBold";
import { HindSiliguri_700Bold } from "@expo-google-fonts/hind-siliguri/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { isDevVariant } from "@/config/appVariant";

import { initRepo } from "@/data/db";
import { DEFAULT_SETTINGS, type Repo } from "@/data/repo";
import { normalizeAppLanguage, type Settings } from "@/domain/types";
import { setLocale, t } from "@/i18n";
import {
  configureNotificationHandler,
  subscribeToCheckInResponses,
  syncReminderSchedule,
} from "@/notifications/reminders";
import { AppContext, useAppContext } from "@/state/AppContext";
import { bumpDataVersion } from "@/state/dataVersion";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/useTheme";
import { ErrorState } from "@/ui/ErrorState";
import { setHapticsEnabled } from "@/ui/haptics";
import { Screen } from "@/ui/Screen";
import { ToastProvider } from "@/ui/Toast";

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

function AppNavigator() {
  const { colorScheme, theme } = useTheme();
  const { settings } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const previewOnboarding = useOnboardingPreview((st) => st.on);

  useEffect(() => {
    if (!navigationState?.key) return;
    const inOnboarding = segments[0] === "onboarding";
    const inDev = isDevVariant() && (segments[0] as string) === "dev";
    if (!settings.onboardingDone && !inOnboarding && !inDev) {
      router.replace("/onboarding");
    } else if (settings.onboardingDone && inOnboarding && !previewOnboarding) {
      router.replace("/(tabs)");
    }
  }, [navigationState?.key, settings.onboardingDone, segments, router, previewOnboarding]);

  useEffect(() => {
    if (!navigationState?.key || !settings.onboardingDone) return;
    return subscribeToCheckInResponses(() => {
      router.push("/check-in");
    });
  }, [navigationState?.key, settings.onboardingDone, router]);

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          // Native-thread transitions: iOS-style parallax slide on Android, swipe back.
          animation: "ios_from_right",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/new"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="transfer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="wallets/index" options={{ headerShown: false }} />
        <Stack.Screen name="wallets/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="people/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="quick-entry"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            headerShown: false,
          }}
        />
        <Stack.Screen name="check-in" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings/categories"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="plan/insights" options={{ headerShown: false }} />
        <Stack.Screen name="dev/gallery" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    HindSiliguri_400Regular,
    HindSiliguri_500Medium,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
    NotoSansBengali_400Regular: require("../../assets/fonts/NotoSansBengali-Regular.ttf"),
    NotoSansBengali_500Medium: require("../../assets/fonts/NotoSansBengali-Medium.ttf"),
    NotoSansBengali_600SemiBold: require("../../assets/fonts/NotoSansBengali-SemiBold.ttf"),
    NotoSansBengali_700Bold: require("../../assets/fonts/NotoSansBengali-Bold.ttf"),
    AnekBangla_400Regular: require("../../assets/fonts/AnekBangla-Regular.ttf"),
    AnekBangla_500Medium: require("../../assets/fonts/AnekBangla-Medium.ttf"),
    AnekBangla_600SemiBold: require("../../assets/fonts/AnekBangla-SemiBold.ttf"),
    AnekBangla_700Bold: require("../../assets/fonts/AnekBangla-Bold.ttf"),
    SolaimanLipi_400Regular: require("../../assets/fonts/SolaimanLipi.ttf"),
    SolaimanLipi_700Bold: require("../../assets/fonts/SolaimanLipi-Bold.ttf"),
    Kalpurush_400Regular: require("../../assets/fonts/Kalpurush.ttf"),
    NikoshBAN_400Regular: require("../../assets/fonts/NikoshBAN.ttf"),
    SutonnyOMJ_400Regular: require("../../assets/fonts/SutonnyOMJ.ttf"),
  });

  const [repoState, setRepoState] = useState<{
    repo: Repo;
    backend: "sqlite" | "memory";
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
          setLocale(normalizeAppLanguage(settings.language));
          setHapticsEnabled(settings.hapticsEnabled !== false);
          setRepoState({ repo, backend, settings });
          if (
            settings.onboardingDone &&
            settings.reminder.enabled &&
            !settings.notificationPermissionDenied
          ) {
            // Re-sync on app start so timezone changes take effect without duplicate triggers.
            syncReminderSchedule(settings.reminder).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) {
          setDbError(t("error.dbInitBody"));
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

  const ready =
    (fontsLoaded || Boolean(fontError)) &&
    (repoState !== null || dbError !== null);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  const refreshSettings = useCallback(async () => {
    if (!repoState) return;
    const latest = await repoState.repo.getSettings();
    setLocale(normalizeAppLanguage(latest.language));
    setHapticsEnabled(latest.hapticsEnabled !== false);
    setRepoState((prev) => (prev ? { ...prev, settings: latest } : null));
  }, [repoState]);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      if (!repoState) return;
      if (key === "language") {
        setLocale(normalizeAppLanguage(value));
      }
      if (key === "hapticsEnabled") {
        setHapticsEnabled(value !== false);
      }
      await repoState.repo.setSetting(key, value);
      const latest = await repoState.repo.getSettings();
      setLocale(normalizeAppLanguage(latest.language));
      setHapticsEnabled(latest.hapticsEnabled !== false);
      setRepoState((prev) => (prev ? { ...prev, settings: latest } : null));
      bumpDataVersion();
    },
    [repoState],
  );

  if (!ready) {
    return null;
  }

  if (dbError || !repoState) {
    return (
      <SafeAreaProvider>
        <ThemeProvider
          preference={DEFAULT_SETTINGS.theme}
          accent={DEFAULT_SETTINGS.accent}
          banglaFont={DEFAULT_SETTINGS.banglaFont}
          incomeColor={DEFAULT_SETTINGS.incomeColor}
          expenseColor={DEFAULT_SETTINGS.expenseColor}
        >
          <Screen>
            <ErrorState
              title={t("error.dbInitTitle")}
              body={dbError ?? t("error.dbInitBody")}
              retryLabel={t("common.retry")}
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
        <ThemeProvider
          preference={repoState.settings.theme}
          accent={repoState.settings.accent}
          banglaFont={repoState.settings.banglaFont}
          incomeColor={repoState.settings.incomeColor}
          expenseColor={repoState.settings.expenseColor}
        >
          <KeyboardProvider>
            <ToastProvider>
              <AppNavigator />
            </ToastProvider>
          </KeyboardProvider>
        </ThemeProvider>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
