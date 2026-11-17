import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { formatMoney } from '@/domain/money';
import type { Category, CurrencyCode, Transaction } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { hapticSelection } from './haptics';
import { Money } from './Money';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';

/** Spoken and testable amount text, with Bangla digits when the app is in Bangla. */
function useAmountText(currency: CurrencyCode): (minor: number) => string {
  const locale = useLocale();
  return (minor) => {
    const text = formatMoney(minor, currency);
    return locale === 'bn' ? toBnDigits(text) : text;
  };
}

export interface RepeatChipsProps {
  entries: readonly Transaction[];
  categoriesById: ReadonlyMap<string, Category>;
  currency: CurrencyCode;
  onSelect: (entry: Transaction) => void;
}

/** One scrollable row of "amount category" chips; tapping one only fills the form. */
export function RepeatChips({ entries, categoriesById, currency, onSelect }: RepeatChipsProps) {
  const { theme } = useTheme();
  const amountText = useAmountText(currency);
  if (entries.length === 0) return null;
  return (
    <View testID="repeat-chips" style={{ gap: theme.spacing.xs }}>
      <AppText variant="overline" color="textTertiary">
        {t('fast.repeatLabel').toUpperCase()}
      </AppText>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.geometry.screenMargin }}
        contentContainerStyle={{
          paddingHorizontal: theme.geometry.screenMargin,
          gap: theme.spacing.sm,
        }}
      >
        {entries.map((entry) => {
          const name = categoriesById.get(entry.categoryId ?? '')?.name ?? '';
          return (
            <Chip
              key={entry.id}
              testID={`repeat-chip-${entry.id}`}
              variant="sunken"
              label={name}
              accessibilityLabel={t('fast.repeatChipA11y', {
                amount: amountText(entry.amountMinor),
                category: name,
              })}
              left={
                <Money
                  amountMinor={entry.amountMinor}
                  currency={currency}
                  variant="label"
                  color={entry.type === 'income' ? 'income' : 'text'}
                />
              }
              onPress={() => {
                hapticSelection();
                onSelect(entry);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

export interface PresetAmountsProps {
  amounts: readonly number[];
  /** Amount currently typed, or null when empty or zero. */
  typedAmountMinor: number | null;
  canPin: boolean;
  currency: CurrencyCode;
  onSelect: (amountMinor: number) => void;
  onPin: () => void;
  onRemove: (amountMinor: number) => void;
}

/** Pinned amounts as buttons plus a labelled "Pin amount" action. Renders nothing when idle. */
export function PresetAmounts({
  amounts,
  typedAmountMinor,
  canPin,
  currency,
  onSelect,
  onPin,
  onRemove,
}: PresetAmountsProps) {
  const { theme } = useTheme();
  const amountText = useAmountText(currency);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const showPin = canPin && typedAmountMinor !== null;
  if (amounts.length === 0 && !showPin) return null;

  const pinButton = showPin ? (
    <PressableScale
      testID="preset-pin"
      accessibilityRole="button"
      accessibilityLabel={t('fast.pinAmountA11y', { amount: amountText(typedAmountMinor ?? 0) })}
      onPress={() => {
        hapticSelection();
        onPin();
      }}
      style={[styles.pin, { gap: theme.spacing.xs, paddingHorizontal: theme.spacing.md }]}
    >
      <AppIcon name="plus" size={15} color={theme.colors.accent} />
      <AppText
        variant="label"
        color="accent"
        numberOfLines={1}
        style={{
          minWidth: estimateSingleLineMinWidth(t('fast.pinAmount'), theme.typography.label.fontSize),
        }}
      >
        {t('fast.pinAmount')}
      </AppText>
    </PressableScale>
  ) : null;

  return (
    <View testID="preset-amounts" style={{ gap: theme.spacing.xs }}>
      {amounts.length > 0 ? (
        <>
          <AppText variant="overline" color="textTertiary">
            {t('fast.presetsLabel').toUpperCase()}
          </AppText>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -theme.geometry.screenMargin }}
            contentContainerStyle={{
              paddingHorizontal: theme.geometry.screenMargin,
              gap: theme.spacing.sm,
              alignItems: 'center',
            }}
          >
            {amounts.map((amount) => (
              <PressableScale
                key={amount}
                testID={`preset-${amount}`}
                accessibilityRole="button"
                accessibilityLabel={t('fast.presetA11y', { amount: amountText(amount) })}
                accessibilityHint={t('fast.presetHint')}
                onPress={() => {
                  hapticSelection();
                  onSelect(amount);
                }}
                onLongPress={() => {
                  hapticSelection();
                  setPendingRemove(amount);
                }}
                style={[
                  styles.preset,
                  {
                    borderRadius: theme.radius.chip,
                    backgroundColor: theme.colors.surfaceSunken,
                    paddingHorizontal: theme.spacing.lg,
                  },
                ]}
              >
                <Money amountMinor={amount} currency={currency} variant="label" />
              </PressableScale>
            ))}
            {pinButton}
          </ScrollView>
          <AppText variant="caption" color="textSecondary">
            {t('fast.presetHint')}
          </AppText>
        </>
      ) : (
        pinButton
      )}

      <Sheet
        visible={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={t('fast.removePresetTitle')}
        testID="preset-remove-sheet"
        footer={
          <View style={[styles.footer, { gap: theme.spacing.sm }]}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              onPress={() => setPendingRemove(null)}
              style={styles.flex}
            />
            <Button
              title={t('fast.removePreset')}
              variant="danger"
              onPress={() => {
                if (pendingRemove !== null) onRemove(pendingRemove);
                setPendingRemove(null);
              }}
              style={styles.flex}
              testID="preset-remove-confirm"
            />
          </View>
        }
      >
        <AppText variant="body">
          {t('fast.removePresetBody', { amount: amountText(pendingRemove ?? 0) })}
        </AppText>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  preset: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pin: { minHeight: 48, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  footer: { flexDirection: 'row' },
  flex: { flex: 1 },
});
