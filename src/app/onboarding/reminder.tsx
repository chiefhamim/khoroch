import React, { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ALL_REMINDER_DAYS, SUN_THU_REMINDER_DAYS } from '@/domain/types';
import { isValidLocalTime } from '@/domain/validation';
import { t } from '@/i18n';
import {
  getNotificationPermissionStatus,
  isNotificationsSupported,
  requestNotificationPermission,
} from '@/notifications/reminders';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DayToggles } from '@/ui/DayToggles';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { SettingsRow } from '@/ui/SettingsRow';
import { Surface } from '@/ui/Surface';
import { TimeField } from '@/ui/TimeField';

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((d) => setA.has(d));
}

export default function OnboardingReminderScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    reminderEnabled,
    reminderTime,
    reminderDays,
    setReminderEnabled,
    setReminderTime,
    setReminderDays,
  } = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const handleContinue = async () => {
    if (requesting) return;
    setError(null);
    if (reminderEnabled && !isValidLocalTime(reminderTime.trim())) {
      setError(t('tx.errorInvalidTime'));
      return;
    }

    if (reminderEnabled && isNotificationsSupported()) {
      setRequesting(true);
      try {
        const status = await getNotificationPermissionStatus();
        if (status === 'undetermined') {
          const result = await requestNotificationPermission();
          if (result === 'denied') {
            setReminderEnabled(false);
          }
        } else if (status === 'denied') {
          setReminderEnabled(false);
        }
      } finally {
        setRequesting(false);
      }
    }

    router.push('/onboarding/done');
  };

  const isEveryDay = sameDays(reminderDays, ALL_REMINDER_DAYS);
  const isSunThu = sameDays(reminderDays, SUN_THU_REMINDER_DAYS);

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader step={5} title={t('onboarding.reminderQuestion')} />

        <Banner tone="neutral" icon="bell" message={t('onboarding.reminderExplain')} />

        <Surface padded={false}>
          <SettingsRow
            label={t('onboarding.reminderTitle')}
            value={reminderEnabled ? t('common.on') : t('common.off')}
            trailing={
              <Switch
                testID="onboarding-reminder-switch"
                accessibilityLabel={t('onboarding.reminderEnable')}
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                trackColor={{ false: theme.colors.surfaceSunken, true: theme.colors.accent }}
                thumbColor={theme.colors.surface}
              />
            }
          />

          {reminderEnabled ? (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.separator,
                  marginHorizontal: theme.spacing.lg,
                }}
              />
              <TimeField
                testID="onboarding-reminder-time"
                variant="row"
                rowLabel={t('onboarding.reminderTimeLabel')}
                value={reminderTime}
                accessibilityLabel={t('onboarding.reminderTimeLabel')}
                onChange={(next) => {
                  setReminderTime(next);
                  if (error) setError(null);
                }}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.separator,
                  marginHorizontal: theme.spacing.lg,
                }}
              />
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
                <AppText variant="bodyStrong">{t('onboarding.reminderDaysLabel')}</AppText>
                <DayToggles
                  testID="onboarding-reminder-days"
                  selectedDays={reminderDays.map((d) => d + 1)}
                  onChange={(weekdays) => setReminderDays(weekdays.map((w) => w - 1))}
                />
                <View style={[styles.chipsRow, { gap: theme.spacing.sm }]}>
                  <Chip
                    label={t('onboarding.reminderEveryDay')}
                    selected={isEveryDay}
                    onPress={() => setReminderDays([...ALL_REMINDER_DAYS])}
                  />
                  <Chip
                    label={t('onboarding.reminderWeekdays')}
                    selected={isSunThu}
                    onPress={() => setReminderDays([...SUN_THU_REMINDER_DAYS])}
                  />
                </View>
              </View>
            </>
          ) : null}
        </Surface>

        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.navRow, { gap: theme.spacing.sm, paddingTop: theme.spacing.md }]}>
        <Button
          title={t('common.back')}
          variant="secondary"
          onPress={() => router.back()}
          style={styles.navBtn}
        />
        <Button
          testID="onboarding-reminder-continue"
          title={t('common.continue')}
          loading={requesting}
          disabled={requesting}
          onPress={() => void handleContinue()}
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
  chipsRow: {
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
