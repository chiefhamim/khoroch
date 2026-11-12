import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buildSampleTransactions } from '@/data/sampleData';
import { todayLocalDate } from '@/domain/dates';
import { getPeriod } from '@/domain/period';
import { CURRENCIES, type CurrencyCode, type ThemePreference } from '@/domain/types';
import { t } from '@/i18n';
import { bumpDataVersion } from '@/state/dataVersion';
import { useSettings } from '@/state/useSettings';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BDT: 'BDT (৳)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { repo, backend, settings, hasTransactions, updateSetting, refreshSettings } =
    useSettings();

  const [nameDraft, setNameDraft] = useState(settings.name);
  const [savedFlag, setSavedFlag] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed === settings.name) return;
    await updateSetting('name', trimmed);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 1500);
  };

  const handleDeleteAllConfirm = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    if (deleteStep === 2 && !busy) {
      setBusy(true);
      try {
        await repo.deleteAllData();
        setDeleteStep(0);
        await refreshSettings();
        bumpDataVersion();
      } finally {
        setBusy(false);
      }
    }
  };

  const handleLoadSample = async () => {
    if (busy) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const handleClearSample = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await repo.clearSampleTransactions();
      await updateSetting('sampleDataLoaded', false);
      bumpDataVersion();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll bottomSpacer>
      <AppText variant="title">{t('settings.title')}</AppText>

      <SectionHeader title={t('settings.sectionPersonal')} />
      <Card style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <View style={styles.labelRow}>
            <AppText variant="label" color="textMuted">
              {t('settings.nameLabel')}
            </AppText>
            {savedFlag ? (
              <AppText variant="caption" color="primary">
                {t('settings.savedNotice')}
              </AppText>
            ) : null}
          </View>
          <View style={[styles.nameRow, { gap: theme.spacing.sm }]}>
            <TextInput
              testID="settings-name-input"
              value={nameDraft}
              onChangeText={setNameDraft}
              onEndEditing={() => void handleSaveName()}
              placeholder={t('settings.namePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={50}
              style={[
                styles.input,
                {
                  flex: 1,
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
            {nameDraft.trim() !== settings.name ? (
              <Button
                title={t('common.save')}
                variant="secondary"
                onPress={() => void handleSaveName()}
                style={{ minWidth: theme.touch.min + theme.spacing.xxl }}
              />
            ) : null}
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            {t('settings.currencyLabel')}
          </AppText>
          <View
            style={[
              styles.rowWrap,
              { gap: theme.spacing.sm, opacity: hasTransactions ? 0.6 : 1 },
            ]}
          >
            {CURRENCIES.map((code) => (
              <Chip
                key={code}
                testID={`settings-currency-${code}`}
                label={CURRENCY_LABELS[code]}
                selected={settings.currency === code}
                onPress={() => {
                  if (!hasTransactions) {
                    void updateSetting('currency', code);
                  }
                }}
              />
            ))}
          </View>
          {hasTransactions ? (
            <AppText variant="caption" color="textMuted">
              {t('settings.currencyLockedNote')}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            {t('settings.monthStartLabel')}
          </AppText>
          <View style={[styles.stepperRow, { gap: theme.spacing.md }]}>
            <Button
              title="-"
              variant="secondary"
              accessibilityLabel="Decrease month start day"
              disabled={settings.monthStartDay <= 1}
              onPress={() =>
                void updateSetting('monthStartDay', Math.max(1, settings.monthStartDay - 1))
              }
              style={{ minWidth: theme.touch.min + theme.spacing.lg }}
            />
            <View style={styles.dayValue}>
              <AppText variant="title" tabularNums>
                {settings.monthStartDay}
              </AppText>
            </View>
            <Button
              title="+"
              variant="secondary"
              accessibilityLabel="Increase month start day"
              disabled={settings.monthStartDay >= 28}
              onPress={() =>
                void updateSetting('monthStartDay', Math.min(28, settings.monthStartDay + 1))
              }
              style={{ minWidth: theme.touch.min + theme.spacing.lg }}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            {t('settings.themeLabel')}
          </AppText>
          <SegmentedControl<ThemePreference>
            value={settings.theme}
            onChange={(val) => void updateSetting('theme', val)}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
          />
        </View>
      </Card>

      <SectionHeader title={t('settings.sectionData')} />
      <Card style={{ gap: theme.spacing.md }}>
        <ListRow
          testID="settings-categories-row"
          title={t('settings.categoriesRow')}
          subtitle={t('settings.categoriesSubtitle')}
          left={<Ionicons name="pricetags-outline" size={20} color={theme.colors.primary} />}
          showChevron
          onPress={() => router.push('/settings/categories')}
        />
        <View style={{ height: 1, backgroundColor: theme.colors.border }} />
        <Button
          testID="settings-delete-all-button"
          title={t('settings.deleteAllButton')}
          variant="danger"
          onPress={() => setDeleteStep(1)}
        />
      </Card>

      {__DEV__ ? (
        <>
          <SectionHeader title={t('settings.sectionDev')} />
          <Card style={{ gap: theme.spacing.sm }}>
            <Button
              testID="settings-load-sample"
              title={t('settings.sampleLoad')}
              variant="secondary"
              loading={busy}
              disabled={busy}
              onPress={() => void handleLoadSample()}
            />
            <Button
              testID="settings-clear-sample"
              title={t('settings.sampleClear')}
              variant="ghost"
              disabled={busy}
              onPress={() => void handleClearSample()}
            />
            {settings.sampleDataLoaded ? (
              <AppText variant="caption" color="primary">
                {t('settings.sampleLoadedNote')}
              </AppText>
            ) : (
              <AppText variant="caption" color="textMuted">
                {t('settings.sampleDevOnly')}
              </AppText>
            )}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('settings.sectionAbout')} />
      <Card style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading">{t('settings.aboutName')}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('settings.aboutDesc', { backend })}
        </AppText>
      </Card>

      <ConfirmModal
        visible={deleteStep !== 0}
        title={
          deleteStep === 2
            ? t('settings.deleteAllStep2Title')
            : t('settings.deleteAllStep1Title')
        }
        body={
          deleteStep === 2
            ? t('settings.deleteAllStep2Body')
            : t('settings.deleteAllStep1Body')
        }
        confirmLabel={
          deleteStep === 2
            ? t('settings.deleteAllStep2Confirm')
            : t('settings.deleteAllStep1Confirm')
        }
        cancelLabel={t('common.cancel')}
        destructive
        loading={busy}
        onConfirm={() => void handleDeleteAllConfirm()}
        onCancel={() => {
          if (!busy) setDeleteStep(0);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayValue: {
    flex: 1,
    alignItems: 'center',
  },
});
