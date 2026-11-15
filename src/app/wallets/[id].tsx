import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  computeAccountBalanceSeries,
  formatAccountBalance,
  resolveWalletColorHex,
} from '@/domain/accounts';
import { addDays, formatFriendlyDate, formatFriendlyTime, isDevice24HourClock, todayLocalDate } from '@/domain/dates';
import { formatMoney, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import type { Category, Transfer } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { usePrivacyStore } from '@/state/privacyStore';
import { useAccounts } from '@/state/useAccounts';
import { usePeople } from '@/state/usePeople';
import { useTheme } from '@/theme/useTheme';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';
import { WalletAvatar } from '@/ui/WalletAvatar';
import { WalletBalanceChart } from '@/ui/WalletBalanceChart';
import { WalletEditorSheet } from '@/ui/WalletEditorSheet';
import { BalanceAdjustmentSheet } from '@/ui/BalanceAdjustmentSheet';

type WalletFeedItem =
  | {
      kind: 'tx';
      id: string;
      occurredOn: string;
      occurredTime: string | null;
      createdAt: number;
      title: string;
      subtitle: string;
      icon: string;
      colorKey: string;
      amountMinor: number;
      prefix: string;
      isIncome: boolean;
      targetRoute: { pathname: '/transaction/[id]'; params: { id: string } };
    }
  | {
      kind: 'transfer';
      id: string;
      occurredOn: string;
      occurredTime: string | null;
      createdAt: number;
      title: string;
      subtitle: string;
      amountMinor: number;
      prefix: string;
      isIncome: boolean;
      targetRoute: { pathname: '/transfer/[id]'; params: { id: string } };
    }
  | {
      kind: 'due';
      id: string;
      occurredOn: string;
      occurredTime: string | null;
      createdAt: number;
      title: string;
      subtitle: string;
      icon: string;
      colorKey: string;
      amountMinor: number;
      prefix: string;
      isIncome: boolean;
      targetRoute: { pathname: '/people/[id]'; params: { id: string } };
    };

export default function WalletDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const walletId = Array.isArray(id) ? id[0] : id;
  const { repo, settings } = useAppContext();
  const locale = useLocale();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const currency = settings.currency;
  const { theme } = useTheme();
  const today = todayLocalDate();
  const use24Hour = isDevice24HourClock();

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(text, fontSize) } : undefined;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/wallets');
    }
  };

  const {
    accountsById,
    overview,
    transactions,
    transfers,
    dueEntries,
    loading,
  } = useAccounts(today);
  const { peopleById } = usePeople();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

  React.useEffect(() => {
    let active = true;
    repo
      .listCategories({ includeArchived: true })
      .then((cats) => {
        if (active) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [repo]);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const account = walletId ? accountsById.get(walletId) : undefined;
  const balanceEntry = useMemo(
    () => overview.balances.find((b) => b.account.id === walletId),
    [overview.balances, walletId]
  );

  const chartPoints = useMemo(() => {
    if (!account) return [];
    const fromDate = addDays(today, -29);
    return computeAccountBalanceSeries({
      account,
      transactions,
      transfers,
      dues: dueEntries,
      fromDate,
      toDate: today,
      currency,
    });
  }, [account, transactions, transfers, dueEntries, today, currency]);

  const feedItems = useMemo<WalletFeedItem[]>(() => {
    if (!account) return [];
    const transferMap = new Map<string, Transfer>();
    for (const tr of transfers) {
      if (tr.deletedAt == null) transferMap.set(tr.id, tr);
    }

    const items: WalletFeedItem[] = [];

    for (const tx of transactions) {
      if (tx.deletedAt != null || tx.accountId !== account.id) continue;
      // Fold linked transfer fee rows into their parent transfer card on the from-wallet feed
      if (tx.transferId && transferMap.has(tx.transferId)) continue;

      const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const catName = cat?.name ?? t('common.uncategorized');
      const isIncome = tx.type === 'income';
      const whenLabel = tx.occurredTime
        ? formatFriendlyTime(tx.occurredTime, use24Hour)
        : formatFriendlyDate(tx.occurredOn, today, locale);
      const beforeOpening = tx.occurredOn < account.openingDate;
      const subParts = [catName, whenLabel];
      if (beforeOpening) subParts.push(t('wallets.beforeOpening'));

      items.push({
        kind: 'tx',
        id: `tx_${tx.id}`,
        occurredOn: tx.occurredOn,
        occurredTime: tx.occurredTime,
        createdAt: tx.createdAt,
        title: tx.description.trim() || catName,
        subtitle: subParts.join(' · '),
        icon: cat?.icon ?? 'shapes',
        colorKey: cat?.colorKey ?? 'gray',
        amountMinor: tx.amountMinor,
        prefix: isIncome ? '+' : '−',
        isIncome,
        targetRoute: { pathname: '/transaction/[id]', params: { id: tx.id } },
      });
    }

    for (const tr of transfers) {
      if (tr.deletedAt != null) continue;
      if (tr.fromAccountId !== account.id && tr.toAccountId !== account.id) continue;
      const fromAcc = accountsById.get(tr.fromAccountId);
      const toAcc = accountsById.get(tr.toAccountId);
      const isOutgoing = tr.fromAccountId === account.id;
      const title = t('activity.transferTitle', {
        from: fromAcc?.name ?? t('tx.walletLabel'),
        to: toAcc?.name ?? t('tx.walletLabel'),
      });
      const whenLabel = tr.occurredTime
        ? formatFriendlyTime(tr.occurredTime, use24Hour)
        : formatFriendlyDate(tr.occurredOn, today, locale);
      const feeText =
        isOutgoing && tr.feeMinor > 0
          ? t('activity.transferWithFeeSub', {
              fee: formatMoney(tr.feeMinor, currency, { hidden: hideAmounts, showPoisha }),
            })
          : t('activity.transferSub');

      items.push({
        kind: 'transfer',
        id: `tr_${tr.id}`,
        occurredOn: tr.occurredOn,
        occurredTime: tr.occurredTime,
        createdAt: tr.createdAt,
        title,
        subtitle: tr.note.trim() ? `${feeText} · ${tr.note.trim()}` : `${feeText} · ${whenLabel}`,
        amountMinor: tr.amountMinor,
        prefix: isOutgoing ? '−' : '+',
        isIncome: !isOutgoing,
        targetRoute: { pathname: '/transfer/[id]', params: { id: tr.id } },
      });
    }

    for (const due of dueEntries) {
      if (due.deletedAt != null || due.accountId !== account.id) continue;
      const person = peopleById.get(due.personId);
      const personName = person?.name ?? t('people.title');
      const incoming = due.kind === 'received_back' || due.kind === 'borrowed';
      const titleMap: Record<typeof due.kind, string> = {
        lent: t('daybook.dueLent', { name: personName }),
        received_back: t('daybook.dueReceivedBack', { name: personName }),
        borrowed: t('daybook.dueBorrowed', { name: personName }),
        paid_back: t('daybook.duePaidBack', { name: personName }),
      };
      const whenLabel = due.occurredTime
        ? formatFriendlyTime(due.occurredTime, use24Hour)
        : formatFriendlyDate(due.occurredOn, today, locale);
      const subParts = [whenLabel];
      if (due.occurredOn < account.openingDate) subParts.push(t('wallets.beforeOpening'));
      if (due.note.trim()) subParts.push(due.note.trim());

      items.push({
        kind: 'due',
        id: `due_${due.id}`,
        occurredOn: due.occurredOn,
        occurredTime: due.occurredTime,
        createdAt: due.createdAt,
        title: titleMap[due.kind],
        subtitle: subParts.join(' · '),
        icon: incoming ? 'arrow-down-left' : 'arrow-up-right',
        colorKey: incoming ? 'teal' : 'orange',
        amountMinor: due.amountMinor,
        prefix: incoming ? '+' : '−',
        isIncome: incoming,
        targetRoute: { pathname: '/people/[id]', params: { id: due.personId } },
      });
    }

    return items.sort((a, b) => {
      if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      return b.id.localeCompare(a.id);
    });
  }, [account, transfers, transactions, dueEntries, categoriesById, accountsById, peopleById, currency, today, use24Hour, hideAmounts, showPoisha, locale]);

  if (!loading && !account) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel={t('common.back')}
            onPress={handleBack}
          />
          <AppText variant="title" style={styles.flex1}>
            {t('wallets.title')}
          </AppText>
        </View>
        <ErrorState
          title={t('wallets.emptyTitle')}
          body={t('error.genericBody')}
          retryLabel={t('common.back')}
          onRetry={handleBack}
        />
      </Screen>
    );
  }

  if (!account) {
    return null;
  }

  const balMinor = balanceEntry?.balanceMinor ?? account.openingBalanceMinor;
  const isDue = account.kind === 'credit_card' && balMinor < 0;
  const formattedBal = hideAmounts
    ? HIDDEN_AMOUNT_TEXT
    : isDue
      ? `${formatAccountBalance('other', Math.abs(balMinor), settings.currency)} ${t('wallets.dueSuffix')}`
      : (balanceEntry?.formattedBalance ??
        formatAccountBalance(account.kind, balMinor, settings.currency));
  const openingAmountLabel = hideAmounts
    ? HIDDEN_AMOUNT_TEXT
    : `${account.openingBalanceMinor < 0 ? '-' : ''}${formatMoney(Math.abs(account.openingBalanceMinor), settings.currency, { showPoisha })}`;
  const excludedBadgeText = t('wallets.excludedBadge');
  const last4Text = account.last4 ? t('wallets.endingLast4', { last4: account.last4 }) : '';

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.headerRow}>
        <IconButton
          testID="wallet-detail-back"
          icon="arrow-left"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
        />
        <AppText variant="title" style={styles.flex1} numberOfLines={1}>
          {account.name}
        </AppText>
        <IconButton
          testID="wallet-detail-edit"
          icon="pencil"
          accessibilityLabel={t('common.edit')}
          onPress={() => setEditorOpen(true)}
        />
      </View>

      <Surface testID="wallet-detail-summary" style={{ gap: theme.spacing.sm }}>
        <View style={styles.summaryTop}>
          <WalletAvatar account={account} size="lg" />
          <View style={[styles.flex1, { gap: 2 }]}>
            <AppText variant="caption" color="textSecondary">
              {t('wallets.currentBalanceLabel')}
            </AppText>
            <AppText
              testID="wallet-detail-balance"
              variant="display"
              color={isDue ? 'danger' : 'text'}
              tabularNums
            >
              {formattedBal}
            </AppText>
          </View>
        </View>

        <View style={styles.metaRow}>
          <AppText variant="caption" color="textSecondary" style={styles.flex1}>
            {t('wallets.openingMeta', {
              amount: openingAmountLabel,
              date: formatFriendlyDate(account.openingDate, today, locale),
            })}
          </AppText>
          {account.last4 ? (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={bnMinWidth(last4Text, theme.typography.caption.fontSize)}
            >
              {last4Text}
            </AppText>
          ) : null}
          {!account.includeInTotal ? (
            <View
              style={[
                styles.excludedPill,
                {
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <AppText
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                style={bnMinWidth(excludedBadgeText, theme.typography.caption.fontSize)}
              >
                {excludedBadgeText}
              </AppText>
            </View>
          ) : null}
        </View>
      </Surface>

      <Button
        testID="wallet-adjust-balance"
        title={t('wallets.adjustBalance')}
        variant="secondary"
        onPress={() => setAdjustmentOpen(true)}
      />

      {chartPoints.length > 0 ? (
        <WalletBalanceChart
          points={chartPoints}
          accountKind={account.kind}
          currency={settings.currency}
          lineColor={resolveWalletColorHex(account)}
          today={today}
          hidden={hideAmounts}
        />
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="headline">{t('wallets.entriesTitle')}</AppText>

        {feedItems.length === 0 ? (
          <Surface>
            <EmptyState
              icon="list"
              title={t('wallets.entriesTitle')}
              body={t('wallets.entriesEmpty')}
            />
          </Surface>
        ) : (
          <Surface padded={false}>
            {feedItems.map((item, idx) => (
              <ListRow
                key={item.id}
                testID={`wallet-entry-${item.id}`}
                title={item.title}
                subtitle={item.subtitle}
                left={
                  item.kind === 'transfer' ? (
                    <IconTile icon="arrow-left-right" neutral size="md" />
                  ) : (
                    <IconTile icon={item.icon} colorKey={item.colorKey} size="md" />
                  )
                }
                right={
                  <AppText
                    variant="bodyStrong"
                    color={item.isIncome ? 'accent' : 'text'}
                    tabularNums
                    numberOfLines={1}
                    style={styles.noWrap}
                  >
                    {hideAmounts
                      ? HIDDEN_AMOUNT_TEXT
                      : `${item.prefix}${formatMoney(item.amountMinor, settings.currency, { showPoisha })}`}
                  </AppText>
                }
                showDivider={idx < feedItems.length - 1}
                onPress={() => router.push(item.targetRoute as never)}
              />
            ))}
          </Surface>
        )}
      </View>

      <WalletEditorSheet
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        account={account}
      />
      <BalanceAdjustmentSheet
        visible={adjustmentOpen}
        account={account}
        currentBalanceMinor={balMinor}
        currency={settings.currency}
        onClose={() => setAdjustmentOpen(false)}
        onSave={async (input) => {
          await repo.insertTransaction({
            ...input,
            currency: settings.currency,
            categoryId: 'other',
            note: '',
            occurredTime: null,
            source: 'manual',
          });
          bumpDataVersion();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  excludedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  noWrap: {
    flexShrink: 0,
  },
});
