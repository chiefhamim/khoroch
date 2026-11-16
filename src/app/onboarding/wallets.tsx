import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  formatAccountBalance,
  WALLET_PRESETS,
  type WalletPresetKey,
} from '@/domain/accounts';
import { CURRENCIES as CURRENCY_META, parseMoneyInput } from '@/domain/money';
import { t } from '@/i18n';
import { useOnboardingDraft, type OnboardingWalletDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { hapticSelection } from '@/ui/haptics';
import { Money } from '@/ui/Money';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { PillSwitch } from '@/ui/PillSwitch';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { WalletAvatar } from '@/ui/WalletAvatar';

const PRESET_MAP = new Map(WALLET_PRESETS.map((p) => [p.key, p]));

function getDraftBalanceMinor(draft: OnboardingWalletDraft): number {
  const cleanBal = draft.balanceInput.trim();
  if (!cleanBal) return 0;
  const isExplicitNeg = cleanBal.startsWith('-');
  const rawAbs = isExplicitNeg ? cleanBal.slice(1).trim() : cleanBal;
  const parsed = parseMoneyInput(rawAbs);
  if (!parsed.ok || parsed.minor === null) return 0;
  return isExplicitNeg || draft.isDueNegative ? -parsed.minor : parsed.minor;
}

export default function OnboardingWalletsScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const {
    currency,
    walletDrafts,
    toggleWalletPreset,
    applyWalletPresetBundle,
    updateWalletDraft,
    skipAllWallets,
  } = useOnboardingDraft();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const currencySymbol = CURRENCY_META[currency].symbol;

  const handleValidateAndContinue = () => {
    setErrorMsg(null);
    for (const draft of walletDrafts) {
      if (!draft.enabled) continue;
      if (!draft.name.trim()) {
        setErrorMsg(t('wallets.errorNameRequired'));
        return;
      }
      const balTrimmed = draft.balanceInput.trim();
      if (balTrimmed.length > 0) {
        const rawAbs = balTrimmed.startsWith('-') ? balTrimmed.slice(1).trim() : balTrimmed;
        const parsed = parseMoneyInput(rawAbs);
        if (!parsed.ok || parsed.minor === null) {
          setErrorMsg(t('wallets.errorBalance'));
          return;
        }
      }
      const cleanLast4 = draft.last4.trim();
      if (cleanLast4.length > 0 && !/^\d{4}$/.test(cleanLast4)) {
        setErrorMsg(t('wallets.errorLast4'));
        return;
      }
    }
    router.push('/onboarding/done');
  };

  const handleSkip = () => {
    setErrorMsg(null);
    skipAllWallets();
    router.push('/onboarding/done');
  };

  const handleToggle = (key: WalletPresetKey) => {
    hapticSelection();
    setErrorMsg(null);
    toggleWalletPreset(key);
  };

  const enabledWallets = walletDrafts.filter((w) => w.enabled);
  const enabledCount = enabledWallets.length;
  const netIncludedMinor = enabledWallets
    .filter((w) => w.includeInTotal)
    .reduce((sum, w) => sum + getDraftBalanceMinor(w), 0);

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
          step={6}
          title={t('onboarding.accountRegisterTitle')}
          subtitle={t('onboarding.accountRegisterSub')}
        />

        {/* Quick-select Wallet Bundles */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" color="textSecondary">
            {t('onboarding.quickPresetsTitle')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            <Button
              testID="onboarding-preset-everyday"
              title={t('onboarding.presetEveryday')}
              variant="secondary"
              size="sm"
              onPress={() => {
                hapticSelection();
                setErrorMsg(null);
                applyWalletPresetBundle(['cash', 'bkash', 'bank']);
              }}
            />
            <Button
              testID="onboarding-preset-complete"
              title={t('onboarding.presetComplete')}
              variant="secondary"
              size="sm"
              onPress={() => {
                hapticSelection();
                setErrorMsg(null);
                applyWalletPresetBundle(['cash', 'bkash', 'nagad', 'bank', 'dps']);
              }}
            />
          </View>
        </View>

        {/* Single-Screen Account Register Table */}
        <Surface padded={false}>
          {walletDrafts.map((draft, idx) => {
            const preset = PRESET_MAP.get(draft.presetKey);
            if (!preset) return null;
            const balMinor = getDraftBalanceMinor(draft);
            const displayLabel = draft.last4.trim()
              ? `${draft.name || preset.name} · ${draft.last4.trim()}`
              : draft.name || preset.name;

            return (
              <React.Fragment key={draft.presetKey}>
                {idx > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.separator,
                    }}
                  />
                ) : null}
                <PressableScale
                  pressScale={0.99}
                  testID={`onboarding-wallet-preset-${draft.presetKey}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.enabled }}
                  onPress={() => handleToggle(draft.presetKey)}
                  style={({ pressed }) => [
                    styles.registerRow,
                    {
                      opacity: pressed && !reducedMotion ? 0.8 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: draft.enabled
                          ? theme.colors.accent
                          : 'transparent',
                        borderColor: draft.enabled
                          ? theme.colors.accent
                          : theme.colors.cardBorder,
                      },
                    ]}
                  >
                    {draft.enabled ? (
                      <AppIcon name="check" size={12} color={theme.colors.onAccent} />
                    ) : null}
                  </View>
                  <WalletAvatar account={preset} size="sm" />
                  <View style={styles.flex1}>
                    <AppText
                      variant="bodyStrong"
                      color={draft.enabled ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {displayLabel}
                    </AppText>
                  </View>
                  {draft.enabled ? (
                    <AppText
                      variant="bodyStrong"
                      tabularNums
                      color={balMinor < 0 ? 'danger' : 'accent'}
                    >
                      {`${formatAccountBalance(preset.kind, balMinor, currency)} ✎`}
                    </AppText>
                  ) : (
                    <AppText variant="caption" color="textTertiary">
                      {t('onboarding.tapToEnable')}
                    </AppText>
                  )}
                </PressableScale>
              </React.Fragment>
            );
          })}
        </Surface>

        {/* Bottom Net Included Summary Row */}
        <View style={styles.netSummaryRow}>
          <AppText variant="label" color="textSecondary">
            {t('onboarding.netIncludedLabel', { count: enabledCount })}
          </AppText>
          <Money
            amountMinor={netIncludedMinor}
            currency={currency}
            variant="headline"
            color={netIncludedMinor < 0 ? 'danger' : 'text'}
          />
        </View>

        {enabledCount > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            {enabledWallets.map((draft) => {
              const preset = PRESET_MAP.get(draft.presetKey);
              if (!preset) return null;
              return (
                <Surface
                  key={draft.presetKey}
                  testID={`onboarding-wallet-card-${draft.presetKey}`}
                  style={{ gap: theme.spacing.sm }}
                >
                  <View style={styles.cardHeader}>
                    <WalletAvatar account={preset} size="sm" />
                    <AppText variant="bodyStrong" style={styles.flex1}>
                      {preset.name}
                    </AppText>
                    <PressableScale
                      pressScale={0.98}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.close')}
                      hitSlop={8}
                      onPress={() => handleToggle(draft.presetKey)}
                    >
                      <AppIcon name="x" size={18} color={theme.colors.textTertiary} />
                    </PressableScale>
                  </View>

                  <View style={[styles.twoCol, { gap: theme.spacing.sm }]}>
                    <Field
                      testID={`onboarding-wallet-name-${draft.presetKey}`}
                      label={t('wallets.nameLabel')}
                      value={draft.name}
                      onChangeText={(name) => updateWalletDraft(draft.presetKey, { name })}
                      placeholder={preset.name}
                      containerStyle={styles.flex1}
                    />
                    <Field
                      testID={`onboarding-wallet-bal-${draft.presetKey}`}
                      label={`${t('onboarding.walletsBalanceLabel')} (${currencySymbol})`}
                      value={draft.balanceInput}
                      onChangeText={(balanceInput) =>
                        updateWalletDraft(draft.presetKey, { balanceInput })
                      }
                      placeholder="0"
                      keyboardType="decimal-pad"
                      containerStyle={styles.flex1}
                    />
                  </View>

                  {preset.supportsLast4 ? (
                    <Field
                      testID={`onboarding-wallet-last4-${draft.presetKey}`}
                      label={t('wallets.cardLast4Label')}
                      value={draft.last4}
                      onChangeText={(next) =>
                        updateWalletDraft(draft.presetKey, {
                          last4: next.replace(/\D/g, '').slice(0, 4),
                        })
                      }
                      placeholder={t('wallets.cardLast4Placeholder')}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  ) : null}

                  {preset.kind === 'credit_card' ? (
                    <View style={styles.switchRow}>
                      <AppText variant="label" color="textSecondary" style={styles.flex1}>
                        {t('onboarding.walletsAmountDueToggle')}
                      </AppText>
                      <PillSwitch
                        testID={`onboarding-wallet-due-${draft.presetKey}`}
                        value={draft.isDueNegative}
                        onValueChange={(isDueNegative) =>
                          updateWalletDraft(draft.presetKey, { isDueNegative })
                        }
                      />
                    </View>
                  ) : null}
                </Surface>
              );
            })}
          </View>
        ) : null}

        {errorMsg ? (
          <AppText variant="caption" color="danger">
            {errorMsg}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.md }}>
        <View style={[styles.navRow, { gap: theme.spacing.sm }]}>
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={() => router.back()}
            style={styles.navBtn}
          />
          <Button
            testID="onboarding-wallets-continue"
            tint="#0F766E"
            title={t('common.continue')}
            onPress={handleValidateAndContinue}
            style={styles.navBtnPrimary}
          />
        </View>
        <Button
          testID="onboarding-wallets-skip"
          title={t('common.skip')}
          variant="ghost"
          size="sm"
          onPress={handleSkip}
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
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    gap: 11,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  twoCol: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
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
