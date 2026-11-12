import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { summarizeDayActivity } from '@/domain/calc';
import { addDays, formatWeekdayShortDate, todayLocalDate } from '@/domain/dates';
import type { Category, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';

export default function CheckInScreen() {
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const version = useDataVersionStore((s) => s.dataVersion);

  const today = todayLocalDate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoriesById, setCategoriesById] = useState<Map<string, Category>>(new Map());
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let active = true;
    const tomorrow = addDays(today, 1);
    Promise.all([
      repo.listTransactionsInRange(today, tomorrow),
      repo.listCategories({ includeArchived: true }),
      repo.isDayReviewed(today),
    ])
      .then(([txs, cats, isDone]) => {
        if (!active) return;
        const catMap = new Map<string, Category>();
        for (const c of cats) {
          catMap.set(c.id, c);
        }
        setTransactions(txs);
        setCategoriesById(catMap);
        setReviewed(isDone);
        setError(null);
      })
      .catch(() => {
        if (active) {
          setError(t('error.genericBody'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [repo, today, version, reloadNonce]);

  const handleMarkDone = async () => {
    if (savingReview) return;
    setSavingReview(true);
    try {
      await repo.markDayReviewed(today);
      setReviewed(true);
    } finally {
      setSavingReview(false);
    }
  };

  if (error && !loading) {
    return (
      <Screen>
        <ErrorState
          title={t('error.genericTitle')}
          body={error}
          retryLabel={t('common.retry')}
          onRetry={() => setReloadNonce((n) => n + 1)}
        />
      </Screen>
    );
  }

  const daySummary = summarizeDayActivity(transactions, today, settings.currency);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { minHeight: theme.touch.min }]}>
        <Pressable
          testID="check-in-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={[
            styles.backBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
          <AppText variant="title" numberOfLines={1}>
            {t('checkIn.title')}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {formatWeekdayShortDate(today)}
          </AppText>
        </View>
      </View>

      {reviewed ? (
        <View style={styles.badgeRow}>
          <View
            testID="check-in-reviewed-badge"
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                gap: theme.spacing.xs,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
            <AppText variant="caption" color="primary">
              {t('checkIn.reviewedBadge')}
            </AppText>
          </View>
        </View>
      ) : null}

      <Card style={{ gap: theme.spacing.md }}>
        <View style={[styles.statsRow, { gap: theme.spacing.md }]}>
          <View style={styles.statCol}>
            <AppText variant="caption" color="textMuted">
              {t('checkIn.expensesLabel')}
            </AppText>
            <Money
              testID="check-in-expenses-amount"
              amountMinor={daySummary.expenseMinor}
              currency={settings.currency}
              variant="title"
            />
          </View>
          <View style={styles.statCol}>
            <AppText variant="caption" color="textMuted">
              {t('checkIn.incomeLabel')}
            </AppText>
            <Money
              testID="check-in-income-amount"
              amountMinor={daySummary.incomeMinor}
              currency={settings.currency}
              variant="title"
              color="primary"
            />
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.border }} />

        <View style={styles.countRow}>
          <AppText variant="label" color="textMuted">
            {t('checkIn.countLabel')}
          </AppText>
          <AppText testID="check-in-tx-count" variant="heading" tabularNums>
            {daySummary.count}
          </AppText>
        </View>
      </Card>

      <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
        <Button
          testID="check-in-add-btn"
          title={t('checkIn.quickAddExpense')}
          variant="secondary"
          onPress={() => router.push('/transaction/new')}
          style={{ flex: 1 }}
        />
        <Button
          testID="check-in-quick-entry-btn"
          title={t('quickEntry.title')}
          variant="secondary"
          onPress={() => router.push('/quick-entry')}
          style={{ flex: 1 }}
        />
      </View>

      <Button
        testID="check-in-done-btn"
        title={reviewed ? t('checkIn.alreadyDone') : t('checkIn.doneForToday')}
        variant={reviewed ? 'secondary' : 'primary'}
        loading={savingReview}
        disabled={savingReview || reviewed}
        onPress={() => void handleMarkDone()}
      />

      <SectionHeader title={t('checkIn.todayListHeading')} />
      {daySummary.transactions.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('checkIn.emptyTitle')}
          body={t('checkIn.emptyBody')}
        />
      ) : (
        <Card padded={false}>
          {daySummary.transactions.map((tx, idx) => {
            const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
            const title =
              tx.description.trim() || cat?.name || t('common.uncategorized');
            return (
              <React.Fragment key={tx.id}>
                {idx > 0 ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border }} />
                ) : null}
                <ListRow
                  title={title}
                  subtitle={cat?.name ?? t('common.uncategorized')}
                  left={
                    <CategoryIcon
                      icon={cat?.icon ?? 'ellipsis-horizontal'}
                      size="md"
                      tone={tx.type === 'income' ? 'income' : 'expense'}
                    />
                  }
                  right={
                    <Money
                      amountMinor={tx.amountMinor}
                      currency={tx.currency}
                      prefix={tx.type === 'expense' ? '−' : '+'}
                      variant="label"
                      color={tx.type === 'income' ? 'income' : 'expense'}
                    />
                  }
                  showChevron
                  onPress={() => router.push(`/transaction/${tx.id}`)}
                />
              </React.Fragment>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    gap: 2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsRow: {
    flexDirection: 'row',
  },
});
