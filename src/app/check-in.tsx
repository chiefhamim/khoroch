import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { summarizeDayActivity } from '@/domain/calc';
import {
  addDays,
  formatFriendlyTime,
  formatWeekdayShortDate,
  isDevice24HourClock,
  todayLocalDate,
} from '@/domain/dates';
import type { Category, Transaction } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { hapticSuccess } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';

export default function CheckInScreen() {
  const { repo, settings } = useAppContext();
  const locale = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const version = useDataVersionStore((s) => s.dataVersion);

  const today = todayLocalDate();
  const use24Hour = isDevice24HourClock();
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
      bumpDataVersion();
      hapticSuccess();
      showToast({
        message: t('checkIn.reviewedBadge'),
        icon: 'circle-check',
        tone: 'accent',
      });
    } catch {
      showToast({
        message: t('error.genericBody'),
        tone: 'danger',
      });
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
      {/* Top Bar */}
      <View style={[styles.header, { gap: theme.spacing.md }]}>
        <IconButton
          testID="check-in-back"
          icon="arrow-left"
          variant="surface"
          accessibilityLabel={t('common.back')}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="display" numberOfLines={1}>
            {t('checkIn.title')}
          </AppText>
          <AppText variant="label" color="textSecondary">
            {formatWeekdayShortDate(today, locale)}
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
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                gap: theme.spacing.xs,
              },
            ]}
          >
            <AppIcon name="circle-check" size={16} color={theme.colors.accent} />
            <AppText
              variant="label"
              color="accent"
              numberOfLines={1}
              style={{
                minWidth: estimateSingleLineMinWidth(
                  t('checkIn.reviewedBadge'),
                  theme.typography.label.fontSize
                ),
              }}
            >
              {t('checkIn.reviewedBadge')}
            </AppText>
          </View>
        </View>
      ) : null}

      {/* Three stat columns: Spent | Income | Entries */}
      <Surface>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <AppText variant="caption" color="textSecondary">
              {t('checkIn.expensesLabel')}
            </AppText>
            <Money
              testID="check-in-expenses-amount"
              amountMinor={daySummary.expenseMinor}
              currency={settings.currency}
              variant="headline"
            />
          </View>

          <View style={[styles.vDivider, { backgroundColor: theme.colors.separator }]} />

          <View style={styles.statCol}>
            <AppText variant="caption" color="textSecondary">
              {t('checkIn.incomeLabel')}
            </AppText>
            <Money
              testID="check-in-income-amount"
              amountMinor={daySummary.incomeMinor}
              currency={settings.currency}
              variant="headline"
              color="accent"
            />
          </View>

          <View style={[styles.vDivider, { backgroundColor: theme.colors.separator }]} />

          <View style={styles.statCol}>
            <AppText variant="caption" color="textSecondary">
              {t('checkIn.countLabel')}
            </AppText>
            <AppText testID="check-in-tx-count" variant="headline" tabularNums>
              {daySummary.count}
            </AppText>
          </View>
        </View>
      </Surface>

      {/* Primary Done CTA + Secondary 50/50 row */}
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          testID="check-in-done-btn"
          title={reviewed ? t('checkIn.alreadyDone') : t('checkIn.doneForToday')}
          variant={reviewed ? 'secondary' : 'primary'}
          loading={savingReview}
          disabled={savingReview || reviewed}
          onPress={() => void handleMarkDone()}
        />

        <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
          <Button
            testID="check-in-add-btn"
            title={t('checkIn.quickAddExpense')}
            variant="secondary"
            size="sm"
            onPress={() => router.push('/transaction/new')}
            style={{ flex: 1 }}
          />
          <Button
            testID="check-in-quick-entry-btn"
            title={t('quickEntry.title')}
            variant="secondary"
            size="sm"
            onPress={() => router.push('/quick-entry')}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <SectionHeader title={t('checkIn.todayListHeading')} />
      {daySummary.transactions.length === 0 ? (
        <EmptyState
          icon="circle-check"
          title={t('checkIn.emptyTitle')}
          body={t('checkIn.emptyBody')}
        />
      ) : (
        <Surface padded={false}>
          {daySummary.transactions.map((tx, idx) => {
            const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
            const catLabel = cat?.name ?? t('common.uncategorized');
            const title = tx.description.trim() || catLabel;
            const subtitle = tx.occurredTime
              ? `${catLabel} · ${formatFriendlyTime(tx.occurredTime, use24Hour)}`
              : catLabel;
            const isIncome = tx.type === 'income';
            return (
              <ListRow
                key={tx.id}
                title={title}
                subtitle={subtitle}
                showDivider={idx < daySummary.transactions.length - 1}
                left={
                  <IconTile
                    icon={cat?.icon ?? 'shapes'}
                    colorKey={cat?.colorKey ?? 'gray'}
                    size="md"
                  />
                }
                right={
                  <Money
                    amountMinor={tx.amountMinor}
                    currency={tx.currency}
                    prefix={isIncome ? '+' : '−'}
                    variant="bodyStrong"
                    color={isIncome ? 'accent' : 'text'}
                  />
                }
                showChevron
                onPress={() => router.push(`/transaction/${tx.id}`)}
              />
            );
          })}
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingHorizontal: 6,
  },
  vDivider: {
    width: 1,
    height: 36,
  },
  actionsRow: {
    flexDirection: 'row',
  },
});
