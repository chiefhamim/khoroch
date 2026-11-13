import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { buildSampleTransactions } from '@/data/sampleData';
import { todayLocalDate } from '@/domain/dates';
import { formatCycleLabel, getPeriod } from '@/domain/period';
import {
  ALL_REMINDER_DAYS,
  CURRENCIES,
  SUN_THU_REMINDER_DAYS,
  type CurrencyCode,
  type ReminderSettings,
} from '@/domain/types';
import { t } from '@/i18n';
import {
  getNotificationPermissionStatus,
  isNotificationsSupported,
  requestNotificationPermission,
  syncReminderSchedule,
} from '@/notifications/reminders';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { useSettings } from '@/state/useSettings';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DayOfMonthGrid } from '@/ui/DayOfMonthGrid';
import { DayToggles } from '@/ui/DayToggles';
import { Field } from '@/ui/Field';
import { hapticLight, hapticSelection, hapticSuccess } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { SettingsGroup } from '@/ui/SettingsGroup';
import { SettingsRow } from '@/ui/SettingsRow';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { TimeField } from '@/ui/TimeField';
import { useToast } from '@/ui/Toast';

const CURRENCY_SHORT: Record<CurrencyCode, string> = {
  BDT: 'BDT ৳',
  USD: 'USD $',
  EUR: 'EUR €',
};

const CURRENCY_FULL: Record<CurrencyCode, string> = {
  BDT: 'Bangladeshi Taka (BDT ৳)',
  USD: 'US Dollar (USD $)',
  EUR: 'Euro (EUR €)',
};

function formatOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((d) => setA.has(d));
}

export default function SettingsScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const { repo, backend, settings, hasTransactions, updateSetting, refreshSettings } =
    useSettings();

  const [activeCategoryCount, setActiveCategoryCount] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sheet states
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(settings.name);

  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

  const [cycleSheetOpen, setCycleSheetOpen] = useState(false);
  const [cycleDayDraft, setCycleDayDraft] = useState(settings.monthStartDay);

  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);

  const [reminderExplainOpen, setReminderExplainOpen] = useState(false);

  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    let active = true;
    repo
      .listCategories()
      .then((cats) => {
        if (active) setActiveCategoryCount(cats.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [repo, dataVersion]);

  const applyReminderUpdate = useCallback(
    async (nextReminder: ReminderSettings) => {
      await updateSetting('reminder', nextReminder);
      await syncReminderSchedule(nextReminder);
    },
    [updateSetting]
  );

  const syncPermissionFromOs = useCallback(async () => {
    if (!isNotificationsSupported()) return;
    const status = await getNotificationPermissionStatus();
    if (status === 'granted') {
      if (settings.notificationPermissionDenied) {
        await updateSetting('notificationPermissionDenied', false);
      }
      if (settings.reminder.enabled) {
        await syncReminderSchedule(settings.reminder);
      }
      return;
    }

    const osDenied = status === 'denied';
    if (settings.notificationPermissionDenied !== osDenied) {
      await updateSetting('notificationPermissionDenied', osDenied);
    }
    if (settings.reminder.enabled) {
      await applyReminderUpdate({ ...settings.reminder, enabled: false });
    }
  }, [
    applyReminderUpdate,
    settings.notificationPermissionDenied,
    settings.reminder,
    updateSetting,
  ]);

  useFocusEffect(
    useCallback(() => {
      void syncPermissionFromOs();
    }, [syncPermissionFromOs])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncPermissionFromOs();
      }
    });
    return () => sub.remove();
  }, [syncPermissionFromOs]);

  const handleToggleReminder = async (nextEnabled: boolean) => {
    if (!nextEnabled) {
      await applyReminderUpdate({ ...settings.reminder, enabled: false });
      return;
    }

    if (!isNotificationsSupported()) {
      await applyReminderUpdate({ ...settings.reminder, enabled: true });
      return;
    }

    const status = await getNotificationPermissionStatus();
    if (status === 'granted') {
      if (settings.notificationPermissionDenied) {
        await updateSetting('notificationPermissionDenied', false);
      }
      await applyReminderUpdate({ ...settings.reminder, enabled: true });
      return;
    }

    if (status === 'denied') {
      await updateSetting('notificationPermissionDenied', true);
      await applyReminderUpdate({ ...settings.reminder, enabled: false });
      return;
    }

    if (settings.notificationPermissionDenied) {
      await updateSetting('notificationPermissionDenied', false);
    }
    setReminderExplainOpen(true);
  };

  const handleConfirmReminderPermission = async () => {
    setReminderExplainOpen(false);
    const result = await requestNotificationPermission();
    if (result === 'granted') {
      await updateSetting('notificationPermissionDenied', false);
      await applyReminderUpdate({ ...settings.reminder, enabled: true });
    } else {
      const afterStatus = await getNotificationPermissionStatus();
      await updateSetting('notificationPermissionDenied', afterStatus === 'denied');
      await applyReminderUpdate({ ...settings.reminder, enabled: false });
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    setActionError(null);
    try {
      await updateSetting('name', trimmed);
      hapticSuccess();
      setNameSheetOpen(false);
      showToast({ message: t('settings.savedNotice'), icon: 'circle-check', tone: 'accent' });
    } catch {
      setActionError(t('settings.actionError'));
    }
  };

  const handleSaveCycleDay = async () => {
    setActionError(null);
    try {
      await updateSetting('monthStartDay', cycleDayDraft);
      hapticSuccess();
      setCycleSheetOpen(false);
      showToast({ message: t('settings.savedNotice'), icon: 'circle-check', tone: 'accent' });
    } catch {
      setActionError(t('settings.actionError'));
    }
  };

  const handleDeleteAll = async () => {
    if (busy || deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setBusy(true);
    setActionError(null);
    try {
      await repo.deleteAllData();
      setDeleteSheetOpen(false);
      setDeleteConfirmText('');
      await refreshSettings();
      bumpDataVersion();
    } catch {
      setDeleteSheetOpen(false);
      setActionError(t('settings.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSample = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const today = todayLocalDate();
      const txs = buildSampleTransactions(settings.currency, today);
      await repo.insertTransactionsBatch(txs);

      const period = getPeriod(today, settings.monthStartDay);
      const existingBudgets = await repo.getBudgets(period.start);
      if (!existingBudgets.some((b) => b.categoryId === '')) {
        const defaultMinor = settings.currency === 'BDT' ? 4000000 : 120000;
        await repo.setBudget(period.start, '', defaultMinor);
      }

      await updateSetting('sampleDataLoaded', true);
      bumpDataVersion();
      showToast({ message: t('settings.sampleLoadedNote'), icon: 'circle-check', tone: 'accent' });
    } catch {
      setActionError(t('settings.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const handleClearSample = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await repo.clearSampleTransactions();
      await updateSetting('sampleDataLoaded', false);
      bumpDataVersion();
      showToast({ message: t('common.done'), icon: 'circle-check', tone: 'default' });
    } catch {
      setActionError(t('settings.actionError'));
    } finally {
      setBusy(false);
    }
  };

  const trimmedName = settings.name.trim();
  const initialLetter = trimmedName ? trimmedName.charAt(0).toUpperCase() : 'H';

  const appearanceLabel =
    settings.theme === 'light'
      ? t('settings.themeLight')
      : settings.theme === 'dark'
        ? t('settings.themeDark')
        : t('settings.themeSystem');

  const today = todayLocalDate();
  const draftCyclePreview = formatCycleLabel(
    getPeriod(today, cycleDayDraft),
    cycleDayDraft,
    { includeYear: false }
  );

  const selectedDays = settings.reminder.days;
  const isEveryDay = sameDays(selectedDays, ALL_REMINDER_DAYS);
  const isSunThu = sameDays(selectedDays, SUN_THU_REMINDER_DAYS);
  const reminderActive = settings.reminder.enabled && !settings.notificationPermissionDenied;
  const canConfirmDelete = deleteConfirmText.trim().toUpperCase() === 'DELETE' && !busy;

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      {/* Top header with Back arrow */}
      <View style={[styles.headerRow, { gap: theme.spacing.md }]}>
        <IconButton
          testID="settings-back"
          icon="arrow-left"
          variant="surface"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
        <AppText variant="title">{t('settings.title')}</AppText>
      </View>

      {actionError ? (
        <Banner
          tone="danger"
          icon="triangle-alert"
          message={actionError}
        />
      ) : null}

      {/* Profile Row */}
      <Surface padded={false}>
        <SettingsRow
          testID="settings-profile-row"
          label={trimmedName || t('settings.profileFallbackName')}
          subtitle={trimmedName ? undefined : t('settings.profileSubtitle')}
          showChevron
          left={
            <View
              style={[
                styles.avatar,
                {
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.accentSoft,
                },
              ]}
            >
              <AppText variant="headline" color="accent">
                {initialLetter}
              </AppText>
            </View>
          }
          onPress={() => {
            hapticLight();
            setNameDraft(settings.name);
            setNameSheetOpen(true);
          }}
        />
      </Surface>

      {/* GENERAL */}
      <SettingsGroup
        title={t('settings.sectionPersonal')}
        footer={hasTransactions ? t('settings.currencyLockedNote') : undefined}
      >
        <SettingsRow
          testID="settings-currency-row"
          label={t('settings.currencyLabel')}
          value={CURRENCY_SHORT[settings.currency]}
          locked={hasTransactions}
          showChevron={!hasTransactions}
          onPress={
            hasTransactions
              ? undefined
              : () => {
                  hapticLight();
                  setCurrencySheetOpen(true);
                }
          }
        />
        <SettingsRow
          testID="settings-cycle-row"
          label={t('settings.monthStartLabel')}
          value={t('settings.cycleStartOption', {
            ordinal: formatOrdinal(settings.monthStartDay),
          })}
          showChevron
          onPress={() => {
            hapticLight();
            setCycleDayDraft(settings.monthStartDay);
            setCycleSheetOpen(true);
          }}
        />
        <SettingsRow
          testID="settings-appearance-row"
          label={t('settings.themeLabel')}
          value={appearanceLabel}
          showChevron
          onPress={() => {
            hapticLight();
            setAppearanceSheetOpen(true);
          }}
        />
      </SettingsGroup>

      {/* REMINDERS */}
      <SettingsGroup
        title={t('settings.sectionReminders')}
        footer={!isNotificationsSupported() ? t('settings.reminderWebNote') : undefined}
      >
        <SettingsRow
          label={t('settings.reminderToggle')}
          trailing={
            <Switch
              testID="settings-reminder-switch"
              accessibilityLabel={t('settings.reminderToggle')}
              value={reminderActive}
              onValueChange={(val) => void handleToggleReminder(val)}
              trackColor={{ false: theme.colors.surfaceSunken, true: theme.colors.accent }}
              thumbColor={theme.colors.surface}
            />
          }
        />

        {settings.notificationPermissionDenied ? (
          <View
            testID="settings-reminder-denied-box"
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <Banner
              tone="danger"
              icon="triangle-alert"
              message={t('settings.reminderBlockedNotice')}
            />
            <Button
              testID="settings-open-system-settings"
              title={t('settings.openSystemSettings')}
              variant="secondary"
              size="sm"
              onPress={() => {
                Linking.openSettings().catch(() => {});
              }}
            />
          </View>
        ) : null}

        {reminderActive ? (
          <TimeField
            testID="settings-reminder-time"
            variant="row"
            rowLabel={t('settings.reminderTimeLabel')}
            value={settings.reminder.time}
            accessibilityLabel={t('settings.reminderTimeLabel')}
            onChange={(nextTime) => {
              void applyReminderUpdate({ ...settings.reminder, time: nextTime });
            }}
          />
        ) : null}

        {reminderActive ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <AppText variant="bodyStrong">{t('settings.reminderDaysLabel')}</AppText>
            <DayToggles
              testID="settings-reminder-days"
              selectedDays={selectedDays.map((d) => d + 1)}
              onChange={(expoWeekdays) => {
                void applyReminderUpdate({
                  ...settings.reminder,
                  days: expoWeekdays.map((w) => w - 1),
                });
              }}
            />
            <View style={[styles.presetRow, { gap: theme.spacing.sm }]}>
              <Chip
                testID="settings-reminder-preset-everyday"
                label={t('onboarding.reminderEveryDay')}
                selected={isEveryDay}
                onPress={() => {
                  void applyReminderUpdate({
                    ...settings.reminder,
                    days: [...ALL_REMINDER_DAYS],
                  });
                }}
              />
              <Chip
                testID="settings-reminder-preset-sun-thu"
                label={t('onboarding.reminderWeekdays')}
                selected={isSunThu}
                onPress={() => {
                  void applyReminderUpdate({
                    ...settings.reminder,
                    days: [...SUN_THU_REMINDER_DAYS],
                  });
                }}
              />
            </View>
          </View>
        ) : null}

        <SettingsRow
          testID="settings-checkin-row"
          label={t('settings.checkInRow')}
          subtitle={t('settings.checkInSubtitle')}
          showChevron
          onPress={() => router.push('/check-in')}
        />
      </SettingsGroup>

      {/* DATA */}
      <SettingsGroup title={t('settings.sectionData')}>
        <SettingsRow
          testID="settings-categories-row"
          label={t('settings.categoriesRow')}
          value={String(activeCategoryCount)}
          showChevron
          onPress={() => router.push('/settings/categories')}
        />
        <SettingsRow
          testID="settings-delete-all-button"
          label={t('settings.deleteAllButton')}
          destructive
          showChevron
          onPress={() => {
            hapticLight();
            setDeleteConfirmText('');
            setDeleteSheetOpen(true);
          }}
        />
      </SettingsGroup>

      {/* ABOUT */}
      <SettingsGroup title={t('settings.sectionAbout')}>
        <SettingsRow
          label={t('settings.aboutVersionLine')}
          subtitle={t('settings.aboutDesc', { backend })}
        />
      </SettingsGroup>

      {/* DEVELOPER (__DEV__ only) */}
      {__DEV__ ? (
        <SettingsGroup
          title={t('settings.sectionDev')}
          footer={
            settings.sampleDataLoaded
              ? t('settings.sampleLoadedNote')
              : t('settings.sampleDevOnly')
          }
        >
          <SettingsRow
            testID="settings-open-gallery"
            label={t('settings.galleryRow')}
            showChevron
            onPress={() => router.push('/dev/gallery' as never)}
          />
          <SettingsRow
            testID="settings-load-sample"
            label={t('settings.sampleLoad')}
            disabled={busy}
            showChevron
            onPress={() => void handleLoadSample()}
          />
          <SettingsRow
            testID="settings-clear-sample"
            label={t('settings.sampleClear')}
            disabled={busy}
            showChevron
            onPress={() => void handleClearSample()}
          />
        </SettingsGroup>
      ) : null}

      {/* Name Sheet */}
      <Sheet
        testID="settings-name-sheet"
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        title={t('settings.nameLabel')}
      >
        <Field
          testID="settings-name-input"
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder={t('settings.namePlaceholder')}
          maxLength={50}
          autoFocus
        />
        <Button
          testID="settings-name-save"
          title={t('common.save')}
          onPress={() => void handleSaveName()}
        />
      </Sheet>

      {/* Currency Sheet */}
      <Sheet
        testID="settings-currency-sheet"
        visible={currencySheetOpen}
        onClose={() => setCurrencySheetOpen(false)}
        title={t('settings.currencyLabel')}
      >
        <Surface padded={false}>
          {CURRENCIES.map((code, idx) => {
            const active = settings.currency === code;
            return (
              <ListRow
                key={code}
                testID={`settings-currency-${code}`}
                title={CURRENCY_FULL[code]}
                showDivider={idx < CURRENCIES.length - 1}
                right={
                  active ? (
                    <AppIcon name="check" size={18} color={theme.colors.accent} />
                  ) : null
                }
                onPress={() => {
                  hapticSelection();
                  void updateSetting('currency', code);
                  setCurrencySheetOpen(false);
                }}
              />
            );
          })}
        </Surface>
      </Sheet>

      {/* Cycle Start Sheet */}
      <Sheet
        testID="settings-cycle-sheet"
        visible={cycleSheetOpen}
        onClose={() => setCycleSheetOpen(false)}
        title={t('settings.monthStartLabel')}
        footer={
          <Button
            testID="settings-cycle-save"
            title={t('common.save')}
            onPress={() => void handleSaveCycleDay()}
          />
        }
      >
        <DayOfMonthGrid
          testID="settings-cycle-grid"
          value={cycleDayDraft}
          onChange={setCycleDayDraft}
        />
        <Surface variant="soft">
          <AppText
            testID="settings-cycle-preview"
            variant="label"
            color="accent"
          >
            {t('settings.cyclePreview', { range: draftCyclePreview })}
          </AppText>
        </Surface>
      </Sheet>

      {/* Appearance Sheet with 3 Swatches */}
      <Sheet
        testID="settings-appearance-sheet"
        visible={appearanceSheetOpen}
        onClose={() => setAppearanceSheetOpen(false)}
        title={t('settings.themeLabel')}
      >
        <View style={[styles.swatchRow, { gap: theme.spacing.sm }]}>
          {(
            [
              { pref: 'system', label: t('settings.themeSystem') },
              { pref: 'light', label: t('settings.themeLight') },
              { pref: 'dark', label: t('settings.themeDark') },
            ] as const
          ).map(({ pref, label }) => {
            const selected = settings.theme === pref;
            return (
              <Pressable
                key={pref}
                testID={`settings-theme-${pref}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  void updateSetting('theme', pref);
                  setAppearanceSheetOpen(false);
                }}
                style={({ pressed }) => [
                  styles.swatchCard,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: selected ? theme.colors.accent : 'transparent',
                    borderRadius: theme.radius.card,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    opacity: pressed && !reducedMotion ? 0.8 : 1,
                  },
                ]}
              >
                {/* Mini UI preview frame */}
                <View style={styles.swatchPreviewFrame}>
                  {pref === 'system' ? (
                    <View style={styles.splitPreview}>
                      <View style={[styles.splitHalf, { backgroundColor: '#F5F5F7' }]}>
                        <View style={[styles.miniCard, { backgroundColor: '#FFFFFF' }]}>
                          <View style={[styles.miniBar, { backgroundColor: '#097A52' }]} />
                        </View>
                      </View>
                      <View style={[styles.splitHalf, { backgroundColor: '#0A0A0C' }]}>
                        <View style={[styles.miniCard, { backgroundColor: '#151518' }]}>
                          <View style={[styles.miniBar, { backgroundColor: '#34D399' }]} />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.solidPreview,
                        { backgroundColor: pref === 'light' ? '#F5F5F7' : '#0A0A0C' },
                      ]}
                    >
                      <View
                        style={[
                          styles.miniCard,
                          {
                            backgroundColor: pref === 'light' ? '#FFFFFF' : '#151518',
                            padding: 6,
                            gap: 4,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.miniLine,
                            { backgroundColor: pref === 'light' ? '#0B0B0D' : '#F4F4F5' },
                          ]}
                        />
                        <View
                          style={[
                            styles.miniBar,
                            { backgroundColor: pref === 'light' ? '#097A52' : '#34D399' },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.swatchLabelRow}>
                  <AppText
                    variant="label"
                    color={selected ? 'accent' : 'text'}
                    numberOfLines={1}
                  >
                    {label}
                  </AppText>
                  {selected ? (
                    <AppIcon name="check" size={14} color={theme.colors.accent} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {/* Reminder Permission Explanation Sheet */}
      <Sheet
        testID="settings-reminder-explain-sheet"
        visible={reminderExplainOpen}
        onClose={() => setReminderExplainOpen(false)}
        title={t('settings.reminderExplainTitle')}
      >
        <AppText variant="body" color="textSecondary">
          {t('settings.reminderExplainBody')}
        </AppText>
        <View style={[styles.sheetActions, { gap: theme.spacing.sm }]}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            onPress={() => setReminderExplainOpen(false)}
            style={styles.flexOne}
          />
          <Button
            title={t('settings.reminderExplainContinue')}
            variant="primary"
            onPress={() => void handleConfirmReminderPermission()}
            style={styles.flexOne}
          />
        </View>
      </Sheet>

      {/* Delete All Data Sheet (type DELETE) */}
      <Sheet
        testID="settings-delete-sheet"
        visible={deleteSheetOpen}
        onClose={() => {
          if (!busy) setDeleteSheetOpen(false);
        }}
        title={t('settings.deleteAllStep1Title')}
      >
        <AppText variant="body" color="textSecondary">
          {t('settings.deleteAllStep1Body')}
        </AppText>
        <Field
          testID="settings-delete-confirm-input"
          label={t('settings.deleteAllTypePrompt')}
          value={deleteConfirmText}
          onChangeText={setDeleteConfirmText}
          placeholder={t('settings.deleteAllTypePlaceholder')}
          autoCapitalize="characters"
        />
        <Button
          testID="settings-delete-confirm-btn"
          title={t('settings.deleteAllStep2Confirm')}
          variant="danger"
          loading={busy}
          disabled={!canConfirmDelete}
          onPress={() => void handleDeleteAll()}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatchRow: {
    flexDirection: 'row',
  },
  swatchCard: {
    flex: 1,
    borderWidth: 2,
    alignItems: 'center',
  },
  swatchPreviewFrame: {
    width: '100%',
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
  },
  splitPreview: {
    flex: 1,
    flexDirection: 'row',
  },
  splitHalf: {
    flex: 1,
    padding: 4,
    justifyContent: 'center',
  },
  solidPreview: {
    flex: 1,
    padding: 6,
    justifyContent: 'center',
  },
  miniCard: {
    borderRadius: 6,
    padding: 4,
  },
  miniLine: {
    width: '65%',
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  miniBar: {
    width: '85%',
    height: 6,
    borderRadius: 3,
  },
  swatchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sheetActions: {
    flexDirection: 'row',
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
});
