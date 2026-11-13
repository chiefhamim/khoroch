import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { todayLocalDate } from '@/domain/dates';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import { getPeriod } from '@/domain/period';
import { t } from '@/i18n';
import {
  getNotificationPermissionStatus,
  isNotificationsSupported,
  syncReminderSchedule,
} from '@/notifications/reminders';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function OnboardingDoneScreen() {
  const { theme } = useTheme();
  const { repo, refreshSettings } = useAppContext();
  const router = useRouter();
  const {
    name,
    currency,
    monthStartDay,
    budgetInput,
    selectedCategoryIds,
    reminderEnabled,
    reminderTime,
    reminderDays,
    reset,
  } = useOnboardingDraft();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedBudget = budgetInput.trim() ? parseMoneyInput(budgetInput) : null;
  const budgetMinor =
    parsedBudget && parsedBudget.ok && parsedBudget.minor && parsedBudget.minor > 0
      ? parsedBudget.minor
      : null;

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await repo.setSetting('name', name.trim());
      await repo.setSetting('currency', currency);
      await repo.setSetting('monthStartDay', monthStartDay);

      const reminderConfig = {
        enabled: reminderEnabled,
        time: reminderTime.trim() || '21:00',
        days: reminderDays,
      };
      if (isNotificationsSupported()) {
        const permStatus = await getNotificationPermissionStatus();
        if (reminderConfig.enabled && permStatus !== 'granted') {
          reminderConfig.enabled = false;
        }
        await repo.setSetting('notificationPermissionDenied', permStatus === 'denied');
        await repo.setSetting('reminder', reminderConfig);
        await syncReminderSchedule(reminderConfig);
      } else {
        await repo.setSetting('notificationPermissionDenied', false);
        await repo.setSetting('reminder', reminderConfig);
      }

      const categories = await repo.listCategories({ includeArchived: true });
      const selectedSet = new Set(selectedCategoryIds);
      for (const cat of categories) {
        if (cat.kind === 'expense') {
          const shouldSelect = selectedSet.has(cat.id);
          if (cat.isSelected !== shouldSelect) {
            await repo.upsertCategory({
              ...cat,
              isSelected: shouldSelect,
            });
          }
        }
      }

      if (budgetMinor !== null) {
        const period = getPeriod(todayLocalDate(), monthStartDay);
        await repo.setBudget(period.start, '', budgetMinor);
      }

      await repo.setSetting('onboardingDone', true);
      await refreshSettings();
      bumpDataVersion();
      reset();
      router.replace('/(tabs)');
    } catch {
      setError(t('error.genericBody'));
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 6, total: 6 })}
        </AppText>
        <AppText variant="display">{t('onboarding.doneTitle')}</AppText>
        <AppText variant="body" color="textMuted">
          {t('onboarding.doneSubtitle')}
        </AppText>
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="body">
          {t('onboarding.doneSummaryName', {
            value: name.trim() || t('onboarding.doneSummaryNameDefault'),
          })}
        </AppText>
        <AppText variant="body">
          {t('onboarding.doneSummaryCurrency', { value: currency })}
        </AppText>
        <AppText variant="body">
          {t('onboarding.doneSummaryCycle', { day: monthStartDay })}
        </AppText>
        <AppText variant="body">
          {budgetMinor !== null
            ? t('onboarding.doneSummaryBudget', {
                value: formatMoney(budgetMinor, currency),
              })
            : t('onboarding.doneSummaryNoBudget')}
        </AppText>
      </Card>

      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}

      <View style={[styles.navRow, { gap: theme.spacing.md }]}>
        <Button
          title={t('common.back')}
          variant="secondary"
          disabled={saving}
          onPress={() => router.back()}
          style={styles.navBtn}
        />
        <Button
          testID="onboarding-done-cta"
          title={t('onboarding.doneCta')}
          loading={saving}
          disabled={saving}
          onPress={handleFinish}
          style={styles.finishBtn}
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
  finishBtn: {
    flex: 2,
  },
});
