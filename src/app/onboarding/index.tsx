import React, { useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { CoinScene } from '@/ui/CoinScene';
import { hapticSelection } from '@/ui/haptics';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';

const CHIPS: readonly { icon: AppIconName; key: 'onboarding.chipPrivate' | 'onboarding.chipOffline' | 'onboarding.chipFast' }[] = [
  { icon: 'lock', key: 'onboarding.chipPrivate' },
  { icon: 'shield-check', key: 'onboarding.chipOffline' },
  { icon: 'zap', key: 'onboarding.chipFast' },
];

export default function OnboardingWelcomeScreen() {
  const { theme, reducedMotion, locale } = useTheme();
  const router = useRouter();
  const appCtx = useContext(AppContext);
  const { language, setLanguage } = useOnboardingDraft();

  useEffect(() => {
    if (language !== locale) {
      setLanguage(locale);
    }
  }, [language, locale, setLanguage]);

  // The taka mark settles in with a soft spring-like ease.
  const mark = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    mark.set(withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
  }, [mark, reducedMotion]);
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.get(),
    transform: [{ scale: 0.86 + 0.14 * mark.get() }],
  }));

  const handleSelectLanguage = (nextLang: 'en' | 'bn') => {
    hapticSelection();
    setLocale(nextLang);
    setLanguage(nextLang);
    if (appCtx) {
      const updater = appCtx.updateSetting as (key: string, value: unknown) => Promise<void>;
      void updater('language', nextLang);
    }
  };

  const enter = (delay: number) =>
    reducedMotion ? undefined : FadeInDown.delay(delay).duration(480).easing(Easing.out(Easing.cubic));

  return (
    <Screen style={{ backgroundColor: 'transparent' }} scroll edges={['top', 'bottom', 'left', 'right']} contentContainerStyle={styles.container}>
      <View style={{ flex: 1, gap: theme.spacing.xl }}>
        <View style={styles.topRow}>
          <AppText variant="headline" style={styles.wordmark}>
            {t('app.name')}
          </AppText>
          <View
            style={[
              styles.langGroup,
              { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill },
            ]}
          >
            {(['en', 'bn'] as const).map((lang) => {
              const selected = locale === lang;
              const label = lang === 'en' ? t('settings.languageEn') : t('settings.languageBn');
              return (
                <PressableScale
                  key={lang}
                  pressScale={0.96}
                  testID={`onboarding-lang-${lang}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={() => handleSelectLanguage(lang)}
                  style={[
                    styles.langBtn,
                    selected ? theme.elevation.e1 : null,
                    {
                      borderRadius: theme.radius.pill,
                      backgroundColor: selected ? theme.colors.accent : 'transparent',
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      fontFamily: 'Manrope_700Bold',
                      color: selected ? theme.colors.onAccent : theme.colors.textSecondary,
                    }}
                  >
                    {label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.middle}>
        <Animated.View entering={enter(60)}>
          <CoinScene />
        </Animated.View>

        <Animated.View entering={enter(180)} style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
          <AppText variant="display" style={styles.title}>
            {t('onboarding.notebookTitle')}
          </AppText>
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            {t('onboarding.notebookSubtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(300)} style={styles.chips}>
          {CHIPS.map((chip) => (
            <View
              key={chip.key}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.cardBorder,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <AppIcon name={chip.icon} size={14} color={theme.colors.accent} />
              <AppText variant="caption" color="textSecondary" style={styles.chipText}>
                {t(chip.key)}
              </AppText>
            </View>
          ))}
        </Animated.View>
        </View>
      </View>

      <Animated.View entering={enter(420)} style={{ paddingTop: theme.spacing.xl }}>
        <Button
          testID="onboarding-welcome-continue"
          tint="#4338CA"
          title={t('onboarding.openNotebookCta')}
          rightIcon="chevron-right"
          onPress={() => router.push('/onboarding/preferences')}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: 'Manrope_700Bold',
    letterSpacing: -0.4,
  },
  langGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 2,
  },
  langBtn: {
    paddingHorizontal: 14,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
    paddingBottom: 24,
  },
  heroTile: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRing: {
    width: 148,
    height: 148,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCore: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
  },
  subtitle: {
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'Manrope_600SemiBold',
  },
});
