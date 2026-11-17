import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  WALLET_COLOR_PALETTE,
  WALLET_PRESETS,
  type WalletPresetKey,
} from '@/domain/accounts';
import { todayLocalDate } from '@/domain/dates';
import { formatFeeRateBp, parseFeeRateInput } from '@/domain/fees';
import { CURRENCIES as CURRENCY_META, formatMoney, parseMoneyInput } from '@/domain/money';
import type { Account, AccountKind, CurrencyCode, LocalDate } from '@/domain/types';
import { t, useLocale, type TranslationKey } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { DateField } from './DateField';
import { Field } from './Field';
import { Keypad } from './Keypad';
import { PillSwitch } from './PillSwitch';
import { Sheet } from './Sheet';
import { WalletAvatar } from './WalletAvatar';
import { hapticLight, hapticSelection, hapticSuccess } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

export interface WalletEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  account: Account | null;
  currency?: CurrencyCode;
  nextSortOrder?: number;
  onSaved?: (savedId: string) => void;
}

const ACCOUNT_KIND_OPTIONS: readonly { kind: AccountKind; labelKey: TranslationKey }[] = [
  { kind: 'cash', labelKey: 'wallets.kindCash' },
  { kind: 'mobile_wallet', labelKey: 'wallets.kindMobile' },
  { kind: 'bank', labelKey: 'wallets.kindBank' },
  { kind: 'credit_card', labelKey: 'wallets.kindCard' },
  { kind: 'dps', labelKey: 'wallets.kindDps' },
  { kind: 'fdr', labelKey: 'wallets.kindFdr' },
  { kind: 'sanchaypatra', labelKey: 'wallets.kindSanchaypatra' },
  { kind: 'investment', labelKey: 'wallets.kindInvestment' },
  { kind: 'other', labelKey: 'wallets.kindOther' },
];

function formatOpeningBalanceText(openingBalanceMinor: number): string {
  const absMinor = Math.abs(openingBalanceMinor);
  if (absMinor === 0) return '0';
  const frac = absMinor % 100;
  const whole = (absMinor - frac) / 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

export function WalletEditorSheet(props: WalletEditorSheetProps) {
  useLocale();
  if (!props.visible) return null;
  return <WalletEditorDialog key={props.account?.id ?? 'new'} {...props} />;
}

function WalletEditorDialog({
  visible,
  onClose,
  account,
  currency: currencyProp,
  nextSortOrder = 0,
  onSaved,
}: WalletEditorSheetProps) {
  useLocale();
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const currency = currencyProp ?? settings.currency;
  const currencySymbol = CURRENCY_META[currency].symbol;
  const today = todayLocalDate();
  const defPreset = WALLET_PRESETS[0];

  const [selectedPreset, setSelectedPreset] = useState<WalletPresetKey>(defPreset.key);
  const [name, setName] = useState(() => (account ? account.name : defPreset.name));
  const [kind, setKind] = useState<AccountKind>(() => (account ? account.kind : defPreset.kind));
  const [provider, setProvider] = useState<string | null>(() =>
    account ? account.provider : defPreset.provider
  );
  const [colorKey, setColorKey] = useState<string>(() =>
    account ? account.colorKey : defPreset.colorKey
  );
  const [monogram, setMonogram] = useState<string | null>(() =>
    account ? account.monogram : defPreset.monogram
  );
  const [balanceText, setBalanceText] = useState(() =>
    account ? formatOpeningBalanceText(account.openingBalanceMinor) : ''
  );
  const [isNegativeBalance, setIsNegativeBalance] = useState(() =>
    account ? account.openingBalanceMinor < 0 : false
  );
  const [openingDate, setOpeningDate] = useState<LocalDate>(() =>
    account ? account.openingDate : today
  );
  const [last4, setLast4] = useState(() => (account?.last4 ?? ''));
  const [feeRateText, setFeeRateText] = useState(() =>
    account?.defaultFeeBp != null ? formatFeeRateBp(account.defaultFeeBp) : ''
  );
  const [includeInTotal, setIncludeInTotal] = useState(() =>
    account ? account.includeInTotal : true
  );
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyPreset = (key: WalletPresetKey) => {
    const preset = WALLET_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    hapticSelection();
    setSelectedPreset(key);
    setName(preset.name);
    setKind(preset.kind);
    setProvider(preset.provider);
    setColorKey(preset.colorKey);
    setMonogram(preset.monogram);
    setIncludeInTotal(preset.defaultIncludeInTotal);
    if (preset.kind !== 'credit_card') {
      setIsNegativeBalance(false);
    }
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg(t('wallets.errorNameRequired'));
      return;
    }

    const cleanLast4 = last4.trim();
    if (cleanLast4.length > 0 && !/^\d{4}$/.test(cleanLast4)) {
      setErrorMsg(t('wallets.errorLast4'));
      return;
    }

    const parsedFeeRate = parseFeeRateInput(feeRateText);
    if (!parsedFeeRate.ok) {
      setErrorMsg(t('wallets.errorDefaultFee'));
      return;
    }
    const defaultFeeBp = parsedFeeRate.bp;

    const trimmedBal = balanceText.trim();
    let openingMinor = 0;
    if (trimmedBal.length > 0) {
      const explicitNeg = trimmedBal.startsWith('-');
      const rawAbs = explicitNeg ? trimmedBal.slice(1).trim() : trimmedBal;
      const parsed = parseMoneyInput(rawAbs);
      if (!parsed.ok || parsed.minor === null) {
        setErrorMsg(t('wallets.errorBalance'));
        return;
      }
      openingMinor = explicitNeg || isNegativeBalance ? -parsed.minor : parsed.minor;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      if (account) {
        await repo.updateAccount(account.id, {
          name: trimmedName,
          kind,
          provider,
          colorKey,
          monogram,
          last4: cleanLast4.length === 4 ? cleanLast4 : null,
          defaultFeeBp,
          openingBalanceMinor: openingMinor,
          openingDate,
          includeInTotal,
        });
        bumpDataVersion();
        hapticSuccess();
        onSaved?.(account.id);
        onClose();
      } else {
        const newId = `acc_${selectedPreset}_${Crypto.randomUUID().slice(0, 8)}`;
        await repo.insertAccount({
          id: newId,
          name: trimmedName,
          kind,
          provider,
          colorKey,
          monogram,
          last4: cleanLast4.length === 4 ? cleanLast4 : null,
          defaultFeeBp,
          openingBalanceMinor: openingMinor,
          openingDate,
          includeInTotal,
          sortOrder: nextSortOrder,
        });
        bumpDataVersion();
        hapticSuccess();
        onSaved?.(newId);
        onClose();
      }
    } catch {
      setErrorMsg(t('error.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!account || saving) return;
    setSaving(true);
    try {
      if (account.archivedAt != null) {
        await repo.unarchiveAccount(account.id);
      } else {
        await repo.archiveAccount(account.id);
      }
      bumpDataVersion();
      hapticSuccess();
      onClose();
    } catch {
      setErrorMsg(t('error.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(account);
  const showLast4Field = kind === 'bank' || kind === 'credit_card';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditing ? t('wallets.editTitle') : t('wallets.newTitle')}
      testID="wallet-editor-sheet"
      footer={
        <Button
          testID="wallet-editor-save"
          title={t('common.save')}
          loading={saving}
          disabled={saving}
          onPress={() => void handleSave()}
        />
      }
    >
      {!isEditing ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('wallets.kindLabel')}
          </AppText>
          <View style={[styles.wrapRow, { gap: theme.spacing.xs }]}>
            {WALLET_PRESETS.map((preset) => {
              const selected = selectedPreset === preset.key;
              return (
                <PressableScale pressScale={0.98}
                  key={preset.key}
                  testID={`wallet-preset-${preset.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => applyPreset(preset.key)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: selected
                        ? theme.colors.accentSoft
                        : theme.colors.surfaceSunken,
                      borderColor: selected ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <WalletAvatar account={preset} size="xs" />
                  <AppText
                    variant="label"
                    color={selected ? 'accent' : 'text'}
                    numberOfLines={1}
                  >
                    {preset.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.previewRow, { gap: theme.spacing.md }]}>
        <WalletAvatar
          account={{ kind, provider, colorKey, monogram }}
          size="lg"
        />
        <View style={styles.flex1}>
          <Field
            testID="wallet-name-input"
            label={t('wallets.nameLabel')}
            value={name}
            onChangeText={(next) => {
              setName(next);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={t('wallets.namePlaceholder')}
            maxLength={32}
          />
        </View>
      </View>

      {isEditing ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('wallets.kindLabel')}
          </AppText>
          <View style={[styles.wrapRow, { gap: theme.spacing.xs }]}>
            {ACCOUNT_KIND_OPTIONS.map((opt) => {
              const active = kind === opt.kind;
              return (
                <PressableScale pressScale={0.98}
                  key={opt.kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticSelection();
                    setKind(opt.kind);
                  }}
                  style={[
                    styles.kindPill,
                    {
                      backgroundColor: active
                        ? theme.colors.accentSoft
                        : theme.colors.surfaceSunken,
                      borderColor: active ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <AppText variant="label" color={active ? 'accent' : 'text'} numberOfLines={1}>
                    {t(opt.labelKey)}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textSecondary">
          {t('wallets.colorLabel')}
        </AppText>
        <View style={[styles.wrapRow, { gap: theme.spacing.sm }]}>
          {WALLET_COLOR_PALETTE.map((hex) => {
            const active = colorKey.toLowerCase() === hex.toLowerCase();
            return (
              <PressableScale pressScale={0.98}
                key={hex}
                testID={`wallet-color-${hex.slice(1)}`}
                accessibilityRole="button"
                accessibilityLabel={hex}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  setColorKey(hex);
                }}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: hex,
                    borderWidth: active ? 2.5 : 0,
                    borderColor: theme.colors.text,
                  },
                ]}
              >
                {active ? <AppIcon name="check" size={14} color="#FFFFFF" /> : null}
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={[styles.twoCol, { gap: theme.spacing.sm }]}>
        <View style={styles.flex1}>
          <Field
            testID="wallet-opening-balance-input"
            label={`${t('wallets.openingBalanceLabel')} (${currencySymbol})`}
            value={balanceText}
            onChangeText={(next) => {
              setBalanceText(next);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="0"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={[styles.flex1, { gap: theme.spacing.xs }]}>
          <AppText variant="label" color="textSecondary" numberOfLines={1}>
            {t('wallets.openingDateLabel')}
          </AppText>
          <DateField
            testID="wallet-opening-date"
            value={openingDate}
            today={today}
            onChange={(d) => setOpeningDate(d)}
          />
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <PressableScale pressScale={0.98}
          testID="wallet-negative-toggle"
          accessibilityRole="button"
          accessibilityState={{ selected: isNegativeBalance }}
          onPress={() => {
            hapticSelection();
            setIsNegativeBalance((prev) => !prev);
          }}
          style={[
            styles.signPill,
            {
              backgroundColor: isNegativeBalance
                ? theme.colors.dangerSoft
                : theme.colors.surfaceSunken,
              borderColor: isNegativeBalance ? theme.colors.danger : 'transparent',
              borderRadius: theme.radius.pill,
            },
          ]}
        >
          <AppText
            variant="caption"
            color={isNegativeBalance ? 'danger' : 'textSecondary'}
            numberOfLines={1}
          >
            {kind === 'credit_card'
              ? isNegativeBalance
                ? t('wallets.signAmountDue')
                : t('wallets.signPositiveCredit')
              : isNegativeBalance
                ? t('wallets.signNegativeBalance')
                : t('wallets.signTapForNegative')}
          </AppText>
        </PressableScale>
        <Keypad
          testID="wallet-opening-keypad"
          value={balanceText}
          onChange={(next) => {
            setBalanceText(next);
            if (errorMsg) setErrorMsg(null);
          }}
          keyHeight={38}
        />
      </View>

      {showLast4Field ? (
        <Field
          testID="wallet-last4-input"
          label={t('wallets.cardLast4Label')}
          value={last4}
          onChangeText={(next) => {
            setLast4(next.replace(/\D/g, '').slice(0, 4));
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder={t('wallets.cardLast4Placeholder')}
          keyboardType="number-pad"
          maxLength={4}
        />
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <Field
          testID="wallet-default-fee-input"
          label={t('wallets.defaultFeeLabel')}
          value={feeRateText}
          onChangeText={(next) => {
            setFeeRateText(next);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder={t('wallets.defaultFeePlaceholder')}
          keyboardType="decimal-pad"
          maxLength={6}
        />
        <AppText variant="caption" color="textSecondary">
          {t('wallets.defaultFeeHint')}
        </AppText>
      </View>

      <View
        style={[
          styles.switchRow,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderRadius: theme.radius.input,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <View style={[styles.flex1, { gap: 2 }]}>
          <AppText variant="bodyStrong">{t('wallets.includeInTotalLabel')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('wallets.includeInTotalHint')}
          </AppText>
        </View>
        <PillSwitch
          testID="wallet-include-in-total-switch"
          value={includeInTotal}
          onValueChange={(next) => {
            hapticLight();
            setIncludeInTotal(next);
          }}
        />
      </View>

      {isEditing && account ? (
        account.archivedAt != null ? (
          <Button
            testID="wallet-restore-button"
            title={t('wallets.restoreButton')}
            leftIcon="archive-restore"
            variant="secondary"
            disabled={saving}
            onPress={() => void handleArchiveToggle()}
          />
        ) : confirmArchive ? (
          <View
            style={[
              styles.confirmBox,
              {
                backgroundColor: theme.colors.dangerSoft,
                borderRadius: theme.radius.card,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <AppText variant="bodyStrong" color="danger">
              {t('wallets.archiveConfirmTitle', { name: account.name })}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('wallets.archiveConfirmBody')}
            </AppText>
            <View style={[styles.confirmActions, { gap: theme.spacing.sm }]}>
              <Button
                testID="wallet-cancel-archive-button"
                title={t('common.cancel')}
                variant="secondary"
                size="sm"
                onPress={() => setConfirmArchive(false)}
                style={styles.confirmBtn}
              />
              <Button
                testID="wallet-confirm-archive-button"
                title={t('wallets.archiveButton')}
                variant="danger"
                size="sm"
                loading={saving}
                onPress={() => void handleArchiveToggle()}
                style={styles.confirmBtn}
              />
            </View>
          </View>
        ) : (
          <Button
            testID="wallet-archive-button"
            title={t('wallets.archiveButton')}
            leftIcon="archive"
            variant="dangerSoft"
            disabled={saving}
            onPress={() => setConfirmArchive(true)}
          />
        )
      ) : null}

      {errorMsg ? (
        <AppText testID="wallet-editor-error" variant="caption" color="danger">
          {errorMsg}
        </AppText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    minHeight: 38,
  },
  kindPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  confirmActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  confirmBtn: {
    flexGrow: 1,
  },
  signPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmBox: {},
  flex1: {
    flex: 1,
    minWidth: 0,
  },
});

export function formatOpeningSummary(
  openingMinor: number,
  openingDateLabel: string,
  currency: CurrencyCode
): string {
  return `${openingMinor < 0 ? '-' : ''}${formatMoney(Math.abs(openingMinor), currency)} · ${openingDateLabel}`;
}
