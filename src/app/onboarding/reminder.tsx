import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';

const PRESET_TIMES = ['20:00', '21:00', '22:00'] as const;

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

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" color="primary">
          {t('onboarding.stepLabel', { step: 5, total: 6 })}
        </AppText>
        <AppText variant="title">{t('onboarding.reminderQuestion')}</AppText>
      </View>

      <Card style={{ backgroundColor: theme.colors.surfaceAlt, gap: theme.spacing.xs }}>
        <AppText variant="body" color="textMuted">
          {t('onboarding.reminderExplain')}
        </AppText>
      </Card>

      <Card style={{ gap: theme.spacing.lg }}>
        <View style={[styles.toggleRow, { minHeight: theme.touch.min }]}>
          <View style={styles.toggleText}>
            <AppText variant="heading">{t('onboarding.reminderTitle')}</AppText>
            <AppText variant="caption" color="textMuted">
              {reminderEnabled ? t('common.on') : t('common.off')}
            </AppText>
          </View>
          <Switch
            testID="onboarding-reminder-switch"
            accessibilityLabel={t('onboarding.reminderEnable')}
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
          />
        </View>

        {reminderEnabled ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                {t('onboarding.reminderDaysLabel')}
              </AppText>
              <SegmentedControl
                value={reminderDays}
                onChange={setReminderDays}
                options={[
                  { value: 'everyday', label: t('onboarding.reminderEveryDay') },
                  { value: 'weekdays', label: t('onboarding.reminderWeekdays') },
                ]}
              />
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                {t('onboarding.reminderTimeLabel')}
              </AppText>
              <View style={[styles.chipsRow, { gap: theme.spacing.sm }]}>
                {PRESET_TIMES.map((preset) => (
                  <Chip
                    key={preset}
                    label={preset}
                    selected={reminderTime === preset}
                    onPress={() => {
                      setReminderTime(preset);
                      if (error) setError(null);
                    }}
                  />
                ))}
              </View>
              <TextInput
                testID="onboarding-reminder-time"
                value={reminderTime}
                onChangeText={(txt) => {
                  setReminderTime(txt);
                  if (error) setError(null);
                }}
                placeholder="21:00"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={5}
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
          </View>
        ) : null}
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
          onPress={() => router.back()}
          style={styles.navBtn}
        />
        <Button
          testID="onboarding-reminder-continue"
          title={t('common.continue')}
          loading={requesting}
          disabled={requesting}
          onPress={() => void handleContinue()}
          style={styles.navBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
  },
  navBtn: {
    flex: 1,
  },
});
