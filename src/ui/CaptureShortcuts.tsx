import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { PinBlockReason } from '@/domain/captureShortcuts';
import { formatMoney } from '@/domain/money';
import type { Category, CurrencyCode, Transaction } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { hapticSelection } from './haptics';
import { Money } from './Money';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';

/**
 * Spoken amount text that matches the on-screen Money: the same poisha setting and Bangla digits
 * when the app is in Bangla.
 */
function useAmountText(currency: CurrencyCode): (minor: number) => string {
  const locale = useLocale();
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  return (minor) => {
    const text = formatMoney(minor, currency, { showPoisha });
    return locale === 'bn' ? toBnDigits(text) : text;
  };
}

const PIN_REASON_KEY = {
  none: 'fast.pinWhyNone',
  duplicate: 'fast.pinWhyDuplicate',
  full: 'fast.pinWhyFull',
} as const;

export interface CaptureShortcutsProps {
  /** Recent distinct entries to repeat (already filtered). */
  entries: readonly Transaction[];
  categoriesById: ReadonlyMap<string, Category>;
  currency: CurrencyCode;
  /** Pinned amounts for the current transaction type. */
  pinnedAmounts: readonly number[];
  /** Amount currently typed, or null when empty or zero. */
  typedAmountMinor: number | null;
  /** Why the typed amount cannot be pinned, or null when it can. */
  pinBlocked: PinBlockReason | null;
  onSelectRepeat: (entry: Transaction) => void;
  onSelectAmount: (amountMinor: number) => void;
  onPin: () => void;
  onRemove: (amountMinor: number) => void;
  /** When given, a "Set daily wage" chip leads the row (Received side, no wage set yet). */
  onSetDailyWage?: () => void;
}

/**
 * One horizontally scrolling row of constant height above the keypad: repeat chips, pinned amounts,
 * then a "Quick amounts" chip that opens the sheet for pinning and removing. Nothing in it appears,
 * disappears or resizes while the user types, so the keypad never moves. Amounts here stay readable
 * even when the app-wide hide-amounts setting is on (the typed amount is visible on this screen too).
 */
export function CaptureShortcuts({
  entries,
  categoriesById,
  currency,
  pinnedAmounts,
  typedAmountMinor,
  pinBlocked,
  onSelectRepeat,
  onSelectAmount,
  onPin,
  onRemove,
  onSetDailyWage,
}: CaptureShortcutsProps) {
  const { theme } = useTheme();
  const amountText = useAmountText(currency);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View testID="capture-shortcuts">
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={{ height: theme.touch.min, flexGrow: 0, marginHorizontal: -theme.geometry.screenMargin }}
        contentContainerStyle={{
          paddingHorizontal: theme.geometry.screenMargin,
          gap: theme.spacing.sm,
          alignItems: 'center',
        }}
      >
        {onSetDailyWage ? (
          <Chip
            testID="set-daily-wage-chip"
            variant="sunken"
            icon="hand-coins"
            label={t('dailyWage.setChip')}
            onPress={() => {
              hapticSelection();
              onSetDailyWage();
            }}
          />
        ) : null}
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
                  hidden={false}
                />
              }
              onPress={() => {
                hapticSelection();
                onSelectRepeat(entry);
              }}
            />
          );
        })}
        {pinnedAmounts.map((amount) => (
          <PressableScale
            key={amount}
            testID={`preset-${amount}`}
            accessibilityRole="button"
            accessibilityLabel={t('fast.presetA11y', { amount: amountText(amount) })}
            onPress={() => {
              hapticSelection();
              onSelectAmount(amount);
            }}
            style={[
              styles.preset,
              {
                minHeight: theme.touch.min,
                borderRadius: theme.radius.chip,
                backgroundColor: theme.colors.surfaceSunken,
                paddingHorizontal: theme.spacing.lg,
              },
            ]}
          >
            <Money amountMinor={amount} currency={currency} variant="label" hidden={false} />
          </PressableScale>
        ))}
        <Chip
          testID="preset-open"
          variant="sunken"
          icon="plus"
          label={t('fast.presetsLabel')}
          onPress={() => {
            hapticSelection();
            setSheetOpen(true);
          }}
        />
      </ScrollView>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('fast.presetsLabel')}
        testID="preset-sheet"
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            {pinBlocked !== null ? (
              <AppText variant="caption" color="textSecondary" testID="preset-pin-reason">
                {t(PIN_REASON_KEY[pinBlocked])}
              </AppText>
            ) : null}
            <Button
              testID="preset-pin"
              title={
                typedAmountMinor !== null
                  ? t('fast.pinAmountButton', { amount: amountText(typedAmountMinor) })
                  : t('fast.pinAmount')
              }
              accessibilityLabel={
                typedAmountMinor !== null
                  ? t('fast.pinAmountA11y', { amount: amountText(typedAmountMinor) })
                  : t('fast.pinAmount')
              }
              disabled={pinBlocked !== null}
              onPress={onPin}
            />
          </View>
        }
      >
        {pinnedAmounts.length === 0 ? (
          <AppText variant="body" color="textSecondary">
            {t('fast.presetsEmpty')}
          </AppText>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pinnedAmounts.map((amount) => (
              <View
                key={amount}
                testID={`preset-row-${amount}`}
                style={[styles.sheetRow, { minHeight: theme.touch.min, gap: theme.spacing.md }]}
              >
                <Money amountMinor={amount} currency={currency} variant="bodyStrong" hidden={false} />
                <Button
                  testID={`preset-remove-${amount}`}
                  title={t('fast.removePreset')}
                  accessibilityLabel={t('fast.removePresetA11y', { amount: amountText(amount) })}
                  variant="secondary"
                  onPress={() => onRemove(amount)}
                />
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  preset: { alignItems: 'center', justifyContent: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
