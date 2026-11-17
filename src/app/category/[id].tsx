import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { summarizeCategoryExpenses } from '@/domain/calc';
import {
  formatFriendlyTime,
  formatPeriodRange,
  formatShortDate,
  isDevice24HourClock,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import { getSpendingPeriod } from '@/domain/period';
import { normalizePeriodWeekStartDay, type Category, type Transaction } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { Surface } from '@/ui/Surface';

export default function CategoryPeriodScreen() {
  const { id, periodStart, periodEnd } = useLocalSearchParams<{
    id: string;
    periodStart?: string;
    periodEnd?: string;
  }>();
  const { repo, settings } = useAppContext();
  const locale = useLocale();
  const { theme } = useTheme();
  const router = useRouter();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const use24Hour = isDevice24HourClock();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // The spending period: the current week in weekly mode, otherwise the monthly cycle.
  const fallbackPeriod = useMemo(
    () =>
      getSpendingPeriod(todayLocalDate(), {
        periodKind: settings.periodKind === 'week' ? 'week' : 'month',
        weekStartDay: normalizePeriodWeekStartDay(settings.weekStartDay),
        monthStartDay: settings.monthStartDay,
      }),
    [settings.periodKind, settings.weekStartDay, settings.monthStartDay]
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
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cats, txs] = await Promise.all([
          repo.listCategories({ includeArchived: true }),
          repo.listTransactionsInRange(rangeStart, rangeEndExcl),
        ]);
        if (!active) return;
        setLoadError(false);
        setCategory(cats.find((c) => c.id === categoryId) ?? null);
        setRangeTxs(txs);
      } catch {
        if (!active) return;
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [repo, categoryId, rangeStart, rangeEndExcl, dataVersion, reloadTick]);

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
  const rangeLabel = formatPeriodRange(rangeStart, rangeEndExcl, locale);
  const txCountText = t('categoryDetail.txCountLabel', { count: result.count });

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { gap: theme.spacing.md, marginBottom: theme.spacing.md }]}>
        <IconButton
          testID="category-detail-back"
          icon="arrow-left"
          variant="surface"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
        />
        <View style={styles.headerCenter}>
          <AppText variant="title" numberOfLines={1}>
            {titleName}
          </AppText>
          <AppText
            variant="caption"
            color="textSecondary"
            numberOfLines={1}
            style={locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(rangeLabel, 12) } : null}
          >
            {rangeLabel}
          </AppText>
        </View>
        <View style={{ width: theme.touch.min }} />
      </View>

      <Surface style={[styles.summaryCard, { gap: theme.spacing.md, marginBottom: theme.spacing.lg }]}>
        <IconTile
          icon={category?.icon ?? 'shapes'}
          colorKey={category?.colorKey ?? 'gray'}
          size="lg"
        />
        <View style={styles.summaryText}>
          <AppText variant="caption" color="textSecondary">
            {t('categoryDetail.spentLabel')}
          </AppText>
          <Money amountMinor={result.spentMinor} currency={settings.currency} variant="title" />
        </View>
        <AppText
          variant="label"
          color="textSecondary"
          numberOfLines={1}
          style={[
            styles.countBadge,
            locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(txCountText, 13) } : null,
          ]}
        >
          {txCountText}
        </AppText>
      </Surface>

      {loadError ? (
        <ErrorState
          title={t('error.genericTitle')}
          body={t('categoryDetail.loadError')}
          retryLabel={t('common.retry')}
          onRetry={() => setReloadTick((v) => v + 1)}
        />
      ) : !loading && result.transactions.length === 0 ? (
        <EmptyState
          icon="receipt-text"
          title={titleName}
          body={t('categoryDetail.empty')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
          <Surface padded={false}>
            {result.transactions.map((tx, idx) => (
              <ListRow
                key={tx.id}
                title={tx.description.trim() || titleName}
                subtitle={
                  tx.occurredTime
                    ? `${formatShortDate(tx.occurredOn, locale)} · ${formatFriendlyTime(tx.occurredTime, use24Hour)}`
                    : formatShortDate(tx.occurredOn, locale)
                }
                showDivider={idx < result.transactions.length - 1}
                left={
                  <IconTile
                    icon={category?.icon ?? 'shapes'}
                    colorKey={category?.colorKey ?? 'gray'}
                    size="md"
                  />
                }
                right={
                  <Money
                    amountMinor={tx.amountMinor}
                    currency={settings.currency}
                    variant="bodyStrong"
                    prefix="−"
                  />
                }
                showChevron
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
              />
            ))}
          </Surface>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  countBadge: {
    textAlign: 'right',
  },
});
