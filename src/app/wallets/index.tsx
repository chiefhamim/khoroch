import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatAccountBalance,
  formatAccountsTotal,
} from '@/domain/accounts';
import { formatFriendlyDate, todayLocalDate } from '@/domain/dates';
import { formatMoney, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import type { Account, Transaction } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { usePrivacyStore } from '@/state/privacyStore';
import { useAccounts } from '@/state/useAccounts';
import { containsBengali } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';
import { WalletAvatar } from '@/ui/WalletAvatar';
import { WalletEditorSheet } from '@/ui/WalletEditorSheet';
import { hapticLight, hapticSelection, hapticSuccess } from '@/ui/haptics';
import { PressableScale } from '@/ui/PressableScale';

export default function ManageWalletsScreen() {
  const locale = useLocale();
  const { setup, edit } = useLocalSearchParams<{ setup?: string; edit?: string }>();
  const { repo, settings } = useAppContext();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const { theme } = useTheme();
  const { showToast } = useToast();
  const today = todayLocalDate();

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' && containsBengali(text)
      ? { minWidth: estimateSingleLineMinWidth(text, fontSize) }
      : null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const {
    accounts,
    allAccounts,
    overview,
    transactions,
    untaggedCount,
    loading,
  } = useAccounts(today);

  const [sheetMode, setSheetMode] = useState<'closed' | 'create' | { editId: string }>(() =>
    setup === '1' ? 'create' : edit ? { editId: edit } : 'closed'
  );
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [tagTargetAccountId, setTagTargetAccountId] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);

  const editingAccount = useMemo(
    () =>
      typeof sheetMode === 'object'
        ? (allAccounts.find((a) => a.id === sheetMode.editId) ?? null)
        : null,
    [sheetMode, allAccounts]
  );
  const editorOpen = sheetMode === 'create' || (typeof sheetMode === 'object' && editingAccount !== null);

  const balanceById = useMemo(() => {
    const map = new Map<string, { minor: number; formatted: string; isDue: boolean }>();
    for (const item of overview.balances) {
      map.set(item.account.id, {
        minor: item.balanceMinor,
        formatted: item.formattedBalance,
        isDue: item.isDue,
      });
    }
    return map;
  }, [overview.balances]);

  const archivedAccounts = useMemo(
    () => allAccounts.filter((acc) => acc.archivedAt != null),
    [allAccounts]
  );

  const untaggedTransactions = useMemo<Transaction[]>(
    () =>
      transactions
        .filter((tx) => tx.deletedAt == null && tx.accountId === null)
        .sort((a, b) => {
          if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
          return b.createdAt - a.createdAt;
        })
        .slice(0, 100),
    [transactions]
  );

  const openCreate = () => {
    hapticLight();
    setSheetMode('create');
  };

  const openEdit = (acc: Account) => {
    hapticLight();
    setSheetMode({ editId: acc.id });
  };

  const handleMove = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= accounts.length) return;
    hapticSelection();
    const reordered = [...accounts];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    for (let i = 0; i < reordered.length; i += 1) {
      if (reordered[i].sortOrder !== i) {
        await repo.updateAccount(reordered[i].id, { sortOrder: i });
      }
    }
    bumpDataVersion();
  };

  const handleOpenTagOlder = () => {
    setSelectedTxIds([]);
    setTagTargetAccountId(accounts[0]?.id ?? null);
    setTagSheetOpen(true);
  };

  const toggleSelectedTx = (id: string) => {
    hapticSelection();
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyTagOlder = async () => {
    if (tagging || selectedTxIds.length === 0 || !tagTargetAccountId) return;
    setTagging(true);
    try {
      for (const txId of selectedTxIds) {
        await repo.updateTransaction(txId, { accountId: tagTargetAccountId });
      }
      bumpDataVersion();
      hapticSuccess();
      setTagSheetOpen(false);
      showToast({
        message: t('wallets.tagOlderSuccess'),
        icon: 'circle-check',
        tone: 'accent',
      });
    } finally {
      setTagging(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.headerRow}>
        <IconButton
          testID="wallets-back-btn"
          icon="arrow-left"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
        />
        <AppText variant="title" style={styles.flex1}>
          {t('wallets.title')}
        </AppText>
        <Button
          testID="wallets-add-btn"
          title={t('wallets.addButton')}
          leftIcon="plus"
          size="sm"
          onPress={openCreate}
        />
      </View>

      {accounts.length > 0 ? (
        <Surface style={styles.totalCard}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="textSecondary">
              {t('wallets.totalHeader')}
            </AppText>
            <AppText variant="headline" tabularNums>
              {hideAmounts
                ? HIDDEN_AMOUNT_TEXT
                : formatAccountsTotal(overview.totalMinor, settings.currency)}
            </AppText>
          </View>
          {overview.excludedCount > 0 ? (
            <AppText variant="caption" color="textSecondary">
              {t('overview.walletsExcludedNote', { count: overview.excludedCount })}
            </AppText>
          ) : null}
        </Surface>
      ) : null}

      {!loading && accounts.length === 0 ? (
        <Surface>
          <EmptyState
            icon="wallet"
            title={t('wallets.emptyTitle')}
            body={t('wallets.emptyBody')}
            ctaLabel={t('wallets.newTitle')}
            onCtaPress={openCreate}
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          {accounts.map((acc, idx) => {
            const bal = balanceById.get(acc.id);
            const formattedBal = bal
              ? bal.isDue
                ? `${formatAccountBalance('other', Math.abs(bal.minor), settings.currency)} ${t('wallets.dueSuffix')}`
                : bal.formatted
              : formatAccountBalance(acc.kind, acc.openingBalanceMinor, settings.currency);
            const metaParts: string[] = [];
            if (acc.last4) metaParts.push(t('wallets.endingLast4', { last4: acc.last4 }));
            if (!acc.includeInTotal) metaParts.push(t('wallets.excludedBadge'));
            const subtitle = metaParts.length > 0 ? metaParts.join(' · ') : undefined;

            return (
              <View key={acc.id}>
                <View style={styles.walletRow}>
                  <PressableScale pressScale={0.98}
                    testID={`manage-wallet-row-${acc.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={acc.name}
                    onPress={() => router.push(`/wallets/${acc.id}` as never)}
                    style={({ pressed }) => [
                      styles.walletMainTap,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <WalletAvatar account={acc} size="md" />
                    <View style={[styles.flex1, { gap: 2 }]}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {acc.name}
                      </AppText>
                      {subtitle ? (
                        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                          {subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText
                      variant="bodyStrong"
                      color={bal?.isDue ? 'danger' : 'text'}
                      tabularNums
                      numberOfLines={1}
                      style={bnMinWidth(formattedBal, 15)}
                    >
                      {hideAmounts ? HIDDEN_AMOUNT_TEXT : formattedBal}
                    </AppText>
                  </PressableScale>

                  <View style={styles.rowControls}>
                    <IconButton
                      testID={`wallet-move-up-${acc.id}`}
                      icon="chevron-up"
                      variant="ghost"
                      size={36}
                      iconSize={16}
                      disabled={idx === 0}
                      accessibilityLabel={t('wallets.moveUpA11y')}
                      onPress={() => void handleMove(idx, -1)}
                    />
                    <IconButton
                      testID={`wallet-move-down-${acc.id}`}
                      icon="chevron-down"
                      variant="ghost"
                      size={36}
                      iconSize={16}
                      disabled={idx === accounts.length - 1}
                      accessibilityLabel={t('wallets.moveDownA11y')}
                      onPress={() => void handleMove(idx, 1)}
                    />
                    <IconButton
                      testID={`wallet-edit-${acc.id}`}
                      icon="pencil"
                      variant="ghost"
                      size={36}
                      iconSize={16}
                      accessibilityLabel={t('common.edit')}
                      onPress={() => openEdit(acc)}
                    />
                  </View>
                </View>
                {acc.openingBalanceMinor === 0 ? (
                  <Button
                    testID={`wallet-set-starting-${acc.id}`}
                    title={t('wallets.setStartingBalance')}
                    variant="secondary"
                    size="sm"
                    onPress={() => openEdit(acc)}
                    style={styles.startingBalanceButton}
                  />
                ) : null}

                {idx < accounts.length - 1 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.separator,
                      marginLeft: 68,
                      marginRight: theme.spacing.lg,
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </Surface>
      )}

      {/* Optional Tag older entries helper */}
      {accounts.length > 0 && untaggedCount > 0 ? (
        <Surface padded={false}>
          <ListRow
            testID="wallets-tag-older-row"
            title={t('wallets.tagOlderTitle')}
            subtitle={t('wallets.tagOlderSubtitle', { count: untaggedCount })}
            left={
              <View
                style={[
                  styles.helperTile,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderRadius: theme.radius.iconTile,
                  },
                ]}
              >
                <AppIcon name="tag" size={18} color={theme.colors.textSecondary} />
              </View>
            }
            showChevron
            onPress={handleOpenTagOlder}
          />
        </Surface>
      ) : null}

      {/* Archived wallets */}
      {archivedAccounts.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="label" color="textSecondary">
            {t('wallets.archivedSection')}
          </AppText>
          <Surface padded={false}>
            {archivedAccounts.map((acc, idx) => (
              <ListRow
                key={acc.id}
                testID={`archived-wallet-row-${acc.id}`}
                title={acc.name}
                left={<WalletAvatar account={acc} size="sm" />}
                right={
                  <Button
                    testID={`restore-wallet-${acc.id}`}
                    title={t('wallets.restoreButton')}
                    variant="secondary"
                    size="sm"
                    onPress={async () => {
                      await repo.unarchiveAccount(acc.id);
                      bumpDataVersion();
                      hapticSuccess();
                    }}
                  />
                }
                showDivider={idx < archivedAccounts.length - 1}
              />
            ))}
          </Surface>
        </View>
      ) : null}

      <WalletEditorSheet
        visible={editorOpen}
        onClose={() => setSheetMode('closed')}
        account={editingAccount}
        nextSortOrder={accounts.length}
      />

      {/* Tag older entries sheet */}
      <Sheet
        visible={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        title={t('wallets.tagOlderTitle')}
        testID="tag-older-entries-sheet"
        footer={
          accounts.length > 0 && untaggedTransactions.length > 0 ? (
            <Button
              testID="tag-older-apply-btn"
              title={t('wallets.tagOlderApplyCta', { count: selectedTxIds.length })}
              disabled={tagging || selectedTxIds.length === 0 || !tagTargetAccountId}
              loading={tagging}
              onPress={() => void handleApplyTagOlder()}
            />
          ) : undefined
        }
      >
        <AppText variant="caption" color="textSecondary">
          {t('wallets.tagOlderExplain')}
        </AppText>

        {untaggedTransactions.length === 0 ? (
          <AppText variant="body" color="textSecondary">
            {t('wallets.tagOlderEmpty')}
          </AppText>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textSecondary">
                {t('wallets.tagOlderTargetLabel')}
              </AppText>
              <View style={[styles.wrapRow, { gap: theme.spacing.xs }]}>
                {accounts.map((acc) => {
                  const selected = tagTargetAccountId === acc.id;
                  return (
                    <PressableScale pressScale={0.98}
                      key={acc.id}
                      testID={`tag-target-wallet-${acc.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        hapticSelection();
                        setTagTargetAccountId(acc.id);
                      }}
                      style={[
                        styles.targetPill,
                        {
                          backgroundColor: selected
                            ? theme.colors.accentSoft
                            : theme.colors.surfaceSunken,
                          borderColor: selected ? theme.colors.accent : 'transparent',
                          borderRadius: theme.radius.pill,
                        },
                      ]}
                    >
                      <WalletAvatar account={acc} size="xs" />
                      <AppText variant="label" color={selected ? 'accent' : 'text'}>
                        {acc.name}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View style={styles.selectActionsRow}>
              <Button
                title={
                  selectedTxIds.length === untaggedTransactions.length
                    ? t('wallets.tagOlderClearAll')
                    : t('wallets.tagOlderSelectAll')
                }
                variant="ghost"
                size="sm"
                onPress={() => {
                  if (selectedTxIds.length === untaggedTransactions.length) {
                    setSelectedTxIds([]);
                  } else {
                    setSelectedTxIds(untaggedTransactions.map((item) => item.id));
                  }
                }}
              />
            </View>

            <Surface padded={false}>
              {untaggedTransactions.map((tx, idx) => {
                const selected = selectedTxIds.includes(tx.id);
                const prefix = tx.type === 'income' ? '+' : '−';
                return (
                  <ListRow
                    key={tx.id}
                    testID={`tag-tx-row-${tx.id}`}
                    compact
                    title={tx.description.trim() || t('activity.noDescription')}
                    subtitle={formatFriendlyDate(tx.occurredOn, today, locale)}
                    left={
                      <AppIcon
                        name={selected ? 'circle-check' : 'circle-plus'}
                        size={20}
                        color={selected ? theme.colors.accent : theme.colors.textTertiary}
                      />
                    }
                    right={
                      <AppText variant="bodyStrong" tabularNums>
                        {hideAmounts
                          ? HIDDEN_AMOUNT_TEXT
                          : `${prefix}${formatMoney(tx.amountMinor, tx.currency, { showPoisha })}`}
                      </AppText>
                    }
                    showDivider={idx < untaggedTransactions.length - 1}
                    onPress={() => toggleSelectedTx(tx.id)}
                  />
                );
              })}
            </Surface>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    minHeight: 62,
    gap: 8,
  },
  walletMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  rowControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helperTile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
  },
  selectActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  startingBalanceButton: {
    alignSelf: 'flex-start',
    marginLeft: 68,
    marginBottom: 8,
    minWidth: 0,
  },
});
