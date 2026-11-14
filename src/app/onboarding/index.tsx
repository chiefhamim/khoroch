import React, { useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { setLocale, t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { hapticSelection } from '@/ui/haptics';
import { IconTile } from '@/ui/IconTile';
import { Money } from '@/ui/Money';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

export default function OnboardingWelcomeScreen() {
  const { theme, reducedMotion, locale } = useTheme();
  const router = useRouter();
  const appCtx = useContext(AppContext);
  const { currency, language, setLanguage } = useOnboardingDraft();

  useEffect(() => {
    if (language !== locale) {
      setLanguage(locale);
    }
  }, [language, locale, setLanguage]);

  const activeLang = locale;

  const handleSelectLanguage = (nextLang: 'en' | 'bn') => {
    hapticSelection();
    setLocale(nextLang);
    setLanguage(nextLang);
    if (appCtx) {
      const updater = appCtx.updateSetting as (key: string, value: unknown) => Promise<void>;
      void updater('language', nextLang);
    }
  };

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.md }}>
        {/* Top bar with prominent English | বাংলা selector */}
        <View style={styles.topLangRow}>
          <View
            style={[
              styles.brandBadge,
              {
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.sm,
              },
            ]}
          >
            <AppText variant="caption" color="accent" style={styles.brandBadgeText}>
              {t('app.tagline')}
            </AppText>
          </View>

          <View
            style={[
              styles.langPillGroup,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderColor: 'transparent',
                borderRadius: theme.radius.md,
              },
            ]}
          >
            {(['en', 'bn'] as const).map((lang) => {
              const selected = activeLang === lang;
              const label =
                lang === 'en' ? t('settings.languageEn') : t('settings.languageBn');
              return (
                <PressableScale
                  key={lang}
                  pressScale={0.96}
                  testID={`onboarding-lang-${lang}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={() => handleSelectLanguage(lang)}
                  style={({ pressed }) => [
                    styles.langPillBtn,
                    selected ? theme.elevation.e1 : null,
                    {
                      backgroundColor: selected ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.sm,
                      opacity: pressed && !reducedMotion ? 0.85 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.langPillText,
                      {
                        color: selected ? theme.colors.onAccent : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <OnboardingHeader
          step={1}
          title={t('onboarding.notebookTitle')}
          subtitle={t('onboarding.notebookSubtitle')}
        />

        {/* Live Daybook Sheet Preview Card */}
        <Surface padded={false}>
          <View
            style={[
              styles.heroHeader,
              {
                backgroundColor: theme.colors.hero,
                paddingHorizontal: 14,
                paddingVertical: 12,
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <AppText
                variant="caption"
                color="heroTextSecondary"
                style={styles.heroMetaText}
              >
                {t('onboarding.previewDayHeader')}
              </AppText>
              <View style={styles.safeTodayInline}>
                <AppText
                  variant="caption"
                  color="heroTextSecondary"
                  style={styles.heroMetaText}
                >
                  {`${t('onboarding.previewSafeToday')}: `}
                </AppText>
                <Money
                  amountMinor={117600}
                  currency={currency}
                  variant="caption"
                  color="heroText"
                  style={styles.heroMetaText}
                />
              </View>
            </View>

            <View style={[styles.rowBetween, { marginTop: 8 }]}>
              <View style={{ gap: 2 }}>
                <AppText variant="caption" color="heroTextSecondary">
                  {t('onboarding.previewStartedWith')}
                </AppText>
                <Money
                  amountMinor={653150}
                  currency={currency}
                  variant="headline"
                  color="heroText"
                  showDecimals
                />
              </View>
              <View style={styles.rightCol}>
                <AppText variant="caption" color="heroTextSecondary">
                  {t('onboarding.previewLeftNow')}
                </AppText>
                <Money
                  amountMinor={597150}
                  currency={currency}
                  variant="headline"
                  color="heroBar"
                  showDecimals
                />
              </View>
            </View>
          </View>

          <View style={styles.sampleRow}>
            <IconTile icon="utensils" colorKey="orange" size={34} />
            <View style={styles.sampleMid}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {t('onboarding.previewSample1Title')}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {t('onboarding.previewSample1Sub')}
              </AppText>
            </View>
            <Money
              amountMinor={-48000}
              currency={currency}
              variant="bodyStrong"
              color="text"
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: theme.colors.separator,
            }}
          />

          <View style={styles.sampleRow}>
            <IconTile icon="car" colorKey="blue" size={34} />
            <View style={styles.sampleMid}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {t('onboarding.previewSample2Title')}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {t('onboarding.previewSample2Sub')}
              </AppText>
            </View>
            <Money
              amountMinor={-8000}
              currency={currency}
              variant="bodyStrong"
              color="text"
            />
          </View>
        </Surface>

        {/* Trust & Privacy Ledger Footer */}
        <Surface variant="sunken" padding={12}>
          <View style={styles.trustRow}>
            <AppText variant="caption" color="text" style={styles.trustText}>
              {`✓ ${t('onboarding.trustBadge1')}`}
            </AppText>
            <AppText variant="caption" color="text" style={styles.trustText}>
              {`✓ ${t('onboarding.trustBadge2')}`}
            </AppText>
          </View>
        </Surface>
      </View>

      <View style={{ paddingTop: theme.spacing.md }}>
        <Button
          testID="onboarding-welcome-continue"
          title={t('onboarding.openNotebookCta')}
          rightIcon="chevron-right"
          onPress={() => router.push('/onboarding/preferences')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brandBadgeText: {
    fontFamily: 'Manrope_700Bold',
  },
  langPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  langPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
  },
  heroHeader: {},
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  safeTodayInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 11,
  },
  sampleMid: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
  },
});
