import { useOnboardingPreview } from '@/state/onboardingPreview';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { isDevVariant } from '@/config/appVariant';
import {
  buildBackupPreview,
  epochMsToLocalDate,
  exportBackupJson,
  parseAndValidateBackup,
  restoreBackupPayload,
  type BackupFilePayload,
  type BackupPreview,
} from '@/data/backup';
import {
  makeBackupFilename,
  pickAndReadBackupFile,
  saveBackupToDeviceFolder,
  shareBackupFile,
} from '@/data/backupFiles';
import { runDeleteAllData } from '@/data/deleteAll';
import { buildSampleTransactions } from '@/data/sampleData';
import { formatShortDate, todayLocalDate } from '@/domain/dates';
import { formatMoney, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import { usePrivacyStore } from '@/state/privacyStore';
import { toBnDigits } from '@/i18n/displayText';
import { formatCycleLabel, getPeriod } from '@/domain/period';
import {
  ACCENT_THEMES,
  ALL_REMINDER_DAYS,
  APP_LANGUAGES,
  AVATAR_COLOR_KEYS,
  BANGLA_FONT_KEYS,
  BILL_REMINDER_LEAD_DAYS,
  CURRENCIES,
  EXPENSE_COLOR_KEYS,
  INCOME_COLOR_KEYS,
  SUN_THU_REMINDER_DAYS,
  type AccentTheme,
  type AppLanguage,
  type AvatarPresetId,
  type BanglaFontKey,
  type BillReminderLeadDays,
  type CurrencyCode,
  type ExpenseColorKey,
  type IncomeColorKey,
  type ReminderSettings,
  type ThemePreference,
} from '@/domain/types';
import { MAX_PROFILE_NAME_LENGTH } from '@/domain/validation';
import { setLocale, t, useLocale, type TranslationKey } from '@/i18n';
import {
  getNotificationPermissionStatus,
  isNotificationsSupported,
  requestNotificationPermission,
  syncReminderSchedule,
} from '@/notifications/reminders';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { useSettings } from '@/state/useSettings';
import { useLockState } from '@/state/LockContext';
import {
  ACCENT_DEFINITIONS,
  BANGLA_FONT_FAMILIES,
  blackColors,
  darkColors,
  EXPENSE_COLOR_PRESETS,
  INCOME_COLOR_PRESETS,
  lightColors,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppLockSettings } from '@/ui/AppLockSettings';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { AVATAR_CATALOG } from '@/ui/AvatarArt';
import { AVATAR_PHOTO_SETS } from '@/ui/avatarPhotos';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DailyWageSheet } from '@/ui/DailyWageSheet';
import { DayOfMonthGrid } from '@/ui/DayOfMonthGrid';
import { DayToggles } from '@/ui/DayToggles';
import { Field } from '@/ui/Field';
import { hapticLight, hapticSelection, hapticSuccess, setHapticsEnabled } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { ListRow } from '@/ui/ListRow';
import { PillSwitch } from '@/ui/PillSwitch';
import { getProfileAvatarColors, ProfileAvatar } from '@/ui/ProfileAvatar';
import { Screen } from '@/ui/Screen';
import { SettingsGroup } from '@/ui/SettingsGroup';
import { SettingsRow } from '@/ui/SettingsRow';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { TimeField } from '@/ui/TimeField';
import { useToast } from '@/ui/Toast';
import { PressableScale } from '@/ui/PressableScale';

const CURRENCY_SHORT: Record<CurrencyCode, string> = {
  BDT: 'BDT ৳',
  USD: 'USD $',
  EUR: 'EUR €',
};

const CURRENCY_FULL_KEYS: Record<CurrencyCode, TranslationKey> = {
  BDT: 'settings.currencyBdtFull',
  USD: 'settings.currencyUsdFull',
  EUR: 'settings.currencyEurFull',
};

const BILL_LEAD_KEYS: Record<BillReminderLeadDays, TranslationKey> = {
  0: 'settings.billRemindersLead0',
  1: 'settings.billRemindersLead1',
  3: 'settings.billRemindersLead3',
};

function formatOrdinal(day: number, locale: AppLanguage): string {
  if (locale === 'bn') return String(day);
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
  const locale = useLocale();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ openBackup?: string }>();
  const { showToast } = useToast();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const { repo, backend, settings, hasTransactions, updateSetting, refreshSettings } =
    useSettings();
  const lockState = useLockState();

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(text, fontSize) } : undefined;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const [activeCategoryCount, setActiveCategoryCount] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sheet states
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(settings.name);
  const [avatarTab, setAvatarTab] = useState<string>('notionists');

  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [banglaFontSheetOpen, setBanglaFontSheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);

  const [cycleSheetOpen, setCycleSheetOpen] = useState(false);
  const [cycleDayDraft, setCycleDayDraft] = useState(settings.monthStartDay);

  const [appearanceSheetOpen, setAppearanceSheetOpen] = useState(false);
  const [dailyWageSheetOpen, setDailyWageSheetOpen] = useState(false);

  const [reminderExplainOpen, setReminderExplainOpen] = useState(false);
  const [billLeadSheetOpen, setBillLeadSheetOpen] = useState(false);
  const [billBlocked, setBillBlocked] = useState(false);

  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [backupSheetOpen, setBackupSheetOpen] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    payload: BackupFilePayload;
    preview: BackupPreview;
  } | null>(null);
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (params.openBackup === '1') {
        setBackupError(null);
        setBackupSheetOpen(true);
        router.setParams({ openBackup: undefined });
      }
    }, [params.openBackup, router])
  );

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
    if (settings.billReminders.enabled) {
      await updateSetting('billReminders', { ...settings.billReminders, enabled: false });
    }
  }, [
    applyReminderUpdate,
    settings.notificationPermissionDenied,
    settings.reminder,
    settings.billReminders,
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

  /**
   * Turning bill reminders on is the only place that asks for notification permission for them.
   * The reminders themselves are scheduled by `useBillReminderSync` once the setting is saved.
   */
  const handleToggleBillReminders = async (nextEnabled: boolean) => {
    if (!nextEnabled) {
      setBillBlocked(false);
      await updateSetting('billReminders', { ...settings.billReminders, enabled: false });
      return;
    }
    if (!isNotificationsSupported()) {
      await updateSetting('billReminders', { ...settings.billReminders, enabled: true });
      return;
    }
    let granted = false;
    const status = await getNotificationPermissionStatus();
    if (status === 'granted') {
      granted = true;
    } else if (status === 'undetermined') {
      granted = (await requestNotificationPermission()) === 'granted';
    }
    if (granted) {
      setBillBlocked(false);
      if (settings.notificationPermissionDenied) {
        await updateSetting('notificationPermissionDenied', false);
      }
      await updateSetting('billReminders', { ...settings.billReminders, enabled: true });
      return;
    }
    setBillBlocked(true);
    const afterStatus = await getNotificationPermissionStatus();
    await updateSetting('notificationPermissionDenied', afterStatus === 'denied');
    await updateSetting('billReminders', { ...settings.billReminders, enabled: false });
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
      await runDeleteAllData(repo);
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

  const handleShareBackup = async () => {
    if (busy) return;
    setBusy(true);
    setBackupError(null);
    setActionError(null);
    try {
      const json = await exportBackupJson(repo);
      await shareBackupFile(json, makeBackupFilename(todayLocalDate()));
      await updateSetting('lastBackupAt', Date.now());
      hapticSuccess();
      showToast({ message: t('settings.backupSavedToast') });
    } catch (err) {
      setBackupError(
        err instanceof Error && err.message ? err.message : t('settings.backupErrorGeneric')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBackupFolder = async () => {
    if (busy) return;
    setBusy(true);
    setBackupError(null);
    setActionError(null);
    try {
      const json = await exportBackupJson(repo);
      const saved = await saveBackupToDeviceFolder(json, makeBackupFilename(todayLocalDate()));
      if (!saved.saved) return;
      await updateSetting('lastBackupAt', Date.now());
      hapticSuccess();
      showToast({ message: t('settings.backupSavedToast') });
    } catch (err) {
      setBackupError(
        err instanceof Error && err.message ? err.message : t('settings.backupErrorGeneric')
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePickBackupFile = async () => {
    if (busy) return;
    setBusy(true);
    setBackupError(null);
    setActionError(null);
    try {
      const picked = await pickAndReadBackupFile();
      if (picked.canceled) return;
      const payload = parseAndValidateBackup(picked.content);
      const preview = buildBackupPreview(payload);
      setBackupSheetOpen(false);
      setPendingRestore({ payload, preview });
    } catch (err) {
      setBackupError(
        err instanceof Error && err.message ? err.message : t('settings.backupErrorGeneric')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (busy || !pendingRestore) return;
    setBusy(true);
    setActionError(null);
    const { payload } = pendingRestore;
    try {
      await restoreBackupPayload(repo, payload);
      setPendingRestore(null);
      await refreshSettings();
      await syncReminderSchedule(payload.data.settings.reminder);
      bumpDataVersion();
      hapticSuccess();
      showToast({ message: t('settings.backupRestoredToast') });
    } catch (err) {
      setPendingRestore(null);
      setActionError(
        err instanceof Error && err.message ? err.message : t('settings.backupErrorGeneric')
      );
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

  const ACCENT_LABEL_KEYS: Record<AccentTheme, TranslationKey> = {
    forest: 'settings.accentForest',
    ocean: 'settings.accentOcean',
    plum: 'settings.accentPlum',
    saffron: 'settings.accentSaffron',
    graphite: 'settings.accentGraphite',
  };

  const BANGLA_FONT_OPTIONS: readonly {
    key: BanglaFontKey;
    labelKey: TranslationKey;
    descKey: TranslationKey;
  }[] = [
    {
      key: 'noto_sans_bengali',
      labelKey: 'settings.banglaFontNotoSans',
      descKey: 'settings.banglaFontNotoSansDesc',
    },
    {
      key: 'anek_bangla',
      labelKey: 'settings.banglaFontAnek',
      descKey: 'settings.banglaFontAnekDesc',
    },
    {
      key: 'solaiman_lipi',
      labelKey: 'settings.banglaFontSolaiman',
      descKey: 'settings.banglaFontSolaimanDesc',
    },
    {
      key: 'kalpurush',
      labelKey: 'settings.banglaFontKalpurush',
      descKey: 'settings.banglaFontKalpurushDesc',
    },
    {
      key: 'nikosh',
      labelKey: 'settings.banglaFontNikosh',
      descKey: 'settings.banglaFontNikoshDesc',
    },
    {
      key: 'sutuji',
      labelKey: 'settings.banglaFontSutuji',
      descKey: 'settings.banglaFontSutujiDesc',
    },
    {
      key: 'hind_siliguri',
      labelKey: 'settings.banglaFontHind',
      descKey: 'settings.banglaFontHindDesc',
    },
  ];

  const INCOME_TONE_LABEL_KEYS: Record<IncomeColorKey, TranslationKey> = {
    emerald: 'settings.moneyToneEmerald',
    teal: 'settings.moneyToneTeal',
    ocean: 'settings.moneyToneOcean',
    violet: 'settings.moneyToneViolet',
    gold: 'settings.moneyToneGold',
    ink: 'settings.moneyToneInk',
  };

  const EXPENSE_TONE_LABEL_KEYS: Record<ExpenseColorKey, TranslationKey> = {
    ink: 'settings.moneyToneInk',
    crimson: 'settings.moneyToneCrimson',
    rose: 'settings.moneyToneRose',
    amber: 'settings.moneyToneAmber',
    plum: 'settings.moneyTonePlum',
    teal: 'settings.moneyToneTeal',
  };

  const activeBanglaFontOption =
    BANGLA_FONT_OPTIONS.find((opt) => opt.key === settings.banglaFont) ??
    BANGLA_FONT_OPTIONS[0];

  const trimmedName = settings.name.trim();
  const initialLetter = trimmedName ? trimmedName.charAt(0).toUpperCase() : 'H';

  const modeLabel =
    settings.theme === 'light'
      ? t('settings.themeLight')
      : settings.theme === 'dark'
        ? t('settings.themeDark')
        : settings.theme === 'black'
          ? t('settings.themeBlack')
          : t('settings.themeSystem');
  const appearanceLabel = `${t(ACCENT_LABEL_KEYS[settings.accent])} · ${modeLabel}`;

  const today = todayLocalDate();
  const draftCyclePreview = formatCycleLabel(
    getPeriod(today, cycleDayDraft),
    cycleDayDraft,
    { includeYear: false, locale }
  );

  const selectedDays = settings.reminder.days;
  const isEveryDay = sameDays(selectedDays, ALL_REMINDER_DAYS);
  const isSunThu = sameDays(selectedDays, SUN_THU_REMINDER_DAYS);
  const reminderActive = settings.reminder.enabled && !settings.notificationPermissionDenied;
  const billActive = settings.billReminders.enabled && !settings.notificationPermissionDenied;
  const billSupported = isNotificationsSupported();
  const appLockOn = lockState.enabled || settings.appLockEnabled;
  const billHideNamesOn = appLockOn || settings.billReminders.hideNames === true;
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
          onPress={handleBack}
        />
        <AppText variant="title" style={styles.flexOne} numberOfLines={1}>
          {t('settings.title')}
        </AppText>
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
            <ProfileAvatar
              name={trimmedName || initialLetter}
              colorKey={settings.avatarColorKey}
              avatarId={settings.avatarId}
              size={42}
            />
          }
          onPress={() => {
            hapticLight();
            setNameDraft(settings.name);
            const activeSpec = AVATAR_CATALOG.find((a) => a.id === settings.avatarId);
            setAvatarTab(activeSpec ? activeSpec.category : 'professional');
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
          testID="settings-language-row"
          label={t('settings.languageLabel')}
          value={
            settings.language === 'bn' ? t('settings.languageBn') : t('settings.languageEn')
          }
          showChevron
          onPress={() => {
            hapticLight();
            setLanguageSheetOpen(true);
          }}
        />
        <SettingsRow
          testID="settings-bangla-font-row"
          label={t('settings.banglaFontLabel')}
          value={t(activeBanglaFontOption.labelKey)}
          showChevron
          onPress={() => {
            hapticLight();
            setBanglaFontSheetOpen(true);
          }}
        />
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
            ordinal: formatOrdinal(settings.monthStartDay, locale),
          })}
          showChevron
          onPress={() => {
            hapticLight();
            setCycleDayDraft(settings.monthStartDay);
            setCycleSheetOpen(true);
          }}
        />
        <SettingsRow
          testID="settings-daily-wage-row"
          label={t('settings.dailyWageRow')}
          value={
            settings.dailyWage
              ? hideAmounts
                ? HIDDEN_AMOUNT_TEXT
                : locale === 'bn'
                  ? toBnDigits(
                      formatMoney(settings.dailyWage.amountMinor, settings.currency, { showPoisha })
                    )
                  : formatMoney(settings.dailyWage.amountMinor, settings.currency, { showPoisha })
              : t('settings.dailyWageNotSet')
          }
          showChevron
          onPress={() => {
            hapticLight();
            setDailyWageSheetOpen(true);
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
        <SettingsRow
          testID="settings-haptics-row"
          label={t('settings.hapticsLabel')}
          subtitle={t('settings.hapticsSubtitle')}
          trailing={
            <PillSwitch
              testID="settings-haptics-switch"
              accessibilityLabel={t('settings.hapticsLabel')}
              value={settings.hapticsEnabled !== false}
              onValueChange={(val) => {
                setHapticsEnabled(val);
                if (val) hapticSelection();
                void updateSetting('hapticsEnabled', val);
              }}
            />
          }
        />
        <SettingsRow
          testID="settings-smart-inbox-row"
          label={t('settings.smartInboxRow')}
          subtitle={t('settings.smartInboxSubtitle')}
          showChevron
          onPress={() => {
            hapticLight();
            router.push('/inbox' as never);
          }}
        />
      </SettingsGroup>

      {/* SECURITY: renders nothing where secure storage is unavailable */}
      <AppLockSettings />

      {/* REMINDERS */}
      <SettingsGroup
        title={t('settings.sectionReminders')}
        footer={!isNotificationsSupported() ? t('settings.reminderWebNote') : undefined}
      >
        <SettingsRow
          label={t('settings.reminderToggle')}
          trailing={
            <PillSwitch
              testID="settings-reminder-switch"
              accessibilityLabel={t('settings.reminderToggle')}
              value={reminderActive}
              onValueChange={(val) => void handleToggleReminder(val)}
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

        {billSupported ? (
          <>
            <SettingsRow
              label={t('settings.billRemindersToggle')}
              subtitle={t('settings.billRemindersSubtitle')}
              trailing={
                <PillSwitch
                  testID="settings-bill-reminders-switch"
                  accessibilityLabel={t('settings.billRemindersToggle')}
                  value={billActive}
                  onValueChange={(val) => void handleToggleBillReminders(val)}
                />
              }
            />

            {billBlocked && !billActive ? (
              <View
                testID="settings-bill-reminders-blocked"
                style={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  gap: theme.spacing.sm,
                }}
              >
                <AppText variant="caption" color="textSecondary">
                  {t('settings.billRemindersBlocked')}
                </AppText>
                <Button
                  testID="settings-bill-open-system-settings"
                  title={t('settings.openSystemSettings')}
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    Linking.openSettings().catch(() => {});
                  }}
                />
              </View>
            ) : null}

            {billActive ? (
              <SettingsRow
                testID="settings-bill-lead-row"
                label={t('settings.billRemindersLead')}
                value={t(BILL_LEAD_KEYS[settings.billReminders.leadDays])}
                showChevron
                onPress={() => {
                  hapticLight();
                  setBillLeadSheetOpen(true);
                }}
              />
            ) : null}

            {billActive ? (
              <SettingsRow
                label={t('settings.billRemindersHideNames')}
                subtitle={appLockOn ? t('settings.billRemindersHideNamesLocked') : undefined}
                trailing={
                  <PillSwitch
                    testID="settings-bill-hide-names-switch"
                    accessibilityLabel={t('settings.billRemindersHideNames')}
                    value={billHideNamesOn}
                    disabled={appLockOn}
                    onValueChange={(val) =>
                      void updateSetting('billReminders', {
                        ...settings.billReminders,
                        hideNames: val,
                      })
                    }
                  />
                }
              />
            ) : null}
          </>
        ) : null}
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
          testID="settings-backup-row"
          label={t('settings.backupRow')}
          showChevron
          onPress={() => {
            hapticLight();
            setBackupError(null);
            setBackupSheetOpen(true);
          }}
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
          testID="settings-last-backup-row"
          label={t('settings.lastBackupRow')}
          value={
            settings.lastBackupAt !== null
              ? formatShortDate(epochMsToLocalDate(settings.lastBackupAt), locale)
              : t('settings.backupNeverShort')
          }
          showChevron
          onPress={() => {
            hapticLight();
            setBackupError(null);
            setBackupSheetOpen(true);
          }}
        />
        <SettingsRow
          testID="settings-privacy-row"
          label={t('settings.privacyRow')}
          value={t('settings.privacyValue')}
          showChevron
          onPress={() => {
            hapticLight();
            setPrivacySheetOpen(true);
          }}
        />
        <SettingsRow
          testID="settings-how-numbers-row"
          label={t('overview.howNumbersWork')}
          showChevron
          onPress={() => {
            hapticLight();
            router.push({ pathname: '/', params: { howItWorks: '1' } } as never);
          }}
        />
        <SettingsRow
          label={t('settings.aboutVersionLine')}
          subtitle={t('settings.aboutDesc', { backend })}
        />
      </SettingsGroup>

      {/* DEVELOPER (dev variant only) */}
      {isDevVariant() ? (
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
            testID="settings-replay-welcome"
            label={t('settings.replayWelcomeRow')}
            showChevron
            onPress={() => {
              useOnboardingPreview.getState().setOn(true);
              router.push('/onboarding' as never);
            }}
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

      {/* Name & Avatar Sheet */}
      <Sheet
        testID="settings-name-sheet"
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        title={t('settings.nameLabel')}
      >
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <ProfileAvatar
            name={nameDraft.trim() || initialLetter}
            colorKey={settings.avatarColorKey}
            avatarId={settings.avatarId}
            size={68}
          />
        </View>

        <Field
          testID="settings-name-input"
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder={t('settings.namePlaceholder')}
          maxLength={MAX_PROFILE_NAME_LENGTH}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color="textSecondary">
            {t('settings.avatarGalleryLabel')}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.xs, paddingVertical: 10, paddingHorizontal: 6 }}
            style={{ flexGrow: 0, marginVertical: -8, marginHorizontal: -6 }}
          >
            {[
              ...AVATAR_PHOTO_SETS.map((set) => ({ id: set.id as string, label: set.name as string })),
              { id: 'professional', label: t('settings.avatarGroupProfessional') },
              { id: 'tropical', label: t('settings.avatarGroupTropical') },
              { id: 'abstract', label: t('settings.avatarGroupAbstract') },
              { id: 'initial', label: t('settings.avatarGroupInitial') },
            ].map((tab) => (
              <Chip
                key={tab.id}
                testID={`settings-avatar-tab-${tab.id}`}
                label={tab.label}
                variant="sunken"
                selected={avatarTab === tab.id}
                onPress={() => {
                  hapticSelection();
                  setAvatarTab(tab.id);
                }}
              />
            ))}
          </ScrollView>

          {avatarTab === 'initial' ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={styles.avatarChoiceRow}>
                <PressableScale
                  pressScale={0.96}
                  testID="settings-avatar-choice-initial"
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.avatarGroupInitial')}
                  accessibilityState={{ selected: settings.avatarId === 'initial' }}
                  onPress={() => {
                    hapticSelection();
                    void updateSetting('avatarId', 'initial');
                  }}
                  style={[
                    styles.avatarChoiceRing,
                    {
                      borderColor:
                        settings.avatarId === 'initial' ? theme.colors.accent : 'transparent',
                    },
                  ]}
                >
                  <ProfileAvatar
                    name={nameDraft.trim() || initialLetter}
                    colorKey={settings.avatarColorKey}
                    avatarId="initial"
                    size={54}
                  />
                </PressableScale>
              </View>
              <AppText variant="caption" color="textSecondary">
                {t('settings.avatarColorLabel')}
              </AppText>
              <View style={[styles.toneRow, { gap: theme.spacing.sm }]}>
                {AVATAR_COLOR_KEYS.map((colorKey) => {
                  const selected = settings.avatarColorKey === colorKey;
                  const swatch = getProfileAvatarColors(colorKey, theme).fg;
                  return (
                    <PressableScale
                      key={colorKey}
                      pressScale={0.94}
                      testID={`settings-avatar-color-${colorKey}`}
                      accessibilityRole="button"
                      accessibilityLabel={colorKey}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        hapticSelection();
                        void updateSetting('avatarColorKey', colorKey);
                        if (settings.avatarId !== 'initial') {
                          void updateSetting('avatarId', 'initial');
                        }
                      }}
                      style={[
                        styles.toneRing,
                        {
                          borderColor: selected ? theme.colors.text : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.toneDot, { backgroundColor: swatch }]}>
                        {selected ? <AppIcon name="check" size={14} color={lightColors.onAccent} /> : null}
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.avatarChoiceRow}>
              {(AVATAR_PHOTO_SETS.some((set) => set.id === avatarTab)
                ? Array.from({ length: 16 }, (_, i) => ({
                    id: `ph_${avatarTab}_${String(i + 1).padStart(2, '0')}`,
                  }))
                : AVATAR_CATALOG.filter((item) => item.category === avatarTab)
              ).map((item) => {
                const selected = settings.avatarId === item.id;
                return (
                  <PressableScale
                    key={item.id}
                    pressScale={0.94}
                    testID={`settings-avatar-choice-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={item.id}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      void updateSetting('avatarId', item.id as AvatarPresetId);
                    }}
                    style={[
                      styles.avatarChoiceRing,
                      {
                        borderColor: selected ? theme.colors.accent : theme.colors.cardBorder,
                      },
                    ]}
                  >
                    <ProfileAvatar
                      name={nameDraft.trim() || initialLetter}
                      avatarId={item.id as AvatarPresetId}
                      size={56}
                    />
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>

        <Button
          testID="settings-name-save"
          title={t('common.save')}
          onPress={() => void handleSaveName()}
        />
      </Sheet>

      {/* Language Sheet */}
      <Sheet
        testID="settings-language-sheet"
        visible={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        title={t('settings.languageLabel')}
      >
        <Surface padded={false}>
          {APP_LANGUAGES.map((code: AppLanguage, idx) => {
            const active = settings.language === code;
            const label = code === 'bn' ? 'বাংলা' : 'English';
            return (
              <ListRow
                key={code}
                testID={`settings-language-${code}`}
                title={label}
                showDivider={idx < APP_LANGUAGES.length - 1}
                right={
                  active ? (
                    <AppIcon name="check" size={18} color={theme.colors.accent} />
                  ) : null
                }
                onPress={() => {
                  hapticSelection();
                  setLocale(code);
                  void updateSetting('language', code);
                  setLanguageSheetOpen(false);
                }}
              />
            );
          })}
        </Surface>
      </Sheet>

      {/* Bill reminder lead time Sheet */}
      <Sheet
        testID="settings-bill-lead-sheet"
        visible={billLeadSheetOpen}
        onClose={() => setBillLeadSheetOpen(false)}
        title={t('settings.billRemindersLead')}
      >
        <Surface padded={false}>
          {BILL_REMINDER_LEAD_DAYS.map((days, idx) => {
            const active = settings.billReminders.leadDays === days;
            return (
              <ListRow
                key={days}
                testID={`settings-bill-lead-${days}`}
                title={t(BILL_LEAD_KEYS[days])}
                showDivider={idx < BILL_REMINDER_LEAD_DAYS.length - 1}
                right={
                  active ? <AppIcon name="check" size={18} color={theme.colors.accent} /> : null
                }
                onPress={() => {
                  hapticSelection();
                  void updateSetting('billReminders', { ...settings.billReminders, leadDays: days });
                  setBillLeadSheetOpen(false);
                }}
              />
            );
          })}
        </Surface>
      </Sheet>

      {/* Bangla Font Sheet */}
      <Sheet
        testID="settings-bangla-font-sheet"
        visible={banglaFontSheetOpen}
        onClose={() => setBanglaFontSheetOpen(false)}
        title={t('settings.banglaFontSheetTitle')}
      >
        <AppText variant="caption" color="textSecondary">
          {t('settings.banglaFontSubtitle')}
        </AppText>
        <Surface padded={false}>
          {BANGLA_FONT_KEYS.map((fontKey, idx) => {
            const option =
              BANGLA_FONT_OPTIONS.find((item) => item.key === fontKey) ?? BANGLA_FONT_OPTIONS[0];
            const active = settings.banglaFont === fontKey;
            const fontPair = BANGLA_FONT_FAMILIES[fontKey];
            return (
              <PressableScale
                key={fontKey}
                pressScale={0.99}
                testID={`settings-bangla-font-${fontKey}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  void updateSetting('banglaFont', fontKey);
                  setBanglaFontSheetOpen(false);
                }}
                style={[
                  styles.fontOptionRow,
                  {
                    borderBottomColor: theme.colors.separator,
                    borderBottomWidth: idx < BANGLA_FONT_KEYS.length - 1 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <View style={styles.flexOne}>
                  <AppText variant="bodyStrong" color="text">
                    {t(option.labelKey)}
                  </AppText>
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {t(option.descKey)}
                  </AppText>
                  <AppText
                    variant="body"
                    color="accent"
                    style={{ fontFamily: fontPair.semibold, marginTop: 2 }}
                  >
                    {t('settings.banglaFontPreview')}
                  </AppText>
                </View>
                {active ? <AppIcon name="check" size={18} color={theme.colors.accent} /> : null}
              </PressableScale>
            );
          })}
        </Surface>
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
                title={t(CURRENCY_FULL_KEYS[code])}
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

      <DailyWageSheet visible={dailyWageSheetOpen} onClose={() => setDailyWageSheetOpen(false)} />

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

      {/* Appearance Sheet: 5 Accents × 4 Modes */}
      <Sheet
        testID="settings-appearance-sheet"
        visible={appearanceSheetOpen}
        onClose={() => setAppearanceSheetOpen(false)}
        title={t('settings.themeLabel')}
      >
        <View style={{ gap: theme.spacing.lg }}>
          {/* 5 Accent swatches */}
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('settings.accentLabel')}
            </AppText>
            <View style={styles.accentRow}>
              {ACCENT_THEMES.map((accentId) => {
                const def = ACCENT_DEFINITIONS[accentId];
                const selected = settings.accent === accentId;
                const label = t(ACCENT_LABEL_KEYS[accentId]);
                return (
                  <PressableScale pressScale={0.98}
                    key={accentId}
                    testID={`settings-accent-${accentId}`}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      void updateSetting('accent', accentId);
                    }}
                    style={({ pressed }) => [
                      styles.accentItem,
                      { opacity: pressed && !reducedMotion ? 0.8 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.accentOuterRing,
                        {
                          borderColor: selected ? theme.colors.text : 'transparent',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.accentSwatch,
                          { backgroundColor: def.swatchColor },
                        ]}
                      >
                        {selected ? <AppIcon name="check" size={16} color={lightColors.onAccent} /> : null}
                      </View>
                    </View>
                    <AppText
                      variant="caption"
                      color={selected ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* 4 Modes: System · Light · Dark · Black */}
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('settings.modeLabel')}
            </AppText>
            <View style={[styles.swatchGrid, { gap: theme.spacing.sm }]}>
              {(
                [
                  { pref: 'system', label: t('settings.themeSystem') },
                  { pref: 'light', label: t('settings.themeLight') },
                  { pref: 'dark', label: t('settings.themeDark') },
                  { pref: 'black', label: t('settings.themeBlack') },
                ] as { pref: ThemePreference; label: string }[]
              ).map(({ pref, label }) => {
                const selected = settings.theme === pref;
                const activeAccentDef = ACCENT_DEFINITIONS[settings.accent];
                const previewPalette =
                  pref === 'light' ? lightColors : pref === 'black' ? blackColors : darkColors;
                const bgHex = previewPalette.bg;
                const surfaceHex = previewPalette.surface;
                const lineHex = previewPalette.ink;
                const barHex =
                  pref === 'light'
                    ? activeAccentDef.light.accent
                    : activeAccentDef.dark.accent;

                return (
                  <PressableScale pressScale={0.98}
                    key={pref}
                    testID={`settings-theme-${pref}`}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      void updateSetting('theme', pref);
                    }}
                    style={({ pressed }) => [
                      styles.swatchCard,
                      {
                        backgroundColor: theme.colors.surfaceSunken,
                        borderColor: selected ? theme.colors.text : 'transparent',
                        borderRadius: theme.radius.card,
                        padding: theme.spacing.sm,
                        gap: theme.spacing.xs,
                        opacity: pressed && !reducedMotion ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={styles.swatchPreviewFrame}>
                      {pref === 'system' ? (
                        <View style={styles.splitPreview}>
                          <View style={[styles.splitHalf, { backgroundColor: lightColors.bg }]}>
                            <View style={[styles.miniCard, { backgroundColor: lightColors.surface }]}>
                              <View
                                style={[
                                  styles.miniBar,
                                  { backgroundColor: activeAccentDef.light.accent },
                                ]}
                              />
                            </View>
                          </View>
                          <View style={[styles.splitHalf, { backgroundColor: darkColors.bg }]}>
                            <View style={[styles.miniCard, { backgroundColor: darkColors.surface }]}>
                              <View
                                style={[
                                  styles.miniBar,
                                  { backgroundColor: activeAccentDef.dark.accent },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.solidPreview, { backgroundColor: bgHex }]}>
                          <View
                            style={[
                              styles.miniCard,
                              {
                                backgroundColor: surfaceHex,
                                padding: 6,
                                gap: 4,
                              },
                            ]}
                          >
                            <View style={[styles.miniLine, { backgroundColor: lineHex }]} />
                            <View style={[styles.miniBar, { backgroundColor: barHex }]} />
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={styles.swatchLabelRow}>
                      <AppText
                        variant="label"
                        color={selected ? 'text' : 'textSecondary'}
                        numberOfLines={1}
                        style={bnMinWidth(label, theme.typography.label.fontSize)}
                      >
                        {label}
                      </AppText>
                      {selected ? (
                        <AppIcon name="check" size={14} color={theme.colors.text} />
                      ) : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Positive (Money added) colour */}
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('settings.incomeColorLabel')}
            </AppText>
            <View style={[styles.accentRow, { flexWrap: 'wrap', gap: theme.spacing.sm }]}>
              {INCOME_COLOR_KEYS.map((key) => {
                const preset = INCOME_COLOR_PRESETS[key];
                const selected = settings.incomeColor === key;
                const label = t(INCOME_TONE_LABEL_KEYS[key]);
                return (
                  <PressableScale
                    key={key}
                    pressScale={0.96}
                    testID={`settings-income-color-${key}`}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      void updateSetting('incomeColor', key);
                    }}
                    style={styles.accentItem}
                  >
                    <View
                      style={[
                        styles.accentOuterRing,
                        { borderColor: selected ? theme.colors.text : 'transparent' },
                      ]}
                    >
                      <View style={[styles.accentSwatch, { backgroundColor: preset.swatch }]}>
                        {selected ? <AppIcon name="check" size={15} color={lightColors.onAccent} /> : null}
                      </View>
                    </View>
                    <AppText
                      variant="caption"
                      color={selected ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Negative (Money spent) colour */}
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('settings.expenseColorLabel')}
            </AppText>
            <View style={[styles.accentRow, { flexWrap: 'wrap', gap: theme.spacing.sm }]}>
              {EXPENSE_COLOR_KEYS.map((key) => {
                const preset = EXPENSE_COLOR_PRESETS[key];
                const selected = settings.expenseColor === key;
                const label = t(EXPENSE_TONE_LABEL_KEYS[key]);
                return (
                  <PressableScale
                    key={key}
                    pressScale={0.96}
                    testID={`settings-expense-color-${key}`}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      void updateSetting('expenseColor', key);
                    }}
                    style={styles.accentItem}
                  >
                    <View
                      style={[
                        styles.accentOuterRing,
                        { borderColor: selected ? theme.colors.text : 'transparent' },
                      ]}
                    >
                      <View style={[styles.accentSwatch, { backgroundColor: preset.swatch }]}>
                        {selected ? <AppIcon name="check" size={15} color={lightColors.onAccent} /> : null}
                      </View>
                    </View>
                    <AppText
                      variant="caption"
                      color={selected ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
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
            numberOfLines={1}
            onPress={() => setReminderExplainOpen(false)}
            style={styles.actionBtn}
          />
          <Button
            title={t('settings.reminderExplainContinue')}
            variant="primary"
            numberOfLines={1}
            onPress={() => void handleConfirmReminderPermission()}
            style={styles.actionBtn}
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

      {/* Backup & Restore Sheet */}
      <Sheet
        testID="settings-backup-sheet"
        visible={backupSheetOpen}
        onClose={() => {
          if (!busy) setBackupSheetOpen(false);
        }}
        title={t('settings.backupSheetTitle')}
      >
        <Banner
          icon="info"
          tone="neutral"
          message={t('settings.backupPlaintextNotice')}
        />
        {backupError ? (
          <Banner
            testID="settings-backup-error"
            icon="circle-alert"
            tone="danger"
            message={backupError}
          />
        ) : null}
        <Button
          testID="settings-backup-share-btn"
          title={t('settings.backupShareButton')}
          loading={busy}
          onPress={() => void handleShareBackup()}
        />
        {Platform.OS === 'android' ? (
          <Button
            testID="settings-backup-folder-btn"
            title={t('settings.backupSaveFolderButton')}
            variant="secondary"
            loading={busy}
            onPress={() => void handleSaveBackupFolder()}
          />
        ) : null}
        <Button
          testID="settings-backup-restore-btn"
          title={t('settings.backupRestoreButton')}
          variant="secondary"
          disabled={busy}
          onPress={() => void handlePickBackupFile()}
        />
      </Sheet>

      {/* Restore Confirmation Sheet */}
      <Sheet
        testID="settings-restore-confirm-sheet"
        visible={pendingRestore !== null}
        onClose={() => {
          if (!busy) setPendingRestore(null);
        }}
        title={t('settings.backupRestoreTitle')}
      >
        <Banner
          icon="triangle-alert"
          tone="danger"
          message={t('settings.backupRestoreWarning')}
        />
        <View
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceSunken,
            borderWidth: 1,
            borderColor: theme.colors.cardBorder,
          }}
        >
          <AppText testID="settings-restore-preview-summary" variant="bodyStrong">
            {pendingRestore?.preview.summaryLine ?? ''}
          </AppText>
        </View>
        <View style={[styles.sheetActions, { gap: theme.spacing.sm }]}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            numberOfLines={1}
            disabled={busy}
            onPress={() => setPendingRestore(null)}
            style={styles.actionBtn}
          />
          <Button
            testID="settings-restore-confirm-btn"
            title={t('settings.backupRestoreConfirm')}
            variant="danger"
            numberOfLines={1}
            loading={busy}
            onPress={() => void handleConfirmRestore()}
            style={styles.actionBtn}
          />
        </View>
      </Sheet>

      {/* Privacy & Data Storage Sheet */}
      <Sheet
        testID="settings-privacy-sheet"
        visible={privacySheetOpen}
        onClose={() => setPrivacySheetOpen(false)}
        title={t('settings.privacySheetTitle')}
      >
        <AppText variant="body" color="textSecondary">
          {t('settings.privacyLocalBody')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t('settings.privacyCloudBody')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t('settings.privacyVoiceBody')}
        </AppText>
        <Button
          testID="settings-privacy-done-btn"
          title={t('settings.privacyDone')}
          onPress={() => setPrivacySheetOpen(false)}
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
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accentItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  accentOuterRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentSwatch: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatchCard: {
    width: '48%',
    flexGrow: 1,
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
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 120,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  avatarChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  avatarChoiceRing: {
    padding: 3,
    borderRadius: 34,
    borderWidth: 2,
  },
  toneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toneRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneDot: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
