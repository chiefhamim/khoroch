import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { epochMsToLocalDate, isBackupDue } from '@/data/backup';
import { formatUtilizationPct } from '@/domain/calc';
import {
  formatFriendlyDate,
  formatFriendlyTime,
  formatShortDate,
  formatWeekdayShortDate,
  isDevice24HourClock,
} from '@/domain/dates';
import {
  formatMoney,
  HIDDEN_AMOUNT_TEXT,
  MISSING_METRIC_DASH,
} from '@/domain/money';
import { remainingDays } from '@/domain/period';
import { formatHomeDuesSummaryLine } from '@/domain/dues';
import type { LocalDate } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { useAccounts } from '@/state/useAccounts';
import { useDashboard } from '@/state/useDashboard';
import { usePeople } from '@/state/usePeople';
import { getCategoryTileVisual } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { HeroCard, HeroProgressBar } from '@/ui/HeroCard';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { SpendingChart, type ChartGranularity } from '@/ui/SpendingChart';
import { Surface } from '@/ui/Surface';
import { WalletAvatar } from '@/ui/WalletAvatar';

function buildGreeting(hour: number): string {
  if (hour < 12) return t('overview.goodMorning');
  if (hour < 17) return t('overview.goodAfternoon');
  return t('overview.goodEvening');
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
    previousCycleSpentMinor,
    showNewCycleHint,
    categoryBreakdown,
    daily,
    weekly,
    monthly,
    recentTransactions,
    categoriesById,
    loading,
    error,
    reload,
  } = useDashboard(todayOverride);

  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('daily');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const { hideAmounts, toggleHideAmounts } = usePrivacyStore();
  const {
    overview: accountsOverview,
    accountsById,
    loading: accountsLoading,
  } = useAccounts(today);
  const hasWallets = accountsOverview.balances.length > 0;
  const { overview: duesOverview } = usePeople();
  const duesSummaryLine = formatHomeDuesSummaryLine(duesOverview, settings.currency);

  const hour = hourOverride ?? new Date().getHours();
  const greeting = buildGreeting(hour);
  const trimmedName = settings.name.trim();
  const avatarInitial = trimmedName.length > 0 ? trimmedName[0].toUpperCase() : 'Y';
  const readableDate = formatWeekdayShortDate(today);
  const subtitleLine =
    trimmedName.length > 0 ? `${trimmedName} · ${readableDate}` : readableDate;
  const use24Hour = isDevice24HourClock();

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

  const topSlices = categoryBreakdown.slice(0, 4);
  const maxCategorySpent = topSlices[0]?.spentMinor ?? 0;
  const remainingDaysCount = remainingDays(period, today);
  const isNegativeRemaining =
    summary.remainingMinor !== null && summary.remainingMinor < 0;

  return (
    <Screen scroll bottomSpacer>
      {/* Header: Greeting, date & circular settings avatar */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText variant="title" numberOfLines={1}>
            {greeting}
          </AppText>
          <AppText variant="label" color="textSecondary" numberOfLines={1}>
            {subtitleLine}
          </AppText>
        </View>
        <Pressable
          testID="overview-settings-shortcut"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.settings')}
          hitSlop={6}
          onPress={() => router.push('/settings' as never)}
          style={({ pressed }) => [
            styles.avatarBtn,
            {
              backgroundColor: theme.colors.accentSoft,
              transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <AppText
            variant="bodyStrong"
            style={{ color: theme.colors.accent, fontWeight: '600' }}
          >
            {avatarInitial}
          </AppText>
        </Pressable>
      </View>

      {summary.ignoredOtherCurrencyCount > 0 ? (
        <Banner
          tone="neutral"
          icon="info"
          message={t('overview.ignoredCurrencyBanner', {
            count: summary.ignoredOtherCurrencyCount,
          })}
        />
      ) : null}

      {/* Hero summary / budget card */}
      <HeroCard
        testID="overview-budget-card"
        onPress={toggleHideAmounts}
        accessibilityLabel={hideAmounts ? t('overview.amountsHiddenLabel') : t('overview.tapToHideHint')}
        accessibilityHint={hideAmounts ? t('overview.tapToShowHint') : t('overview.tapToHideHint')}
        style={{ gap: theme.spacing.md }}
      >
        {hasWallets ? (
          <>
            <View style={styles.heroTopRow}>
              <AppText variant="label" color="heroTextSecondary">
                {hideAmounts
                  ? t('overview.tapToShowHint')
                  : t('overview.acrossWallets', { count: accountsOverview.includedCount })}
              </AppText>
              <View style={[styles.heroTopRight, { gap: theme.spacing.xs }]}>
                {overallBudgetMinor !== null ? (
                  <BudgetStatusBadge status={summary.status} surface="hero" />
                ) : null}
                <IconButton
                  testID="overview-hero-menu"
                  icon="info"
                  variant="ghost"
                  iconColor={theme.colors.heroTextSecondary}
                  size={30}
                  iconSize={18}
                  accessibilityLabel={t('overview.howNumbersWork')}
                  onPress={() => setHowItWorksOpen(true)}
                />
              </View>
            </View>

            <Money
              testID="hero-wallets-total"
              variant="hero"
              amountMinor={Math.abs(accountsOverview.totalMinor)}
              prefix={accountsOverview.totalMinor < 0 ? '−' : ''}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            <View style={[styles.divider, { backgroundColor: theme.colors.heroLine }]} />

            <View style={[styles.stripRow, { gap: theme.spacing.sm }]}>
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.inThisCycle')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  amountMinor={summary.incomeMinor}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.outThisCycle')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  amountMinor={summary.spentMinor}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
            </View>

            {overallBudgetMinor !== null && summary.remainingMinor !== null ? (
              <>
                <View style={[styles.heroSubRow, { gap: theme.spacing.sm }]}>
                  <AppText variant="label" color="heroTextSecondary" tabularNums>
                    {t('overview.usedPct', {
                      pct: formatUtilizationPct(summary.utilizationPct ?? 0),
                    })}
                  </AppText>
                  <AppText variant="label" color="heroTextSecondary" tabularNums>
                    {hideAmounts
                      ? HIDDEN_AMOUNT_TEXT
                      : summary.safeToSpendPerDayMinor !== null
                        ? `${formatMoney(summary.safeToSpendPerDayMinor, settings.currency)} / day`
                        : MISSING_METRIC_DASH}
                  </AppText>
                </View>
                <HeroProgressBar pct={summary.utilizationPct} />
              </>
            ) : null}
          </>
        ) : overallBudgetMinor !== null && summary.remainingMinor !== null ? (
          <>
            <View style={styles.heroTopRow}>
              <AppText variant="label" color="heroTextSecondary">
                {isNegativeRemaining
                  ? t('overview.overByHero')
                  : t('overview.leftToSpend')}
              </AppText>
              <View style={[styles.heroTopRight, { gap: theme.spacing.xs }]}>
                <BudgetStatusBadge status={summary.status} surface="hero" />
                <IconButton
                  testID="overview-hero-menu"
                  icon="info"
                  variant="ghost"
                  iconColor={theme.colors.heroTextSecondary}
                  size={30}
                  iconSize={18}
                  accessibilityLabel={t('overview.howNumbersWork')}
                  onPress={() => setHowItWorksOpen(true)}
                />
              </View>
            </View>

            <Money
              testID="hero-remaining-amount"
              variant="hero"
              amountMinor={Math.abs(summary.remainingMinor)}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            <View style={[styles.heroSubRow, { gap: theme.spacing.sm }]}>
              <AppText
                variant="label"
                color="heroTextSecondary"
                style={styles.flexOne}
                numberOfLines={1}
              >
                {hideAmounts
                  ? t('overview.tapToShowHint')
                  : t('overview.ofBudgetDaysLeft', {
                      budget: formatMoney(overallBudgetMinor, settings.currency),
                      days: remainingDaysCount,
                    })}
              </AppText>
              <AppText variant="label" color="heroTextSecondary" tabularNums>
                {t('overview.usedPct', {
                  pct: formatUtilizationPct(summary.utilizationPct ?? 0),
                })}
              </AppText>
            </View>

            <HeroProgressBar pct={summary.utilizationPct} />

            <View style={[styles.divider, { backgroundColor: theme.colors.heroLine }]} />

            <View style={[styles.stripRow, { gap: theme.spacing.sm }]}>
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.safeToday')}
                </AppText>
                {summary.safeToSpendPerDayMinor !== null ? (
                  <Money
                    variant="bodyStrong"
                    amountMinor={summary.safeToSpendPerDayMinor}
                    currency={settings.currency}
                    color="heroText"
                    hidden={hideAmounts}
                  />
                ) : (
                  <View>
                    <AppText variant="bodyStrong" color="heroText">
                      {MISSING_METRIC_DASH}
                    </AppText>
                    <AppText variant="tab" color="heroTextSecondary">
                      {remainingDaysCount <= 0 ? 'Cycle ended' : 'No budget'}
                    </AppText>
                  </View>
                )}
              </View>
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.spentShort')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  amountMinor={summary.spentMinor}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.incomeShort')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  amountMinor={summary.incomeMinor}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.heroTopRow}>
              <AppText variant="label" color="heroTextSecondary">
                {t('overview.spentThisCycle')}
              </AppText>
              <IconButton
                testID="overview-hero-menu"
                icon="info"
                variant="ghost"
                iconColor={theme.colors.heroTextSecondary}
                size={30}
                iconSize={18}
                accessibilityLabel={t('overview.howNumbersWork')}
                onPress={() => setHowItWorksOpen(true)}
              />
            </View>

            <Money
              testID="hero-spent-no-budget"
              variant="hero"
              amountMinor={summary.spentMinor}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            <View style={[styles.divider, { backgroundColor: theme.colors.heroLine }]} />

            <Pressable
              testID="overview-set-budget-inline"
              accessibilityRole="button"
              accessibilityLabel={t('overview.setBudgetCta')}
              onPress={() => router.push('/(tabs)/plan' as never)}
              style={({ pressed }) => [
                styles.noBudgetRow,
                {
                  gap: theme.spacing.sm,
                  opacity: pressed && !reducedMotion ? 0.7 : 1,
                },
              ]}
            >
              <AppText variant="label" color="heroTextSecondary" style={styles.flexOne}>
                {t('overview.noBudgetInline')}
              </AppText>
              <AppText variant="label" color="heroBar" style={styles.semiBold}>
                {t('overview.setBudgetCta')}
              </AppText>
              <AppIcon name="chevron-right" size={16} color={theme.colors.heroBar} />
            </Pressable>
          </>
        )}
      </HeroCard>

      {/* New-cycle hint banner */}
      {showNewCycleHint ? (
        <Banner
          testID="overview-new-cycle-banner"
          icon="repeat"
          tone="accent"
          showChevron
          message={t('overview.newCycleBanner', {
            startDate: formatShortDate(period.start),
            amount: formatMoney(previousCycleSpentMinor, settings.currency),
          })}
          onPress={() =>
            router.push({
              pathname: '/plan/insights',
              params: { preset: 'last_month' },
            } as never)
          }
        />
      ) : null}

      {/* Monthly backup reminder nudge */}
      {(summary.expenseCount > 0 ||
        summary.incomeMinor > 0 ||
        recentTransactions.length > 0) &&
      isBackupDue(settings.lastBackupAt) ? (
        <Banner
          testID="overview-backup-nudge"
          icon="shield-check"
          tone="neutral"
          showChevron
          message={
            settings.lastBackupAt === null
              ? t('overview.backupNudgeNever')
              : t('overview.backupNudgeDated', {
                  date: formatShortDate(epochMsToLocalDate(settings.lastBackupAt)),
                })
          }
          accessibilityLabel={t('overview.backupNudgeA11y')}
          onPress={() => router.push('/settings?openBackup=1' as never)}
        />
      ) : null}

      {/* Two 50/50 secondary actions */}
      <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
        <Button
          testID="overview-quick-entry-btn"
          variant="secondary"
          size="sm"
          leftIcon="sparkles"
          title={t('quickEntry.overviewQuickCta')}
          onPress={() => router.push('/quick-entry')}
          style={styles.flexOne}
        />
        <Button
          testID="overview-check-in-btn"
          variant="secondary"
          size="sm"
          leftIcon="circle-check"
          title={t('overview.checkInShort')}
          onPress={() => router.push('/check-in')}
          style={styles.flexOne}
        />
      </View>

      {/* Wallets list OR "Set up your wallets" prompt */}
      {hasWallets ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.sectionRow}>
            <AppText variant="headline">{t('overview.walletsHeading')}</AppText>
            <Pressable
              testID="overview-manage-wallets"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/wallets' as never)}
            >
              <AppText variant="label" color="accent" style={styles.semiBold}>
                {t('overview.manageWallets')}
              </AppText>
            </Pressable>
          </View>

          <Surface testID="overview-wallets-list" padded={false}>
            {accountsOverview.balances.map((entry, idx) => {
              const acc = entry.account;
              const metaParts: string[] = [];
              if (acc.last4) metaParts.push(`Ending ${acc.last4}`);
              if (!acc.includeInTotal) metaParts.push(t('wallets.excludedBadge'));
              const subtitle = metaParts.length > 0 ? metaParts.join(' · ') : undefined;

              return (
                <ListRow
                  key={acc.id}
                  testID={`overview-wallet-row-${acc.id}`}
                  title={acc.name}
                  subtitle={subtitle}
                  left={<WalletAvatar account={acc} size="sm" />}
                  right={
                    hideAmounts ? (
                      <AppText variant="bodyStrong" color="textSecondary" tabularNums>
                        {HIDDEN_AMOUNT_TEXT}
                      </AppText>
                    ) : entry.isDue ? (
                      <Text accessibilityLabel={entry.formattedBalance}>
                        <Money
                          variant="bodyStrong"
                          amountMinor={Math.abs(entry.balanceMinor)}
                          currency={settings.currency}
                          color="danger"
                        />
                        <Text
                          style={[
                            theme.typography.bodyStrong,
                            { color: theme.colors.danger },
                          ]}
                        >
                          {' due'}
                        </Text>
                      </Text>
                    ) : (
                      <Money
                        variant="bodyStrong"
                        amountMinor={Math.abs(entry.balanceMinor)}
                        prefix={entry.balanceMinor < 0 ? '−' : ''}
                        currency={settings.currency}
                        color="text"
                      />
                    )
                  }
                  showDivider={idx < accountsOverview.balances.length - 1}
                  onPress={() => router.push(`/wallets/${acc.id}` as never)}
                />
              );
            })}
          </Surface>
        </View>
      ) : !accountsLoading ? (
        <Surface
          testID="overview-setup-wallets-card"
          padded={false}
          onPress={() => router.push('/wallets?setup=1' as never)}
          accessibilityLabel={t('overview.setupWalletsTitle')}
        >
          <ListRow
            title={t('overview.setupWalletsTitle')}
            subtitle={t('overview.setupWalletsBody')}
            left={<WalletAvatar account={null} size="sm" />}
            showChevron
          />
        </Surface>
      ) : null}

      {/* People & dues compact summary strip */}
      {duesSummaryLine ? (
        <Surface
          testID="overview-dues-card"
          padded={false}
          onPress={() => router.push('/(tabs)/people' as never)}
          accessibilityLabel={`${t('overview.duesTitle')}: ${hideAmounts ? HIDDEN_AMOUNT_TEXT : duesSummaryLine}`}
        >
          <ListRow
            title={hideAmounts ? HIDDEN_AMOUNT_TEXT : duesSummaryLine}
            subtitle={t('overview.duesTitle')}
            left={<IconTile icon="users" colorKey="teal" size="sm" />}
            showChevron
          />
        </Surface>
      ) : null}

      {/* Spending chart + inline Day | Week | Month switcher */}
      <View style={{ gap: theme.spacing.sm }}>
        <View style={[styles.sectionRow, { gap: theme.spacing.sm }]}>
          <AppText variant="headline">{t('overview.spendingTitle')}</AppText>
          <SegmentedControl<ChartGranularity>
            testID="overview-chart-granularity"
            size="sm"
            value={chartGranularity}
            onChange={setChartGranularity}
            options={[
              { value: 'daily', label: t('overview.chartDaily') },
              { value: 'weekly', label: t('overview.chartWeekly') },
              { value: 'monthly', label: t('overview.chartMonthly') },
            ]}
          />
        </View>
        <SpendingChart
          currency={settings.currency}
          daily={daily}
          weekly={weekly}
          monthly={monthly}
          today={today}
          granularity={chartGranularity}
          onGranularityChange={setChartGranularity}
          showHeader={false}
        />
      </View>

      {/* Top categories */}
      {topSlices.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.sectionRow}>
            <AppText variant="headline">{t('overview.topCategoriesTitle')}</AppText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/plan/insights' as never)}
            >
              <AppText variant="label" color="accent">
                {t('overview.seeAll')}
              </AppText>
            </Pressable>
          </View>

          <Surface padded={false}>
            {topSlices.map((slice, idx) => {
              const sliceCatId = slice.categoryId;
              const cat =
                !slice.isOtherGroup && sliceCatId
                  ? categoriesById.get(sliceCatId)
                  : undefined;
              const catName = slice.isOtherGroup
                ? t('overview.breakdownOtherGroup')
                : (cat?.name ?? t('common.uncategorized'));
              const barColor = getCategoryTileVisual(
                cat?.colorKey ?? 'gray',
                theme.scheme
              ).fg;
              const barPct =
                maxCategorySpent > 0
                  ? Math.max(4, Math.min(100, (slice.spentMinor / maxCategorySpent) * 100))
                  : 0;

              return (
                <View key={slice.isOtherGroup || !sliceCatId ? '__other__' : sliceCatId}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${catName}: ${formatMoney(slice.spentMinor, settings.currency)}`}
                    onPress={() => {
                      if (slice.isOtherGroup || !sliceCatId) {
                        router.push('/plan/insights' as never);
                      } else {
                        router.push({
                          pathname: '/category/[id]',
                          params: { id: sliceCatId },
                        });
                      }
                    }}
                    style={({ pressed }) => [
                      styles.topCatRow,
                      {
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.md,
                        gap: theme.spacing.md,
                        opacity: pressed && !reducedMotion ? 0.72 : 1,
                      },
                    ]}
                  >
                    <IconTile
                      icon={cat?.icon ?? 'shapes'}
                      colorKey={cat?.colorKey ?? 'gray'}
                      size="sm"
                    />
                    <View style={[styles.flexOne, { gap: theme.spacing.xs + 2 }]}>
                      <View style={[styles.topCatHeader, { gap: theme.spacing.sm }]}>
                        <AppText
                          variant="bodyStrong"
                          style={styles.flexOne}
                          numberOfLines={1}
                        >
                          {catName}
                        </AppText>
                        <AppText variant="caption" color="textSecondary" tabularNums>
                          {formatUtilizationPct(slice.sharePct)}
                        </AppText>
                        <Money
                          variant="bodyStrong"
                          amountMinor={slice.spentMinor}
                          currency={settings.currency}
                        />
                      </View>
                      <View
                        style={[
                          styles.topCatTrack,
                          { backgroundColor: theme.colors.surfaceSunken },
                        ]}
                      >
                        <View
                          style={[
                            styles.topCatFill,
                            { width: `${barPct}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                    </View>
                  </Pressable>
                  {idx < topSlices.length - 1 ? (
                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor: theme.colors.separator,
                          marginLeft: 64,
                          marginRight: theme.spacing.lg,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </Surface>
        </View>
      ) : null}

      {/* Recent transactions */}
      <View style={{ gap: theme.spacing.sm }}>
        <View style={styles.sectionRow}>
          <AppText variant="headline">{t('overview.recentTitle')}</AppText>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/(tabs)/ledger' as never)}
          >
            <AppText variant="label" color="accent">
              {t('overview.seeAll')}
            </AppText>
          </Pressable>
        </View>

        {recentTransactions.length === 0 ? (
          <Surface>
            <EmptyState
              icon="list"
              title={t('overview.noRecentTitle')}
              body={t('overview.noRecentBody')}
            />
          </Surface>
        ) : (
          <Surface padded={false}>
            {recentTransactions.map((tx, idx) => {
              const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
              const catName = cat?.name ?? t('common.uncategorized');
              const wallet = tx.accountId ? accountsById.get(tx.accountId) : undefined;
              const isIncome = tx.type === 'income';
              const whenLabel = tx.occurredTime
                ? formatFriendlyTime(tx.occurredTime, use24Hour)
                : formatFriendlyDate(tx.occurredOn, today);
              const subtitleParts = [catName];
              if (wallet) subtitleParts.push(wallet.name);
              subtitleParts.push(whenLabel);

              return (
                <ListRow
                  key={tx.id}
                  left={
                    <IconTile
                      icon={cat?.icon ?? 'shapes'}
                      colorKey={cat?.colorKey ?? 'gray'}
                      size="md"
                    />
                  }
                  title={tx.description.trim() || catName}
                  subtitle={subtitleParts.join(' · ')}
                  right={
                    <Money
                      variant="bodyStrong"
                      prefix={isIncome ? '+' : '−'}
                      amountMinor={tx.amountMinor}
                      currency={tx.currency}
                      color={isIncome ? 'accent' : 'text'}
                      hidden={hideAmounts}
                    />
                  }
                  showDivider={idx < recentTransactions.length - 1}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                />
              );
            })}
          </Surface>
        )}
      </View>

      {/* "How these numbers work" bottom sheet */}
      <Sheet
        visible={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        title={t('overview.howNumbersWork')}
      >
        <AppText variant="body" color="textSecondary">
          {t('overview.howNumbersWorkIntro')}
        </AppText>
        <Surface variant="sunken" style={{ gap: theme.spacing.sm }}>
          <View style={styles.explainItem}>
            <AppText variant="bodyStrong">{t('overview.safeToday')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('overview.metricSafePerDayInfo')}
            </AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
          <View style={styles.explainItem}>
            <AppText variant="bodyStrong">{t('overview.spentShort')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('overview.metricExpenseMonthInfo')}
            </AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
          <View style={styles.explainItem}>
            <AppText variant="bodyStrong">{t('overview.incomeShort')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('overview.metricIncomeMonthInfo')}
            </AppText>
          </View>
        </Surface>
        <AppText variant="caption" color="textSecondary">
          {t('overview.budgetPlanNote')}
        </AppText>
        <Button
          title={t('overview.gotIt')}
          onPress={() => setHowItWorksOpen(false)}
        />
      </Sheet>
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
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stripCol: {
    flex: 1,
    gap: 2,
  },
  noBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  semiBold: {
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topCatTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  topCatFill: {
    height: 4,
    borderRadius: 999,
  },
  explainItem: {
    gap: 2,
  },
  flexOne: {
    flex: 1,
  },
});
