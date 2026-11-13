import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { todayLocalDate } from '@/domain/dates';
import { formatCycleLabel, getPeriod } from '@/domain/period';
import { CURRENCIES, type CurrencyCode } from '@/domain/types';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DayOfMonthGrid } from '@/ui/DayOfMonthGrid';
import { Field } from '@/ui/Field';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BDT: 'BDT (৳)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
};

export default function OnboardingPreferencesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    name,
    currency,
    monthStartDay,
    setName,
    setCurrency,
    setMonthStartDay,
  } = useOnboardingDraft();

  const cyclePreview = formatCycleLabel(
    getPeriod(todayLocalDate(), monthStartDay),
    monthStartDay,
    { includeYear: false }
  );

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader
          step={2}
          title={t('onboarding.prefsTitle')}
          subtitle={t('onboarding.prefsSubtitle')}
        />

        <Surface style={{ gap: theme.spacing.lg }}>
          <Field
            testID="onboarding-name-input"
            label={t('onboarding.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.namePlaceholder')}
            maxLength={50}
          />

          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textSecondary">
              {t('onboarding.currencyLabel')}
            </AppText>
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

          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textSecondary">
              {t('onboarding.monthStartLabel')}
            </AppText>
            <DayOfMonthGrid
              testID="onboarding-cycle-grid"
              value={monthStartDay}
              onChange={setMonthStartDay}
            />
            <Surface variant="soft">
              <AppText variant="label" color="accent">
                {t('settings.cyclePreview', { range: cyclePreview })}
              </AppText>
            </Surface>
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
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
