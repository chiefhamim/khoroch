import * as Crypto from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { parseMoneyInput } from '@/domain/money';
import type { Account, CurrencyCode } from '@/domain/types';
import { todayLocalDate } from '@/domain/dates';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Keypad } from './Keypad';
import { Money } from './Money';
import { Sheet } from './Sheet';

interface BalanceAdjustmentSheetProps {
  visible: boolean;
  account: Account;
  currentBalanceMinor: number;
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (input: {
    id: string;
    type: 'expense' | 'income';
    amountMinor: number;
    accountId: string;
    occurredOn: string;
    description: string;
  }) => Promise<void>;
}

export function BalanceAdjustmentSheet({
  visible,
  account,
  currentBalanceMinor,
  currency,
  onClose,
  onSave,
}: BalanceAdjustmentSheetProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');
  const parsed = useMemo(() => parseMoneyInput(draft), [draft]);
  const targetMinor = parsed.ok && parsed.minor !== null ? parsed.minor : null;
  const difference = targetMinor === null ? null : targetMinor - currentBalanceMinor;
  const canSave = difference !== null && difference !== 0;

  const save = async () => {
    if (!canSave || difference === null) return;
    await onSave({
      id: Crypto.randomUUID(),
      type: difference > 0 ? 'income' : 'expense',
      amountMinor: Math.abs(difference),
      accountId: account.id,
      occurredOn: todayLocalDate(),
      description: t('wallets.adjustmentDescription'),
    });
    setDraft('');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('wallets.adjustBalance')}
      footer={
        <Button
          title={t('wallets.saveAdjustment')}
          disabled={!canSave}
          onPress={() => void save()}
        />
      }
    >
      <View style={styles.content}>
        <Money
          amountMinor={targetMinor ?? 0}
          currency={currency}
          variant="display"
          color={targetMinor === null ? 'textTertiary' : 'text'}
        />
        <View style={[styles.helper, { backgroundColor: theme.colors.surfaceSunken }]}>
          <Money amountMinor={currentBalanceMinor} currency={currency} variant="bodyStrong" />
          <AppText variant="caption" color="textSecondary">
            {t('wallets.adjustmentHint')}
          </AppText>
        </View>
        <Keypad value={draft} onChange={setDraft} keyHeight={48} testID="adjust-balance-keypad" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, alignItems: 'stretch' },
  helper: { padding: 16, borderRadius: 14, gap: 4 },
});
