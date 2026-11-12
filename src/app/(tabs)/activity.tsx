import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DailyTransactionGroup } from '@/domain/calc';
import { addDays, parseLocalDate, toEpochDay, todayLocalDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useTransactions } from '@/state/useTransactions';
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

const WEEKDAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatGroupDate(date: LocalDate, today: LocalDate, yesterday: LocalDate): string {
  if (date === today) return t('common.today');
  if (date === yesterday) return t('common.yesterday');
  const { month, day } = parseLocalDate(date);
  const epochDay = toEpochDay(date);
  const weekdayIdx = ((epochDay % 7) + 7) % 7;
  return `${WEEKDAYS[weekdayIdx]}, ${day} ${MONTHS[month - 1]}`;
}

export default function ActivityScreen() {
  const { settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const {
    groups,
    categoriesById,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reload,
  } = useTransactions();

  const today = todayLocalDate();
  const yesterday = useMemo(() => addDays(today, -1), [today]);

  if (error && groups.length === 0) {
    return (
      <Screen>
        <ErrorState
          title={t('error.genericTitle')}
          body={t('error.genericBody')}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      </Screen>
    );
  }

  if (!loading && groups.length === 0) {
    return (
      <Screen>
        <AppText variant="title">{t('activity.title')}</AppText>
        <EmptyState
          icon="receipt-outline"
          title={t('empty.activityTitle')}
          body={t('empty.activityBody')}
          ctaLabel={t('empty.activityCta')}
          onCtaPress={() => router.push('/transaction/new')}
        />
      </Screen>
    );
  }

  const renderGroup = ({ item }: { item: DailyTransactionGroup }) => (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={[styles.groupHeader, { paddingHorizontal: theme.spacing.xs }]}>
        <AppText variant="label" color="textMuted">
          {formatGroupDate(item.date, today, yesterday)}
        </AppText>
        <View style={[styles.groupTotals, { gap: theme.spacing.md }]}>
          {item.incomeMinor > 0 ? (
            <View style={[styles.totalPair, { gap: theme.spacing.xs }]}>
              <AppText variant="caption" color="textMuted">
                {t('activity.incomeLabel')}
              </AppText>
              <Money
                amountMinor={item.incomeMinor}
                currency={settings.currency}
                variant="caption"
                color="income"
                prefix="+"
              />
            </View>
          ) : null}
          {item.expenseMinor > 0 ? (
            <View style={[styles.totalPair, { gap: theme.spacing.xs }]}>
              <AppText variant="caption" color="textMuted">
                {t('activity.spentLabel')}
              </AppText>
              <Money
                amountMinor={item.expenseMinor}
                currency={settings.currency}
                variant="caption"
                color="textMuted"
              />
            </View>
          ) : null}
        </View>
      </View>

      <Card style={{ paddingVertical: theme.spacing.xs }}>
        {item.transactions.map((tx, idx) => {
          const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
          const catLabel = cat ? cat.name : t('common.uncategorized');
          const subtitleParts = [catLabel];
          if (cat?.archivedAt) subtitleParts.push(t('categories.archivedBadge'));
          if (tx.occurredTime) subtitleParts.push(tx.occurredTime);

          return (
            <View key={tx.id}>
              {idx > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              ) : null}
              <ListRow
                testID={`activity-tx-${tx.id}`}
                title={tx.description || catLabel}
                subtitle={subtitleParts.join(' · ')}
                left={
                  <CategoryIcon
                    icon={cat?.icon}
                    tone={tx.type === 'income' ? 'income' : 'neutral'}
                  />
                }
                right={
                  <Money
                    amountMinor={tx.amountMinor}
                    currency={settings.currency}
                    variant="heading"
                    color={tx.type === 'income' ? 'income' : 'text'}
                    prefix={tx.type === 'income' ? '+' : '-'}
                  />
                }
                onPress={() =>
                  router.push({
                    pathname: '/transaction/[id]',
                    params: { id: tx.id },
                  })
                }
              />
            </View>
          );
        })}
      </Card>
    </View>
  );

  return (
    <Screen contentContainerStyle={{ paddingBottom: 0 }}>
      <View style={[styles.headerRow, { paddingBottom: theme.spacing.md }]}>
        <AppText variant="title">{t('activity.title')}</AppText>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.date}
        renderItem={renderGroup}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl * 3,
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore && !loadingMore) {
            void loadMore();
          }
        }}
        ListFooterComponent={
          hasMore ? (
            <View style={{ paddingTop: theme.spacing.sm }}>
              <Button
                title={t('common.loadMore')}
                variant="secondary"
                loading={loadingMore}
                disabled={loadingMore}
                onPress={() => void loadMore()}
              />
            </View>
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTotals: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalPair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
