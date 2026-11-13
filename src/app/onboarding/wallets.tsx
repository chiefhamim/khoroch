import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WALLET_PRESETS, type WalletPresetKey } from '@/domain/accounts';
import { CURRENCIES as CURRENCY_META, parseMoneyInput } from '@/domain/money';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingStore';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { OnboardingHeader } from '@/ui/OnboardingHeader';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { WalletAvatar } from '@/ui/WalletAvatar';
import { hapticSelection } from '@/ui/haptics';

const PRESET_MAP = new Map(WALLET_PRESETS.map((p) => [p.key, p]));

export default function OnboardingWalletsScreen() {
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const {
    currency,
    walletDrafts,
    toggleWalletPreset,
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

  const enabledCount = walletDrafts.filter((w) => w.enabled).length;

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <OnboardingHeader
          step={6}
          title={t('onboarding.walletsTitle')}
          subtitle={t('onboarding.walletsSubtitle')}
        />

        <Banner tone="neutral" icon="wallet" message={t('onboarding.walletsTip')} />

        <View style={[styles.chipGrid, { gap: theme.spacing.sm }]}>
          {walletDrafts.map((draft) => {
            const preset = PRESET_MAP.get(draft.presetKey);
            if (!preset) return null;
            return (
              <Pressable
                key={draft.presetKey}
                testID={`onboarding-wallet-preset-${draft.presetKey}`}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.enabled }}
                onPress={() => handleToggle(draft.presetKey)}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    minHeight: theme.touch.min,
                    backgroundColor: draft.enabled
                      ? theme.colors.accentSoft
                      : theme.colors.surface,
                    borderColor: draft.enabled
                      ? theme.colors.accent
                      : theme.colors.cardBorder,
                    borderRadius: theme.radius.pill,
                    paddingLeft: 8,
                    paddingRight: theme.spacing.md,
                    gap: theme.spacing.sm,
                    opacity: pressed && !reducedMotion ? 0.78 : 1,
                  },
                ]}
              >
                <WalletAvatar account={preset} size="xs" />
                <AppText
                  variant="label"
                  color={draft.enabled ? 'accent' : 'text'}
                  numberOfLines={1}
                >
                  {preset.name}
                </AppText>
                {draft.enabled ? (
                  <AppIcon name="check" size={14} color={theme.colors.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {enabledCount > 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            {walletDrafts
              .filter((d) => d.enabled)
              .map((draft) => {
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.close')}
                        hitSlop={8}
                        onPress={() => handleToggle(draft.presetKey)}
                      >
                        <AppIcon name="x" size={18} color={theme.colors.textTertiary} />
                      </Pressable>
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
                        <Switch
                          testID={`onboarding-wallet-due-${draft.presetKey}`}
                          value={draft.isDueNegative}
                          onValueChange={(isDueNegative) =>
                            updateWalletDraft(draft.presetKey, { isDueNegative })
                          }
                          trackColor={{
                            false: theme.colors.surfaceSunken,
                            true: theme.colors.accent,
                          }}
                          thumbColor="#ffffff"
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

      <View style={{ gap: theme.spacing.xs, paddingTop: theme.spacing.lg }}>
        <View style={[styles.navRow, { gap: theme.spacing.sm }]}>
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={() => router.back()}
            style={styles.navBtn}
          />
          <Button
            testID="onboarding-wallets-continue"
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
