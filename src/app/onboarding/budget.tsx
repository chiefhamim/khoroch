import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { todayLocalDate } from '@/domain/dates';
import { CURRENCIES as CURRENCY_META, formatMoney, parseMoneyInput } from '@/domain/money';
import { getPeriod, remainingDays } from '@/domain/period';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Field } from '@/ui/Field';
import { Money } from '@/ui/Money';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

const QUICK_BUDGETS_MINOR = {
  BDT: [1500000, 2000000, 3000000, 4000000, 6000000],
  USD: [50000, 100000, 200000, 300000, 500000],
  EUR: [50000, 100000, 200000, 300000, 500000],
} as const;

export default function OnboardingBudgetScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { currency, monthStartDay, budgetInput, setBudgetInput } = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);

  const today = todayLocalDate();
  const period = getPeriod(today, monthStartDay);
  const remainingDaysCount = Math.max(1, remainingDays(period, today));

  const parsedDraft = budgetInput.trim() ? parseMoneyInput(budgetInput) : null;
  const budgetMinor =
    parsedDraft && parsedDraft.ok && parsedDraft.minor !== null && parsedDraft.minor > 0
      ? parsedDraft.minor
      : null;

  const weeklyMinor = budgetMinor !== null ? Math.round(budgetMinor / 4.33) : null;
  const safeDailyMinor =
    budgetMinor !== null ? Math.floor(budgetMinor / remainingDaysCount) : null;

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
      style={{ backgroundColor: 'transparent' }}
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.md }}>
        <OnboardingHeader
          step={3}
          title={t('onboarding.budgetTitle')}
          subtitle={t('onboarding.budgetNote')}
        />

        {/* Spending Envelope Breakdown Card */}
        <Surface padded={false}>
          <View
            style={[
              styles.envelopeTop,
              {
                backgroundColor: theme.colors.surfaceSunken,
                paddingVertical: 14,
                paddingHorizontal: 16,
              },
            ]}
          >
            <AppText variant="overline" color="textSecondary">
              {t('onboarding.envelopePlanLabel')}
            </AppText>
            {budgetMinor !== null ? (
              <Money
                amountMinor={budgetMinor}
                currency={currency}
                variant="hero"
                color="text"
              />
            ) : (
              <AppText variant="hero" color="textTertiary" tabularNums>
                —
              </AppText>
            )}
          </View>

          <View style={styles.envelopeRow}>
            <View style={styles.rowMid}>
              <AppText variant="bodyStrong">
                {t('onboarding.weeklyAllowanceLabel')}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('onboarding.weeklyAllowanceSub')}
              </AppText>
            </View>
            {weeklyMinor !== null ? (
              <Money
                amountMinor={weeklyMinor}
                currency={currency}
                variant="bodyStrong"
                roundToWhole
              />
            ) : (
              <AppText variant="bodyStrong" color="textTertiary">
                —
              </AppText>
            )}
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />

          <View style={styles.envelopeRow}>
            <View style={styles.rowMid}>
              <AppText variant="bodyStrong">
                {t('onboarding.safeTodayEnvelopeLabel', { days: remainingDaysCount })}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('onboarding.safeTodayEnvelopeSub')}
              </AppText>
            </View>
            {safeDailyMinor !== null ? (
              <Money
                amountMinor={safeDailyMinor}
                currency={currency}
                variant="bodyStrong"
                color="accent"
              />
            ) : (
              <AppText variant="bodyStrong" color="textTertiary">
                —
              </AppText>
            )}
          </View>
        </Surface>

        <Surface style={{ gap: theme.spacing.sm }}>
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

          <AppText variant="overline" color="textSecondary" style={{ marginTop: 2 }}>
            {t('onboarding.commonPlansLabel')}
          </AppText>
          <View style={[styles.presetRow, { gap: theme.spacing.xs }]}>
            {presets.map((minor) => {
              const rawNum = String(Math.round(minor / 100));
              const selected = budgetInput.trim() === rawNum;
              return (
                <Chip
                  key={minor}
                  label={
                    selected
                      ? `${formatMoney(minor, currency)} ✓`
                      : formatMoney(minor, currency)
                  }
                  selected={selected}
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
            title={
              budgetMinor !== null
                ? t('onboarding.savePlanCta', {
                    amount: formatMoney(budgetMinor, currency),
                  })
                : t('common.continue')
            }
            onPress={handleContinue}
            style={styles.navBtnPrimary}
          />
        </View>
        <Button
          testID="onboarding-budget-skip"
          title={t('onboarding.skipBudgetCta')}
          variant="ghost"
          size="sm"
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
  envelopeTop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  envelopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  rowMid: {
    flex: 1,
    minWidth: 0,
    gap: 1,
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
