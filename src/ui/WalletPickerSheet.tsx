import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatAccountBalance, formatWalletSubtitle } from '@/domain/accounts';
import type { Account, CurrencyCode } from '@/domain/types';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { ListRow } from './ListRow';
import { Sheet } from './Sheet';
import { Surface } from './Surface';
import { WalletAvatar } from './WalletAvatar';
import { hapticSelection } from './haptics';

export interface WalletPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  accounts: readonly Account[];
  selectedAccountId: string | null;
  allowNone?: boolean;
  excludeAccountId?: string | null;
  balancesById?: ReadonlyMap<string, number>;
  currency?: CurrencyCode;
  onSelect: (accountId: string | null) => void;
  onPressSetupWallets?: () => void;
  testID?: string;
}

export function WalletPickerSheet({
  visible,
  onClose,
  title,
  accounts,
  selectedAccountId,
  allowNone = true,
  excludeAccountId = null,
  balancesById,
  currency = 'BDT',
  onSelect,
  onPressSetupWallets,
  testID,
}: WalletPickerSheetProps) {
  const { theme } = useTheme();
  const visibleAccounts = accounts.filter(
    (acc) => acc.archivedAt == null && acc.id !== excludeAccountId
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('tx.chooseWalletTitle')}
      testID={testID ?? 'wallet-picker-sheet'}
    >
      <Surface padded={false}>
        {allowNone ? (
          <ListRow
            testID="wallet-picker-option-none"
            compact
            title={t('tx.noWallet')}
            left={<WalletAvatar account={null} size="sm" />}
            right={
              selectedAccountId === null ? (
                <AppIcon name="check" size={18} color={theme.colors.accent} />
              ) : null
            }
            showDivider={visibleAccounts.length > 0}
            onPress={() => {
              hapticSelection();
              onSelect(null);
              onClose();
            }}
          />
        ) : null}

        {visibleAccounts.map((acc, idx) => {
          const isSelected = selectedAccountId === acc.id;
          const balMinor = balancesById?.get(acc.id);
          const subtitle =
            balMinor !== undefined
              ? `${formatWalletSubtitle(acc)} · ${formatAccountBalance(acc.kind, balMinor, currency)}`
              : acc.last4
                ? formatWalletSubtitle(acc)
                : undefined;

          return (
            <ListRow
              key={acc.id}
              testID={`wallet-picker-option-${acc.id}`}
              compact
              title={acc.name}
              subtitle={subtitle}
              left={<WalletAvatar account={acc} size="sm" />}
              right={
                isSelected ? (
                  <AppIcon name="check" size={18} color={theme.colors.accent} />
                ) : null
              }
              showDivider={idx < visibleAccounts.length - 1}
              onPress={() => {
                hapticSelection();
                onSelect(acc.id);
                onClose();
              }}
            />
          );
        })}

        {visibleAccounts.length === 0 && !allowNone ? (
          <View style={styles.emptyBox}>
            <AppText variant="body" color="textSecondary">
              {t('wallets.emptyBody')}
            </AppText>
          </View>
        ) : null}
      </Surface>

      {onPressSetupWallets ? (
        <Button
          testID="wallet-picker-setup-btn"
          title={t('tx.setupWalletCta')}
          variant="secondary"
          onPress={() => {
            onClose();
            onPressSetupWallets();
          }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    padding: 16,
  },
});
