import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { summarizeCategoryExpenses } from '@/domain/calc';
import { formatPeriodRange, formatShortDate, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { getPeriod } from '@/domain/period';
import type { Category, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Card } from '@/ui/Card';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';

export default function CategoryPeriodScreen() {
  const { id, periodStart, periodEnd } = useLocalSearchParams<{
    id: string;
    periodStart?: string;
    periodEnd?: string;
  }>();
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const fallbackPeriod = useMemo(
    () => getPeriod(todayLocalDate(), settings.monthStartDay),
    [settings.monthStartDay]
  );

  const rangeStart =
    typeof periodStart === 'string' && isValidLocalDate(periodStart)
      ? periodStart
      : fallbackPeriod.start;
  const rangeEndExcl =
    typeof periodEnd === 'string' && isValidLocalDate(periodEnd) && periodEnd > rangeStart
      ? periodEnd
      : fallbackPeriod.endExcl;

  const categoryId = typeof id === 'string' ? id : 'other';

  const [category, setCategory] = useState<Category | null>(null);
  const [rangeTxs, setRangeTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, txs] = await Promise.all([
          repo.listCategories({ includeArchived: true }),
          repo.listTransactionsInRange(rangeStart, rangeEndExcl),
        ]);
        if (!active) return;
        setCategory(cats.find((c) => c.id === categoryId) ?? null);
        setRangeTxs(txs);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [repo, categoryId, rangeStart, rangeEndExcl, dataVersion]);

  const result = useMemo(
    () =>
      summarizeCategoryExpenses(
        rangeTxs,
        { start: rangeStart, endExcl: rangeEndExcl },
        categoryId,
        settings.currency
      ),
    [rangeTxs, rangeStart, rangeEndExcl, categoryId, settings.currency]
  );

  const titleName = category?.name ?? t('common.uncategorized');

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { minHeight: theme.touch.min, marginBottom: theme.spacing.md }]}>
        <Pressable
          testID="category-detail-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={[
            styles.iconBtn,
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
        <View style={styles.headerCenter}>
          <AppText variant="title" numberOfLines={1}>
            {titleName}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {formatPeriodRange(rangeStart, rangeEndExcl)}
          </AppText>
        </View>
        <View style={{ width: theme.touch.min }} />
      </View>

      <Card style={[styles.summaryCard, { gap: theme.spacing.md, marginBottom: theme.spacing.lg }]}>
        <CategoryIcon icon={category?.icon} tone="primary" />
        <View style={styles.summaryText}>
          <AppText variant="caption" color="textMuted">
            {t('categoryDetail.spentLabel')}
          </AppText>
          <Money amountMinor={result.spentMinor} currency={settings.currency} variant="title" />
        </View>
        <AppText variant="caption" color="textMuted">
          {t('categoryDetail.txCountLabel', { count: result.count })}
        </AppText>
      </Card>

      {!loading && result.transactions.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title={titleName}
          body={t('categoryDetail.empty')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
          <Card style={{ paddingVertical: theme.spacing.xs }}>
            {result.transactions.map((tx, idx) => (
              <View key={tx.id}>
                {idx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                <ListRow
                  title={tx.description || titleName}
                  subtitle={
                    tx.occurredTime
                      ? `${formatShortDate(tx.occurredOn)} · ${tx.occurredTime}`
                      : formatShortDate(tx.occurredOn)
                  }
                  left={<CategoryIcon icon={category?.icon} tone="neutral" />}
                  right={
                    <Money
                      amountMinor={tx.amountMinor}
                      currency={settings.currency}
                      variant="heading"
                      prefix="-"
                    />
                  }
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
});
