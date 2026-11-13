import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CURRENCIES as CURRENCY_META, formatMoney, parseMoneyInput } from '@/domain/money';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Field } from '@/ui/Field';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

const QUICK_BUDGETS_MINOR = {
  BDT: [2000000, 4000000, 6000000],
  USD: [100000, 200000, 300000],
  EUR: [100000, 200000, 300000],
} as const;

export default function OnboardingBudgetScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { currency, budgetInput, setBudgetInput } = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);
    if (budgetInput.trim() === '') {
      router.push('/onboarding/categories');
      return;
    }
    const parsed = parseMoneyInput(budgetInput);
    if (!parsed.ok || parsed.minor === null || parsed.minor <= 0) {
      setError(t('onboarding.budgetInvalid'));
      return;
    }
    router.push('/onboarding/categories');
  };

  const handleSkip = () => {
    setError(null);
    setBudgetInput('');
    router.push('/onboarding/categories');
  };

  const presets = QUICK_BUDGETS_MINOR[currency];

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader step={3} title={t('onboarding.budgetQuestion')} />

        <Banner tone="neutral" icon="info" message={t('onboarding.budgetNote')} />

        <Surface style={{ gap: theme.spacing.md }}>
          <Field
            testID="onboarding-budget-input"
            label={`${t('onboarding.budgetTitle')} (${CURRENCY_META[currency].symbol})`}
            value={budgetInput}
            onChangeText={(next) => {
              setBudgetInput(next);
              if (error) setError(null);
            }}
            placeholder={t('onboarding.budgetPlaceholder')}
            keyboardType="decimal-pad"
            error={error}
          />

          <View style={[styles.presetRow, { gap: theme.spacing.xs }]}>
            {presets.map((minor) => {
              const rawNum = String(Math.round(minor / 100));
              return (
                <Chip
                  key={minor}
                  label={formatMoney(minor, currency)}
                  selected={budgetInput.trim() === rawNum}
                  onPress={() => {
                    setBudgetInput(rawNum);
                    if (error) setError(null);
                  }}
                />
              );
            })}
          </View>
        </Surface>
      </View>

      <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.md }}>
        <View style={[styles.navRow, { gap: theme.spacing.sm }]}>
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={() => router.back()}
            style={styles.navBtn}
          />
          <Button
            testID="onboarding-budget-continue"
            title={t('common.continue')}
            onPress={handleContinue}
            style={styles.navBtnPrimary}
          />
        </View>
        <Button
          testID="onboarding-budget-skip"
          title={t('common.skip')}
          variant="ghost"
          onPress={handleSkip}
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
  presetRow: {
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
