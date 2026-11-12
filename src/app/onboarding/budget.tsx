import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { parseMoneyInput } from '@/domain/money';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AmountPad } from '@/ui/AmountPad';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

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

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 3, total: 6 })}
        </AppText>
        <AppText variant="title">{t('onboarding.budgetQuestion')}</AppText>
      </View>

      <Card style={{ backgroundColor: theme.colors.surfaceAlt, gap: theme.spacing.xs }}>
        <AppText variant="body" color="textMuted">
          {t('onboarding.budgetNote')}
        </AppText>
      </Card>

      <AmountPad
        testID="onboarding-budget-input"
        currency={currency}
        value={budgetInput}
        onChange={(next) => {
          setBudgetInput(next);
          if (error) setError(null);
        }}
      />

      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <View style={[styles.navRow, { gap: theme.spacing.md }]}>
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
            style={styles.navBtn}
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
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
});
