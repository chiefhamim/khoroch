import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { WALLET_PRESETS } from '@/domain/accounts';
import { formatFriendlyTime, formatShortDate, todayLocalDate } from '@/domain/dates';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import { formatCycleLabel, getPeriod, remainingDays } from '@/domain/period';
import { setLocale, t } from '@/i18n';
import {
  getNotificationPermissionStatus,
  isNotificationsSupported,
  syncReminderSchedule,
} from '@/notifications/reminders';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useOnboardingDraft, type OnboardingWalletDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { hapticSuccess } from '@/ui/haptics';
import { Money } from '@/ui/Money';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { SettingsRow } from '@/ui/SettingsRow';
import { Surface } from '@/ui/Surface';

function getDraftBalanceMinor(draft: OnboardingWalletDraft): number {
  const cleanBal = draft.balanceInput.trim();
  if (!cleanBal) return 0;
  const isExplicitNeg = cleanBal.startsWith('-');
  const rawAbs = isExplicitNeg ? cleanBal.slice(1).trim() : cleanBal;
  const parsed = parseMoneyInput(rawAbs);
  if (!parsed.ok || parsed.minor === null) return 0;
  return isExplicitNeg || draft.isDueNegative ? -parsed.minor : parsed.minor;
}

export default function OnboardingDoneScreen() {
  const { theme } = useTheme();
  const { repo, refreshSettings } = useAppContext();
  const router = useRouter();
  const {
    language,
    theme: draftTheme,
    accent: draftAccent,
    name,
    currency,
    monthStartDay,
    budgetInput,
    selectedCategoryIds,
    reminderEnabled,
    reminderTime,
    reminderDays,
    walletDrafts,
    reset,
  } = useOnboardingDraft();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedBudget = budgetInput.trim() ? parseMoneyInput(budgetInput) : null;
  const budgetMinor =
    parsedBudget && parsedBudget.ok && parsedBudget.minor && parsedBudget.minor > 0
      ? parsedBudget.minor
      : null;

  const today = todayLocalDate();
  const period = getPeriod(today, monthStartDay);
  const remainingDaysCount = Math.max(1, remainingDays(period, today));
  const safeDailyMinor =
    budgetMinor !== null ? Math.floor(budgetMinor / remainingDaysCount) : null;
  const cyclePreview = formatCycleLabel(period, monthStartDay, { includeYear: false });

  const enabledWallets = walletDrafts.filter((w) => w.enabled);
  const netIncludedMinor = enabledWallets
    .filter((w) => w.includeInTotal)
    .reduce((sum, w) => sum + getDraftBalanceMinor(w), 0);

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const setSettingAny = repo.setSetting.bind(repo) as (
        key: string,
        value: unknown
      ) => Promise<void>;
      await setSettingAny('language', language);
      setLocale(language);
      await repo.setSetting('theme', draftTheme);
      await repo.setSetting('accent', draftAccent);
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
        await repo.setBudget(period.start, '', budgetMinor);
      }

      const presetByKey = new Map(WALLET_PRESETS.map((p) => [p.key, p]));
      for (let idx = 0; idx < enabledWallets.length; idx += 1) {
        const draft = enabledWallets[idx];
        const preset = presetByKey.get(draft.presetKey);
        if (!preset) continue;
        const openingMinor = getDraftBalanceMinor(draft);
        const cleanLast4 = draft.last4.trim();
        await repo.insertAccount({
          id: `acc_${preset.key}_${Crypto.randomUUID().slice(0, 8)}`,
          name: draft.name.trim() || preset.name,
          kind: preset.kind,
          provider: preset.provider,
          colorKey: preset.colorKey,
          monogram: preset.monogram,
          last4: /^\d{4}$/.test(cleanLast4) ? cleanLast4 : null,
          openingBalanceMinor: openingMinor,
          openingDate: today,
          includeInTotal: draft.includeInTotal,
          sortOrder: idx,
        });
      }

      await repo.setSetting('onboardingDone', true);
      await refreshSettings();
      bumpDataVersion();
      hapticSuccess();
      reset();
      router.replace('/(tabs)');
    } catch {
      setError(t('error.genericBody'));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.md }}>
        <OnboardingHeader
          step={7}
          title={t('onboarding.statementReadyTitle')}
          subtitle={t('onboarding.statementReadySub')}
        />

        {/* Architectural Opening Statement Card */}
        <Surface padded={false}>
          <View
            style={[
              styles.heroHeader,
              {
                backgroundColor: theme.colors.hero,
                padding: 16,
              },
            ]}
          >
            <AppText
              variant="overline"
              color="heroTextSecondary"
              style={styles.heroOverline}
            >
              {t('onboarding.statementHeader', { date: formatShortDate(today) })}
            </AppText>

            <View style={[styles.heroSplit, { marginTop: 10 }]}>
              <View style={styles.heroCol}>
                <AppText variant="caption" color="heroTextSecondary">
                  {t('onboarding.budgetTitle')}
                </AppText>
                {budgetMinor !== null ? (
                  <Money
                    amountMinor={budgetMinor}
                    currency={currency}
                    variant="title"
                    color="heroText"
                  />
                ) : (
                  <AppText variant="bodyStrong" color="heroText">
                    {t('overview.noBudgetSet')}
                  </AppText>
                )}
              </View>

              <View
                style={[
                  styles.heroCol,
                  {
                    borderLeftWidth: 1,
                    borderLeftColor: theme.colors.heroLine,
                    paddingLeft: 12,
                  },
                ]}
              >
                <AppText variant="caption" color="heroTextSecondary">
                  {t('onboarding.statementSafePerDay')}
                </AppText>
                {safeDailyMinor !== null ? (
                  <Money
                    amountMinor={safeDailyMinor}
                    currency={currency}
                    variant="title"
                    color="heroBar"
                  />
                ) : (
                  <AppText variant="bodyStrong" color="heroBar">
                    —
                  </AppText>
                )}
              </View>
            </View>
          </View>

          <SettingsRow
            label={t('onboarding.statementOwnerCurrency')}
            value={`${name.trim() || t('onboarding.doneSummaryNameDefault')} · ${currency}`}
          />
          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />
          <SettingsRow
            label={t('settings.languageLabel')}
            value={
              language === 'bn'
                ? t('settings.languageBn')
                : t('settings.languageEn')
            }
          />
          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />
          <SettingsRow
            label={t('onboarding.statementActiveCycle')}
            value={`${cyclePreview} (${remainingDaysCount}d)`}
          />
          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />
          <SettingsRow
            label={t('onboarding.statementIncludedWallets', {
              count: enabledWallets.length,
            })}
            value={
              enabledWallets.length > 0
                ? formatMoney(netIncludedMinor, currency)
                : t('wallets.emptyTitle')
            }
          />
          <View style={{ height: 1, backgroundColor: theme.colors.separator }} />
          <SettingsRow
            label={t('onboarding.reminderTitle')}
            value={
              reminderEnabled
                ? formatFriendlyTime(reminderTime || '21:00', false)
                : t('common.off')
            }
          />
        </Surface>

        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.navRow, { gap: theme.spacing.sm, paddingTop: theme.spacing.lg }]}>
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
          onPress={() => void handleFinish()}
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
  heroHeader: {},
  heroOverline: {
    textTransform: 'uppercase',
  },
  heroSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
