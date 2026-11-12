import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CURRENCIES, type CurrencyCode } from '@/domain/types';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BDT: 'BDT (৳)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
};

const QUICK_DAYS = [1, 5, 10, 15, 25] as const;

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

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 2, total: 6 })}
        </AppText>
        <AppText variant="title">{t('onboarding.prefsTitle')}</AppText>
        <AppText variant="body" color="textMuted">
          {t('onboarding.prefsSubtitle')}
        </AppText>
      </View>

      <Card style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            {t('onboarding.nameLabel')}
          </AppText>
          <TextInput
            testID="onboarding-name-input"
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.namePlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={50}
            style={[
              styles.input,
              {
                minHeight: theme.touch.min,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.md,
                color: theme.colors.text,
                fontFamily: theme.typography.body.fontFamily,
                fontSize: theme.typography.body.fontSize,
              },
            ]}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
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
          <AppText variant="label" color="textMuted">
            {t('onboarding.languageLabel')}
          </AppText>
          <View
            style={[
              styles.readOnlyRow,
              {
                minHeight: theme.touch.min,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                paddingHorizontal: theme.spacing.md,
              },
            ]}
          >
            <AppText variant="body">{t('onboarding.languageEnglishNote')}</AppText>
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color="textMuted">
            {t('onboarding.monthStartLabel')}
          </AppText>
          <View style={[styles.stepperRow, { gap: theme.spacing.md }]}>
            <Button
              title="-"
              variant="secondary"
              accessibilityLabel={t('onboarding.decreaseStartDay')}
              disabled={monthStartDay <= 1}
              onPress={() => setMonthStartDay(Math.max(1, monthStartDay - 1))}
              style={{ minWidth: theme.touch.min + theme.spacing.lg }}
            />
            <View style={styles.dayValue}>
              <AppText variant="title" tabularNums>
                {monthStartDay}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t('onboarding.monthStartHelp', { day: monthStartDay })}
              </AppText>
            </View>
            <Button
              title="+"
              variant="secondary"
              accessibilityLabel={t('onboarding.increaseStartDay')}
              disabled={monthStartDay >= 28}
              onPress={() => setMonthStartDay(Math.min(28, monthStartDay + 1))}
              style={{ minWidth: theme.touch.min + theme.spacing.lg }}
            />
          </View>
          <View style={[styles.rowWrap, { gap: theme.spacing.sm }]}>
            {QUICK_DAYS.map((day) => (
              <Chip
                key={day}
                label={t('onboarding.dayN', { day })}
                selected={monthStartDay === day}
                onPress={() => setMonthStartDay(day)}
              />
            ))}
          </View>
        </View>
      </Card>

      <View style={[styles.navRow, { gap: theme.spacing.md }]}>
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
          style={styles.navBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  readOnlyRow: {
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayValue: {
    flex: 1,
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
});
