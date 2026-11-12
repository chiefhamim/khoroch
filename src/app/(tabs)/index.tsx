import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatUtilizationPct } from '@/domain/calc';
import { formatPeriodRange, formatShortDate, formatWeekdayShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { LocalDate } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useDashboard } from '@/state/useDashboard';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { InfoModal } from '@/ui/InfoModal';
import { ListRow } from '@/ui/ListRow';
import { MetricCard } from '@/ui/MetricCard';
import { Money } from '@/ui/Money';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';
import { SpendingChart } from '@/ui/SpendingChart';

function buildGreeting(hour: number, name: string): string {
  const base =
    hour < 12
      ? t('overview.goodMorning')
      : hour < 17
        ? t('overview.goodAfternoon')
        : t('overview.goodEvening');
  const trimmed = name.trim();
  return trimmed.length > 0 ? `${base}, ${trimmed}` : base;
}

export interface OverviewContentProps {
  todayOverride?: LocalDate;
  hourOverride?: number;
}

export function OverviewContent({ todayOverride, hourOverride }: OverviewContentProps) {
  const { settings } = useAppContext();
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();

  const {
    today,
    period,
    overallBudgetMinor,
    summary,
    categoryBreakdown,
    daily,
    weekly,
    monthly,
    mtdComparison,
    recentTransactions,
    categoriesById,
    loading,
    error,
    reload,
  } = useDashboard(todayOverride);

  const [infoDialog, setInfoDialog] = useState<{ title: string; body: string } | null>(null);

  const hour = hourOverride ?? new Date().getHours();
  const greeting = buildGreeting(hour, settings.name);
  const readableDate = formatWeekdayShortDate(today);

  if (error && !loading) {
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

  const maxCategorySpent = categoryBreakdown[0]?.spentMinor ?? 0;
  const hasAnyPeriodActivity =
    summary.expenseCount > 0 || summary.incomeMinor > 0 || recentTransactions.length > 0;

  const isNegativeRemaining =
    summary.remainingMinor !== null && summary.remainingMinor < 0;

  const topCatName = summary.topCategoryId
    ? (categoriesById.get(summary.topCategoryId)?.name ?? t('common.uncategorized'))
    : null;

  const mtdSummaryText = (() => {
    if (mtdComparison.previousMinor === 0 && mtdComparison.currentMinor === 0) {
      return t('overview.vsLastMonthNoBaseline');
    }
    if (mtdComparison.pctChange === null) {
      return t('overview.vsLastMonthNoBaseline');
    }
    const roundedPct = formatUtilizationPct(Math.abs(mtdComparison.pctChange));
    if (mtdComparison.diffMinor > 0) {
      return t('overview.vsLastMonthUp', {
        pct: roundedPct,
        diff: formatMoney(mtdComparison.diffMinor, settings.currency),
      });
    }
    if (mtdComparison.diffMinor < 0) {
      return t('overview.vsLastMonthDown', {
        pct: roundedPct,
        diff: formatMoney(Math.abs(mtdComparison.diffMinor), settings.currency),
      });
    }
    return t('overview.vsLastMonthSame');
  })();

  return (
    <Screen scroll bottomSpacer>
      {/* Greeting & Date + Settings shortcut */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText variant="title" numberOfLines={1}>
            {greeting}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {readableDate}
          </AppText>
        </View>
        <Pressable
          testID="overview-settings-shortcut"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.settings')}
          onPress={() => router.push('/(tabs)/settings')}
          style={({ pressed }) => [
            styles.settingsBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: pressed && !reducedMotion ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* 1-tap shortcuts: Quick Entry & Daily Check-in */}
      <View style={[styles.quickBar, { gap: theme.spacing.sm }]}>
        <Pressable
          testID="overview-quick-entry-btn"
          accessibilityRole="button"
          accessibilityLabel={t('quickEntry.overviewQuickCta')}
          onPress={() => router.push('/quick-entry')}
          style={({ pressed }) => [
            styles.quickPill,
            {
              minHeight: theme.touch.min,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
              opacity: pressed && !reducedMotion ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
          <AppText variant="label" color="text" numberOfLines={1}>
            {t('quickEntry.overviewQuickCta')}
          </AppText>
        </Pressable>

        <Pressable
          testID="overview-check-in-btn"
          accessibilityRole="button"
          accessibilityLabel={t('quickEntry.overviewCheckInCta')}
          onPress={() => router.push('/check-in')}
          style={({ pressed }) => [
            styles.quickPill,
            {
              minHeight: theme.touch.min,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
              opacity: pressed && !reducedMotion ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="checkmark-done-outline" size={18} color={theme.colors.primary} />
          <AppText variant="label" color="text" numberOfLines={1}>
            {t('quickEntry.overviewCheckInCta')}
          </AppText>
        </Pressable>
      </View>

      {summary.ignoredOtherCurrencyCount > 0 ? (
        <Card tone="alt">
          <AppText variant="caption" color="textMuted">
            {t('overview.ignoredCurrencyBanner', {
              count: summary.ignoredOtherCurrencyCount,
            })}
          </AppText>
        </Card>
      ) : null}

      {/* Hero Monthly Budget Card */}
      <Card testID="overview-budget-card" style={{ gap: theme.spacing.md }}>
        <View style={styles.budgetHeaderRow}>
          <View style={{ gap: 2 }}>
            <AppText variant="label" color="textMuted">
              {t('overview.monthlyBudget')}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {formatPeriodRange(period.start, period.endExcl)}
            </AppText>
          </View>
          <BudgetStatusBadge status={summary.status} />
        </View>

        {overallBudgetMinor !== null && summary.remainingMinor !== null ? (
          <>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" color={isNegativeRemaining ? 'danger' : 'textMuted'}>
                {isNegativeRemaining ? t('overview.overByLabel') : t('overview.remainingLabel')}
              </AppText>
              <Money
                testID="hero-remaining-amount"
                amountMinor={summary.remainingMinor}
                currency={settings.currency}
                variant="display"
                color={isNegativeRemaining ? 'danger' : 'text'}
              />
            </View>

            <ProgressBar pct={summary.utilizationPct} status={summary.status} height={10} />

            <View style={styles.budgetStatsRow}>
              <View style={{ gap: 2 }}>
                <AppText variant="caption" color="textMuted">
                  {t('overview.spentLabel')}
                </AppText>
                <Money amountMinor={summary.spentMinor} currency={settings.currency} variant="heading" />
              </View>
              <View style={{ gap: 2, alignItems: 'center' }}>
                <AppText variant="caption" color="textMuted">
                  {t('budget.title')}
                </AppText>
                <Money amountMinor={overallBudgetMinor} currency={settings.currency} variant="heading" />
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <AppText variant="caption" color="textMuted">
                  {summary.utilizationPct !== null
                    ? t('overview.usedPct', {
                        pct: formatUtilizationPct(summary.utilizationPct),
                      })
                    : ''}
                </AppText>
                <Pressable
                  testID="overview-edit-budget-link"
                  accessibilityRole="button"
                  accessibilityLabel={t('overview.editBudgetCta')}
                  onPress={() => router.push('/(tabs)/budget')}
                  style={{ minHeight: 24, justifyContent: 'center' }}
                >
                  <AppText variant="label" color="primary">
                    {t('overview.editBudgetCta')}
                  </AppText>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="title">{t('overview.noBudgetSet')}</AppText>
            <AppText variant="body" color="textMuted">
              {t('overview.noBudgetHint')}
            </AppText>
            <Button
              testID="overview-set-budget-button"
              title={t('overview.setBudgetCta')}
              variant="secondary"
              onPress={() => router.push('/(tabs)/budget')}
            />
          </View>
        )}

        <AppText variant="caption" color="textMuted">
          {t('overview.budgetPlanNote')}
        </AppText>
      </Card>

      {/* 4 Financial Summary Cards */}
      <View style={{ gap: theme.spacing.md }}>
        <View style={[styles.metricsRow, { gap: theme.spacing.md }]}>
          <MetricCard
            testID="metric-daily-avg"
            label={t('overview.metricAvgDaily')}
            amountMinor={summary.dailyAverageMinor}
            currency={settings.currency}
            onInfoPress={() =>
              setInfoDialog({
                title: t('overview.metricAvgDaily'),
                body: t('overview.metricAvgDailyInfo'),
              })
            }
          />
          <MetricCard
            testID="metric-safe-per-day"
            label={t('overview.metricSafePerDay')}
            amountMinor={summary.safeToSpendPerDayMinor}
            currency={settings.currency}
            fallbackText={t('overview.metricNotAvailable')}
            valueColor={summary.status === 'over' ? 'danger' : 'primary'}
            onInfoPress={() =>
              setInfoDialog({
                title: t('overview.metricSafePerDay'),
                body: t('overview.metricSafePerDayInfo'),
              })
            }
          />
        </View>

        <View style={[styles.metricsRow, { gap: theme.spacing.md }]}>
          <MetricCard
            testID="metric-income-month"
            label={t('overview.metricIncomeMonth')}
            amountMinor={summary.incomeMinor}
            currency={settings.currency}
            valueColor="income"
            onInfoPress={() =>
              setInfoDialog({
                title: t('overview.metricIncomeMonth'),
                body: t('overview.metricIncomeMonthInfo'),
              })
            }
          />
          <MetricCard
            testID="metric-expense-month"
            label={t('overview.metricExpenseMonth')}
            amountMinor={summary.spentMinor}
            currency={settings.currency}
            onInfoPress={() =>
              setInfoDialog({
                title: t('overview.metricExpenseMonth'),
                body: t('overview.metricExpenseMonthInfo'),
              })
            }
          />
        </View>
      </View>

      {!hasAnyPeriodActivity && !loading ? (
        <EmptyState
          icon="wallet-outline"
          title={t('empty.overviewTitle')}
          body={t('empty.overviewBody')}
          ctaLabel={t('empty.overviewCta')}
          onCtaPress={() => router.push('/transaction/new')}
        />
      ) : (
        <>
          {/* Interactive SVG Spending Chart */}
          <SpendingChart
            currency={settings.currency}
            daily={daily}
            weekly={weekly}
            monthly={monthly}
          />

          {/* Category Breakdown */}
          <SectionHeader title={t('overview.breakdownTitle')} />
          <Card style={{ gap: theme.spacing.md }}>
            {categoryBreakdown.length === 0 ? (
              <AppText variant="body" color="textMuted">
                {t('overview.breakdownEmpty')}
              </AppText>
            ) : (
              categoryBreakdown.map((slice, idx) => {
                const cat = slice.categoryId ? categoriesById.get(slice.categoryId) : undefined;
                const label = slice.isOtherGroup
                  ? t('overview.breakdownOtherGroup')
                  : (cat?.name ?? t('common.uncategorized'));
                const barRatio =
                  maxCategorySpent > 0 ? Math.min(100, (slice.spentMinor / maxCategorySpent) * 100) : 0;

                return (
                  <Pressable
                    key={slice.categoryId ?? 'other-group'}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => {
                      if (slice.isOtherGroup || !slice.categoryId) {
                        router.push('/(tabs)/activity');
                      } else {
                        router.push({
                          pathname: '/category/[id]',
                          params: {
                            id: slice.categoryId,
                            periodStart: period.start,
                            periodEnd: period.endExcl,
                          },
                        });
                      }
                    }}
                    style={({ pressed }) => ({
                      gap: theme.spacing.xs,
                      paddingTop: idx > 0 ? theme.spacing.xs : 0,
                      opacity: pressed && !reducedMotion ? 0.75 : 1,
                    })}
                  >
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownLeft, { gap: theme.spacing.sm }]}>
                        <CategoryIcon
                          icon={slice.isOtherGroup ? 'ellipsis-horizontal' : cat?.icon}
                          size="sm"
                          tone="primary"
                        />
                        <AppText variant="body" numberOfLines={1} style={styles.flexOne}>
                          {label}
                        </AppText>
                      </View>
                      <View style={[styles.breakdownRight, { gap: theme.spacing.sm }]}>
                        <AppText variant="caption" color="textMuted" tabularNums>
                          {formatUtilizationPct(slice.sharePct)}
                        </AppText>
                        <Money
                          amountMinor={slice.spentMinor}
                          currency={settings.currency}
                          variant="heading"
                        />
                      </View>
                    </View>
                    <ProgressBar pct={barRatio} status="ok" height={6} />
                  </Pressable>
                );
              })
            )}
          </Card>

          {/* Recent Activity (latest 5) */}
          <SectionHeader
            title={t('overview.recentTitle')}
            actionLabel={t('overview.viewAll')}
            onActionPress={() => router.push('/(tabs)/activity')}
          />
          <Card style={{ paddingVertical: theme.spacing.xs }}>
            {recentTransactions.map((tx, idx) => {
              const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
              const catLabel = cat?.name ?? t('common.uncategorized');
              return (
                <View key={tx.id}>
                  {idx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                  <ListRow
                    title={tx.description || catLabel}
                    subtitle={
                      tx.occurredTime
                        ? `${catLabel} · ${formatShortDate(tx.occurredOn)} · ${tx.occurredTime}`
                        : `${catLabel} · ${formatShortDate(tx.occurredOn)}`
                    }
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
                      router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                    }
                  />
                </View>
              );
            })}
          </Card>

          {/* Financial Highlights */}
          <SectionHeader title={t('overview.highlightsTitle')} />
          <Card style={{ gap: theme.spacing.md }}>
            <View style={styles.highlightRow}>
              <AppText variant="label" color="textMuted">
                {t('overview.highlightTopCategory')}
              </AppText>
              <AppText variant="body">{topCatName ?? t('overview.highlightNone')}</AppText>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <View style={styles.highlightRow}>
              <AppText variant="label" color="textMuted">
                {t('overview.highlightLargestExpense')}
              </AppText>
              <AppText variant="body" tabularNums>
                {summary.largestExpense
                  ? `${formatMoney(summary.largestExpense.amountMinor, settings.currency)}${
                      summary.largestExpense.description
                        ? ` · ${summary.largestExpense.description}`
                        : ''
                    }`
                  : t('overview.highlightNone')}
              </AppText>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <View style={styles.highlightRow}>
              <AppText variant="label" color="textMuted">
                {t('overview.highlightTxCount')}
              </AppText>
              <AppText variant="body" tabularNums>
                {summary.expenseCount}
              </AppText>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <View style={styles.highlightRow}>
              <AppText variant="label" color="textMuted">
                {t('overview.highlightVsLastMonth')}
              </AppText>
              <AppText variant="body" numberOfLines={2} style={styles.highlightValRight}>
                {mtdSummaryText}
              </AppText>
            </View>
          </Card>
        </>
      )}

      <InfoModal
        visible={infoDialog !== null}
        title={infoDialog?.title ?? ''}
        body={infoDialog?.body ?? ''}
        onClose={() => setInfoDialog(null)}
      />
    </Screen>
  );
}

export default function OverviewScreen() {
  return <OverviewContent />;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  settingsBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  metricsRow: {
    flexDirection: 'row',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  breakdownLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexOne: {
    flex: 1,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  highlightValRight: {
    flexShrink: 1,
    textAlign: 'right',
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
