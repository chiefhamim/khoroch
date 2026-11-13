import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { WALLET_PRESETS } from '@/domain/accounts';
import { todayLocalDate } from '@/domain/dates';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import { formatCycleLabel, getPeriod } from '@/domain/period';
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
import { hapticSuccess } from '@/ui/haptics';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { SettingsGroup } from '@/ui/SettingsGroup';
import { SettingsRow } from '@/ui/SettingsRow';

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
  const cyclePreview = formatCycleLabel(period, monthStartDay, { includeYear: false });

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
        await repo.setBudget(period.start, '', budgetMinor);
      }

      const presetByKey = new Map(WALLET_PRESETS.map((p) => [p.key, p]));
      const enabledWallets = walletDrafts.filter((w) => w.enabled);
      for (let idx = 0; idx < enabledWallets.length; idx += 1) {
        const draft = enabledWallets[idx];
        const preset = presetByKey.get(draft.presetKey);
        if (!preset) continue;
        const cleanBal = draft.balanceInput.trim();
        let openingMinor = 0;
        if (cleanBal.length > 0) {
          const isExplicitNeg = cleanBal.startsWith('-');
          const rawAbs = isExplicitNeg ? cleanBal.slice(1).trim() : cleanBal;
          const parsed = parseMoneyInput(rawAbs);
          if (parsed.ok && parsed.minor !== null) {
            openingMinor =
              isExplicitNeg || draft.isDueNegative ? -parsed.minor : parsed.minor;
          }
        }
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
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader
          step={7}
          title={t('onboarding.doneTitle')}
          subtitle={t('onboarding.doneSubtitle')}
        />

        <SettingsGroup>
          <SettingsRow
            label={t('settings.nameLabel')}
            value={name.trim() || t('onboarding.doneSummaryNameDefault')}
          />
          <SettingsRow label={t('onboarding.currencyLabel')} value={currency} />
          <SettingsRow
            label={t('settings.monthStartLabel')}
            value={cyclePreview}
          />
          <SettingsRow
            label={t('onboarding.budgetTitle')}
            value={
              budgetMinor !== null
                ? formatMoney(budgetMinor, currency)
                : t('overview.noBudgetSet')
            }
          />
          <SettingsRow
            label={t('wallets.title')}
            value={
              walletDrafts.some((w) => w.enabled)
                ? String(walletDrafts.filter((w) => w.enabled).length)
                : t('wallets.emptyTitle')
            }
          />
        </SettingsGroup>

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
