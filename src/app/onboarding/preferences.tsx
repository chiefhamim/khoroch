import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { todayLocalDate } from '@/domain/dates';
import { formatCycleLabel, getPeriod } from '@/domain/period';
import {
  CURRENCIES,
  type AccentTheme,
  type CurrencyCode,
  type ThemePreference,
} from '@/domain/types';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { ACCENT_DEFINITIONS } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Field } from '@/ui/Field';
import { hapticSelection } from '@/ui/haptics';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BDT: 'BDT (৳)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
};

const THEME_MODES: readonly { key: ThemePreference; labelKey: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark' | 'settings.themeBlack' }[] = [
  { key: 'system', labelKey: 'settings.themeSystem' },
  { key: 'light', labelKey: 'settings.themeLight' },
  { key: 'dark', labelKey: 'settings.themeDark' },
  { key: 'black', labelKey: 'settings.themeBlack' },
];

const ACCENT_SWATCHES: readonly AccentTheme[] = [
  'forest',
  'ocean',
  'saffron',
  'plum',
  'graphite',
];

export default function OnboardingPreferencesScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const appCtx = useContext(AppContext);
  const {
    name,
    currency,
    monthStartDay,
    theme: draftTheme,
    accent: draftAccent,
    setName,
    setCurrency,
    setMonthStartDay,
    setTheme,
    setAccent,
  } = useOnboardingDraft();

  const cyclePreview = formatCycleLabel(
    getPeriod(todayLocalDate(), monthStartDay),
    monthStartDay,
    { includeYear: false }
  );

  const cycleShortcuts = [
    { day: 1, label: t('onboarding.cyclePreset1') },
    { day: 5, label: t('onboarding.cyclePreset5') },
    { day: 7, label: t('onboarding.cyclePreset7') },
    { day: 10, label: t('onboarding.cyclePreset10') },
    { day: 25, label: t('onboarding.cyclePreset25') },
  ];

  const handleSelectTheme = (nextTheme: ThemePreference) => {
    hapticSelection();
    setTheme(nextTheme);
    if (appCtx) {
      void appCtx.updateSetting('theme', nextTheme);
    }
  };

  const handleSelectAccent = (nextAccent: AccentTheme) => {
    hapticSelection();
    setAccent(nextAccent);
    if (appCtx) {
      void appCtx.updateSetting('accent', nextAccent);
    }
  };

  const stepCycleDay = (delta: number) => {
    hapticSelection();
    const next = monthStartDay + delta;
    const wrapped = next < 1 ? 28 : next > 28 ? 1 : next;
    setMonthStartDay(wrapped);
  };

  return (
    <Screen
      style={{ backgroundColor: 'transparent' }}
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.md }}>
        <OnboardingHeader
          step={2}
          title={t('onboarding.prefsTitle')}
          subtitle={t('onboarding.prefsSubtitle')}
        />

        {/* Structured Register Card */}
        <Surface padded={false}>
          {/* Row 1: Owner Name */}
          <View style={styles.registerSection}>
            <View style={styles.rowHeader}>
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">{t('onboarding.ownerNameLabel')}</AppText>
              </View>
            </View>
            <Field
              testID="onboarding-name-input"
              label={t('onboarding.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.namePlaceholder')}
              maxLength={50}
            />
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />

          {/* Row 2: Primary Currency */}
          <View style={styles.registerSection}>
            <View style={styles.rowHeader}>
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">
                  {t('onboarding.primaryCurrencyLabel')}
                </AppText>
              </View>
            </View>
            <View style={[styles.rowWrap, { gap: theme.spacing.sm }]}>
              {CURRENCIES.map((code) => (
                <Chip
                  key={code}
                  testID={`onboarding-currency-${code}`}
                  label={CURRENCY_LABELS[code]}
                  selected={currency === code}
                  onPress={() => setCurrency(code)}
                />
              ))}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />

          {/* Row 3: Cycle Start Day with − / + Steppers */}
          <View style={styles.registerSection}>
            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">
                  {t('onboarding.cycleStartRowLabel')}
                </AppText>
                <AppText variant="caption" color="accent">
                  {t('settings.cyclePreview', { range: cyclePreview })}
                </AppText>
              </View>
              <View style={styles.stepperGroup}>
                <PressableScale
                  pressScale={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.decreaseStartDay')}
                  onPress={() => stepCycleDay(-1)}
                  style={[
                    styles.stepperBtn,
                    {
                      borderColor: theme.colors.cardBorder,
                      backgroundColor: theme.colors.surfaceSunken,
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                >
                  <AppText variant="bodyStrong">−</AppText>
                </PressableScale>
                <AppText
                  variant="bodyStrong"
                  tabularNums
                  style={styles.stepperValue}
                >
                  {t('onboarding.dayN', { day: monthStartDay })}
                </AppText>
                <PressableScale
                  pressScale={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.increaseStartDay')}
                  onPress={() => stepCycleDay(1)}
                  style={[
                    styles.stepperBtn,
                    {
                      borderColor: theme.colors.cardBorder,
                      backgroundColor: theme.colors.surfaceSunken,
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                >
                  <AppText variant="bodyStrong">+</AppText>
                </PressableScale>
              </View>
            </View>

            <View style={[styles.rowWrap, { gap: 6 }]}>
              {cycleShortcuts.map((preset) => (
                <Chip
                  key={preset.day}
                  label={preset.label}
                  selected={monthStartDay === preset.day}
                  onPress={() => setMonthStartDay(preset.day)}
                />
              ))}
            </View>

          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />

          {/* Row 4: Appearance & Accent Swatches */}
          <View style={styles.registerSection}>
            <AppText variant="bodyStrong">{t('settings.themeLabel')}</AppText>
            <View style={[styles.rowWrap, { gap: 6 }]}>
              {THEME_MODES.map((m) => (
                <Chip
                  key={m.key}
                  label={t(m.labelKey)}
                  selected={draftTheme === m.key}
                  onPress={() => handleSelectTheme(m.key)}
                />
              ))}
            </View>

            <View style={[styles.rowBetween, { marginTop: 4 }]}>
              <AppText variant="label" color="textSecondary">
                {t('settings.accentLabel')}
              </AppText>
              <View style={styles.swatchRow}>
                {ACCENT_SWATCHES.map((acc) => {
                  const active = draftAccent === acc;
                  const def = ACCENT_DEFINITIONS[acc];
                  return (
                    <PressableScale
                      key={acc}
                      pressScale={0.92}
                      testID={`onboarding-accent-${acc}`}
                      accessibilityRole="button"
                      accessibilityLabel={def.label}
                      accessibilityState={{ selected: active }}
                      onPress={() => handleSelectAccent(acc)}
                      style={({ pressed }) => [
                        styles.swatchCircle,
                        {
                          backgroundColor: def.swatchColor,
                          borderColor: active ? theme.colors.text : 'transparent',
                          opacity: pressed && !reducedMotion ? 0.85 : 1,
                        },
                      ]}
                    >
                      {active ? (
                        <AppIcon name="check" size={14} color="#FFFFFF" />
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </View>
        </Surface>
      </View>

      <View style={[styles.navRow, { gap: theme.spacing.sm, paddingTop: theme.spacing.md }]}>
        <Button
          title={t('common.back')}
          variant="secondary"
          onPress={() => router.back()}
          style={styles.navBtn}
        />
        <Button
          testID="onboarding-prefs-continue"
          tint="#0369A1"
          title={t('common.continue')}
          onPress={() => router.push('/onboarding/budget')}
          style={styles.navBtnPrimary}
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
  registerSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 52,
    textAlign: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatchCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
  navBtnPrimary: {
    flex: 2,
  },
});
