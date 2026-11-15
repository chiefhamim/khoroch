import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatFriendlyTime } from '@/domain/dates';
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
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DayToggles } from '@/ui/DayToggles';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { PillSwitch } from '@/ui/PillSwitch';
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

    router.push('/onboarding/wallets');
  };

  const isEveryDay = sameDays(reminderDays, ALL_REMINDER_DAYS);
  const isSunThu = sameDays(reminderDays, SUN_THU_REMINDER_DAYS);
  const friendlyTime = formatFriendlyTime(reminderTime || '21:00', false);

  const timePresets = [
    { value: '20:00', label: t('onboarding.preset8pm') },
    { value: '21:00', label: t('onboarding.preset9pm') },
    { value: '22:00', label: t('onboarding.preset10pm') },
  ];

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
          step={5}
          title={t('onboarding.ritualTitle')}
          subtitle={t('onboarding.ritualSub')}
        />

        {/* Nightly Ritual Preview Card */}
        <Surface variant="sunken" padding={14} style={{ gap: 6 }}>
          <View style={styles.previewTopRow}>
            <AppText
              variant="overline"
              color="accent"
              style={styles.previewOverline}
            >
              {t('onboarding.ritualPreviewHeader', { time: friendlyTime })}
            </AppText>
            <View
              style={[
                styles.reviewedPill,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <AppText variant="caption" color="accent" style={styles.reviewedPillText}>
                {t('checkIn.alreadyDone')}
              </AppText>
            </View>
          </View>
          <AppText variant="bodyStrong">
            {t('onboarding.ritualPreviewQuote')}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('onboarding.ritualPreviewBody')}
          </AppText>
        </Surface>

        <Surface padded={false}>
          <SettingsRow
            label={t('onboarding.reminderTitle')}
            subtitle={t('onboarding.reminderExplain')}
            value={reminderEnabled ? t('common.on') : t('common.off')}
            trailing={
              <PillSwitch
                testID="onboarding-reminder-switch"
                accessibilityLabel={t('onboarding.reminderEnable')}
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
              />
            }
          />

          {reminderEnabled ? (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.separator,
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
                  paddingHorizontal: theme.spacing.lg,
                  paddingBottom: theme.spacing.md,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.xs,
                }}
              >
                {timePresets.map((preset) => (
                  <Chip
                    key={preset.value}
                    label={preset.label}
                    selected={reminderTime === preset.value}
                    onPress={() => {
                      setReminderTime(preset.value);
                      if (error) setError(null);
                    }}
                  />
                ))}
              </View>
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.separator,
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
          tint="#BE185D"
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
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewOverline: {
    flex: 1,
    textTransform: 'uppercase',
  },
  reviewedPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reviewedPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
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
