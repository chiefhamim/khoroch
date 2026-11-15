import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { epochMsToLocalDate, isBackupDue } from '@/data/backup';
import { resolveWalletColorHex } from '@/domain/accounts';
import { formatUtilizationPct } from '@/domain/calc';
import {
  addDays,
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
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { usePrivacyStore } from '@/state/privacyStore';
import { useAccounts } from '@/state/useAccounts';
import { useDashboard } from '@/state/useDashboard';
import { usePeople } from '@/state/usePeople';
import { getCategoryTileVisual } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { HeroCard, HeroProgressBar } from '@/ui/HeroCard';
import { HeroSwap } from '@/ui/HeroSwap';
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
import { ProfileAvatar } from '@/ui/ProfileAvatar';
import { PressableScale } from '@/ui/PressableScale';

const OVERVIEW_FALLBACKS: Record<string, string> = {
  'overview.heroTabBudget': 'Budget plan',
  'overview.heroTabWallets': 'Wallets',
  'overview.todayDaybookHeader': 'Today’s Daybook · {date}',
  'overview.quickEntryAction': '+ Quick entry',
  'overview.nothingWrittenToday': 'Nothing written for today',
  'overview.nothingWrittenSub': 'Tap + below or say "350 taka lunch"',
  'overview.walletsNetHeader': 'Wallets · {amount} net',
  'overview.spendingPulseTitle': 'Spending pulse',
};

function tr(key: string, params?: Record<string, string | number>): string {
  const val = t(key as Parameters<typeof t>[0], params);
  if (val !== key) return val;
  let template = OVERVIEW_FALLBACKS[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return template;
}

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
  const { settings, repo } = useAppContext();
  const locale = useLocale();
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
  const [userHeroMode, setUserHeroMode] = useState<'budget' | 'wallets' | null>(null);

  const { hideAmounts, toggleHideAmounts } = usePrivacyStore();
  const {
    overview: accountsOverview,
    accountsById,
    allAccounts,
    predated,
    loading: accountsLoading,
  } = useAccounts(today);
  const countEarlierEntries = async () => {
    if (predated.earliest === null) return;
    const earliest = predated.earliest;
    for (const id of predated.accountIds) {
      const acc = allAccounts.find((a) => a.id === id);
      if (acc && acc.openingBalanceMinor === 0 && earliest < acc.openingDate) {
        await repo.updateAccount(id, { openingDate: earliest });
      }
    }
    bumpDataVersion();
  };
  const hasWallets = accountsOverview.balances.length > 0;
  const effectiveHeroMode: 'budget' | 'wallets' =
    userHeroMode ?? (hasWallets && overallBudgetMinor === null ? 'wallets' : 'budget');

  const { overview: duesOverview } = usePeople();
  const duesSummaryLine = formatHomeDuesSummaryLine(duesOverview, settings.currency, undefined, {
    personOwesYou: (name, amount) => t('overview.duePersonOwesYou', { name, amount }),
    youOwePerson: (name, amount) => t('overview.dueYouOwePerson', { name, amount }),
    youWillGet: (amount) => t('overview.dueYouWillGet', { amount }),
    youOwe: (amount) => t('overview.dueYouOwe', { amount }),
  });

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
  const usedPctText =
    overallBudgetMinor !== null
      ? t('overview.usedPct', {
          pct: formatUtilizationPct(summary.utilizationPct ?? 0),
        })
      : '';
  const perDayAmountText = hideAmounts
    ? HIDDEN_AMOUNT_TEXT
    : summary.safeToSpendPerDayMinor !== null
      ? t('overview.perDayAmount', {
          amount: formatMoney(summary.safeToSpendPerDayMinor, settings.currency),
        })
      : MISSING_METRIC_DASH;
  // Prevent Android Fabric from dropping the trailing Bangla word on shrink-wrapped mixed rows.
  const bnSubRowStyle = (text: string, alignRight = false) => [
    locale === 'bn'
      ? {
          minWidth: estimateSingleLineMinWidth(text, theme.typography.label.fontSize),
          flexShrink: 0,
        }
      : null,
    alignRight ? styles.rightAlignedText : null,
  ];

  const todayTransactions = recentTransactions.filter((tx) => tx.occurredOn === today);
  const earlierTransactions =
    todayTransactions.length > 0
      ? recentTransactions.filter((tx) => tx.occurredOn !== today)
      : recentTransactions;

  const barEntries = accountsOverview.balances.filter(
    (entry) => entry.account.includeInTotal && Math.abs(entry.balanceMinor) > 0
  );
  const totalAbsBalance = barEntries.reduce(
    (sum, entry) => sum + Math.abs(entry.balanceMinor),
    0
  );

  const walletsBody = (
          <>
            <AppText variant="label" color="heroTextSecondary">
              {hideAmounts
                ? t('overview.tapToShowHint')
                : accountsOverview.includedCount === 1
                  ? t('overview.acrossOneWallet')
                  : t('overview.acrossWallets', { count: accountsOverview.includedCount })}
            </AppText>

            <Money
              testID="hero-wallets-total"
              variant="hero"
              amountMinor={Math.abs(accountsOverview.totalMinor)}
              prefix={accountsOverview.totalMinor < 0 ? '−' : ''}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            {overallBudgetMinor !== null && summary.remainingMinor !== null ? (
              <>
                <View style={[styles.heroSubRow, { gap: theme.spacing.sm }]}>
                  <AppText
                    variant="label"
                    color="heroTextSecondary"
                    numberOfLines={1}
                    tabularNums
                    style={bnSubRowStyle(usedPctText)}
                  >
                    {usedPctText}
                  </AppText>
                  <AppText
                    variant="label"
                    color="heroTextSecondary"
                    numberOfLines={1}
                    tabularNums
                    style={bnSubRowStyle(perDayAmountText, true)}
                  >
                    {perDayAmountText}
                  </AppText>
                </View>
                <HeroProgressBar pct={summary.utilizationPct} />
              </>
            ) : null}

            <View
              style={[
                styles.stripRow,
                {
                  gap: theme.spacing.sm,
                  backgroundColor: theme.mode === 'light' && theme.colors.heroText === '#14161D' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.065)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.heroLine,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                },
              ]}
            >
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {overallBudgetMinor !== null
                    ? t('overview.safeToday')
                    : t('overview.inThisCycle')}
                </AppText>
                {overallBudgetMinor !== null ? (
                  summary.safeToSpendPerDayMinor !== null ? (
                    <Money
                      variant="bodyStrong"
                      amountMinor={summary.safeToSpendPerDayMinor}
                      currency={settings.currency}
                      color="heroBar"
                      hidden={hideAmounts}
                    />
                  ) : (
                    <AppText variant="bodyStrong" color="heroText">
                      {MISSING_METRIC_DASH}
                    </AppText>
                  )
                ) : (
                  <Money
                    variant="bodyStrong"
                    amountMinor={summary.incomeMinor}
                    currency={settings.currency}
                    color="heroText"
                    hidden={hideAmounts}
                  />
                )}
              </View>
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine },
                ]}
              >
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
              {overallBudgetMinor !== null && summary.remainingMinor !== null ? (
                <View
                  style={[
                    styles.stripCol,
                    styles.stripColBorder,
                    { borderLeftColor: theme.colors.heroLine },
                  ]}
                >
                  <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                    {isNegativeRemaining
                      ? t('overview.overByHero')
                      : t('overview.leftToSpend')}
                  </AppText>
                  <Money
                    testID="hero-remaining-amount"
                    variant="bodyStrong"
                    amountMinor={Math.abs(summary.remainingMinor)}
                    currency={settings.currency}
                    color="heroText"
                    hidden={hideAmounts}
                  />
                </View>
              ) : null}
            </View>
          </>
  );
  const budgetBody =
    overallBudgetMinor !== null && summary.remainingMinor !== null ? (
          <>
            <AppText variant="label" color="heroTextSecondary">
              {isNegativeRemaining
                ? t('overview.overByHero')
                : t('overview.leftToSpend')}
            </AppText>

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
              <AppText
                variant="label"
                color="heroTextSecondary"
                numberOfLines={1}
                tabularNums
                style={bnSubRowStyle(usedPctText, true)}
              >
                {usedPctText}
              </AppText>
            </View>

            <HeroProgressBar pct={summary.utilizationPct} />

            <View
              style={[
                styles.stripRow,
                {
                  gap: theme.spacing.sm,
                  backgroundColor: theme.mode === 'light' && theme.colors.heroText === '#14161D' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.065)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.heroLine,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                },
              ]}
            >
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.safeToday')}
                </AppText>
                {summary.safeToSpendPerDayMinor !== null ? (
                  <Money
                    variant="bodyStrong"
                    amountMinor={summary.safeToSpendPerDayMinor}
                    currency={settings.currency}
                    color="heroBar"
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
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine },
                ]}
              >
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
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine },
                ]}
              >
                {hasWallets ? (
                  <>
                    <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                      {t('overview.walletsHeading')}
                    </AppText>
                    <Money
                      testID="hero-wallets-total"
                      variant="bodyStrong"
                      amountMinor={Math.abs(accountsOverview.totalMinor)}
                      prefix={accountsOverview.totalMinor < 0 ? '−' : ''}
                      currency={settings.currency}
                      color="heroText"
                      hidden={hideAmounts}
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </View>
            </View>
          </>
  ) : null;
  const noBudgetBody = (
          <>
            <AppText variant="label" color="heroTextSecondary">
              {t('overview.spentThisCycle')}
            </AppText>

            <Money
              testID="hero-spent-no-budget"
              variant="hero"
              amountMinor={summary.spentMinor}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            <View style={[styles.divider, { backgroundColor: theme.colors.heroLine }]} />

            <PressableScale
              pressScale={0.98}
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
            </PressableScale>
          </>
  );

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
        <PressableScale
          pressScale={0.98}
          testID="overview-settings-shortcut"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.settings')}
          hitSlop={6}
          onPress={() => router.push('/settings' as never)}
          style={({ pressed }) => [
            styles.avatarBtn,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'transparent',
              transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }],
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ProfileAvatar
            name={settings.name.trim() || avatarInitial}
            colorKey={settings.avatarColorKey}
            avatarId={settings.avatarId}
            size={40}
          />
        </PressableScale>
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

      {/* Hero summary / budget card with Mockup 3 In-Card Mode Switcher */}
      <HeroCard
        testID="overview-budget-card"
        onPress={toggleHideAmounts}
        accessibilityLabel={
          hideAmounts ? t('overview.amountsHiddenLabel') : t('overview.tapToHideHint')
        }
        accessibilityHint={
          hideAmounts ? t('overview.tapToShowHint') : t('overview.tapToHideHint')
        }
        style={{ gap: theme.spacing.md }}
      >
        <View style={styles.heroTopRow}>
          <View
            testID="overview-hero-switcher"
            style={[
              styles.heroTabs,
              {
                backgroundColor: theme.colors.heroLine,
                borderWidth: 1,
                borderColor: theme.colors.heroLine,
              },
            ]}
          >
            <PressableScale
              pressScale={0.97}
              testID="overview-hero-tab-budget"
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveHeroMode === 'budget' }}
              onPress={() => setUserHeroMode('budget')}
              style={[
                styles.heroTab,
                {
                  borderRadius: 999,
                  backgroundColor:
                    effectiveHeroMode === 'budget' ? theme.colors.heroText : 'transparent',
                },
              ]}
            >
              <AppText
                variant="tab"
                numberOfLines={1}
                style={[
                  styles.heroTabLabel,
                  {
                    color:
                      effectiveHeroMode === 'budget'
                        ? theme.colors.hero
                        : theme.colors.heroTextSecondary,
                  },
                ]}
              >
                {tr('overview.heroTabBudget')}
              </AppText>
            </PressableScale>
            <PressableScale
              pressScale={0.97}
              testID="overview-hero-tab-wallets"
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveHeroMode === 'wallets' }}
              onPress={() => setUserHeroMode('wallets')}
              style={[
                styles.heroTab,
                {
                  borderRadius: 999,
                  backgroundColor:
                    effectiveHeroMode === 'wallets' ? theme.colors.heroText : 'transparent',
                },
              ]}
            >
              <AppText
                variant="tab"
                numberOfLines={1}
                style={[
                  styles.heroTabLabel,
                  {
                    color:
                      effectiveHeroMode === 'wallets'
                        ? theme.colors.hero
                        : theme.colors.heroTextSecondary,
                  },
                ]}
              >
                {tr('overview.heroTabWallets')}
              </AppText>
            </PressableScale>
          </View>

          <View style={[styles.heroTopRight, { gap: theme.spacing.xs }]}>
            {overallBudgetMinor !== null ? (
              <BudgetStatusBadge status={summary.status} surface="hero" />
            ) : null}
            <IconButton
              testID="overview-hero-menu"
              icon="info"
              variant="ghost"
              iconColor={theme.colors.heroTextSecondary}
              size={34}
              iconSize={18}
              accessibilityLabel={t('overview.howNumbersWork')}
              onPress={() => setHowItWorksOpen(true)}
            />
          </View>
        </View>

        <HeroSwap
          gap={theme.spacing.md}
          showA={effectiveHeroMode === 'wallets' && hasWallets}
          a={walletsBody}
          b={overallBudgetMinor !== null && summary.remainingMinor !== null ? budgetBody : noBudgetBody}
        />
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

      {predated.count > 0 ? (
        <Banner
          testID="overview-predated-nudge"
          icon="wallet"
          tone="accent"
          showChevron
          message={t('overview.predatedNudge', { count: predated.count })}
          accessibilityLabel={t('overview.predatedNudgeA11y')}
          onPress={() => {
            void countEarlierEntries();
          }}
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

      {/* Today's Daybook Card (Mockup 3 Modern Money Notebook) */}
      <Surface testID="overview-daybook-card" padded={false}>
        <View
          style={[
            styles.daybookHeader,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderBottomColor: theme.colors.separator,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm + 2,
            },
          ]}
        >
          <AppText
            variant="overline"
            color="textSecondary"
            style={styles.flexOne}
            numberOfLines={1}
          >
            {tr('overview.todayDaybookHeader', { date: formatShortDate(today) })}
          </AppText>
          <PressableScale
            pressScale={0.97}
            testID="overview-quick-entry-btn"
            accessibilityRole="button"
            accessibilityLabel={tr('overview.quickEntryAction')}
            hitSlop={8}
            onPress={() => router.push('/quick-entry')}
          >
            <AppText variant="label" color="accent" style={styles.semiBold}>
              {tr('overview.quickEntryAction')}
            </AppText>
          </PressableScale>
        </View>

        {todayTransactions.length === 0 ? (
          <View
            style={[
              styles.daybookEmptyRow,
              {
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                gap: theme.spacing.md,
              },
            ]}
          >
            <View style={[styles.flexOne, { gap: 2 }]}>
              <AppText variant="bodyStrong">
                {tr('overview.nothingWrittenToday')}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {tr('overview.nothingWrittenSub')}
              </AppText>
            </View>
            <Button
              testID="overview-check-in-btn"
              variant="secondary"
              size="sm"
              leftIcon="circle-check"
              title={t('overview.checkInShort')}
              onPress={() => router.push('/check-in')}
            />
          </View>
        ) : (
          <>
            {todayTransactions.map((tx, idx) => {
              const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
              const catName = cat?.name ?? t('common.uncategorized');
              const wallet = tx.accountId ? accountsById.get(tx.accountId) : undefined;
              const isIncome = tx.type === 'income';
              const whenLabel = tx.occurredTime
                ? formatFriendlyTime(tx.occurredTime, use24Hour)
                : t('common.today');
              const subtitleParts = [catName];
              if (wallet) subtitleParts.push(wallet.name);
              subtitleParts.push(whenLabel);

              return (
                <ListRow
                  key={`today-${tx.id}`}
                  left={
                    <IconTile
                      icon={cat?.icon ?? 'shapes'}
                      colorKey={cat?.colorKey ?? 'gray'}
                      size="sm"
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
                      color={isIncome ? 'income' : 'expense'}
                      hidden={hideAmounts}
                    />
                  }
                  showDivider={idx < todayTransactions.length - 1}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                />
              );
            })}
            <View
              style={[
                styles.daybookFooter,
                {
                  borderTopColor: theme.colors.separator,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
            >
              <PressableScale
                pressScale={0.97}
                testID="overview-check-in-btn"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => router.push('/check-in')}
                style={styles.daybookFooterAction}
              >
                <AppIcon name="circle-check" size={15} color={theme.colors.accent} />
                <AppText variant="label" color="accent" style={styles.semiBold}>
                  {t('overview.checkInShort')}
                </AppText>
              </PressableScale>
              <PressableScale
                pressScale={0.97}
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => router.push('/(tabs)/ledger' as never)}
                style={styles.daybookFooterAction}
              >
                <AppText variant="label" color="textSecondary">
                  {t('tabs.ledger')}
                </AppText>
                <AppIcon
                  name="chevron-right"
                  size={15}
                  color={theme.colors.textSecondary}
                />
              </PressableScale>
            </View>
          </>
        )}
      </Surface>

      {/* Wallets Register Card with Stacked Liquidity Proportion Bar OR "Set up your wallets" prompt */}
      {hasWallets ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.sectionRow}>
            <AppText variant="headline">{t('overview.walletsHeading')}</AppText>
            <PressableScale
              pressScale={0.98}
              testID="overview-manage-wallets"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/wallets' as never)}
            >
              <AppText variant="label" color="accent" style={styles.semiBold}>
                {t('overview.manageWallets')}
              </AppText>
            </PressableScale>
          </View>

          <Surface testID="overview-wallets-list" padded={false}>
            {barEntries.length > 0 && totalAbsBalance > 0 ? (
              <View
                testID="overview-wallets-proportion-bar"
                style={[
                  styles.proportionBarRow,
                  {
                    paddingHorizontal: theme.spacing.lg,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xs,
                    gap: 3,
                  },
                ]}
              >
                {barEntries.map((entry) => {
                  const share = Math.max(
                    0.06,
                    Math.abs(entry.balanceMinor) / totalAbsBalance
                  );
                  const segColor = entry.isDue
                    ? theme.colors.danger
                    : resolveWalletColorHex(entry.account);
                  return (
                    <View
                      key={`bar-${entry.account.id}`}
                      style={[
                        styles.proportionBarSegment,
                        {
                          flex: share,
                          backgroundColor: segColor,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}

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
                          {` ${t('wallets.dueSuffix')}`}
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
          <AppText variant="headline" style={styles.flexOne} numberOfLines={1}>
            {t('overview.spendingTitle')}
          </AppText>
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
            <PressableScale
              pressScale={0.98}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/plan/insights' as never)}
            >
              <AppText variant="label" color="accent">
                {t('overview.seeAll')}
              </AppText>
            </PressableScale>
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
                  <PressableScale
                    pressScale={0.98}
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
                  </PressableScale>
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
      {earlierTransactions.length > 0 || recentTransactions.length === 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.sectionRow}>
            <AppText variant="headline">{t('overview.recentTitle')}</AppText>
            <PressableScale
              pressScale={0.98}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/(tabs)/ledger' as never)}
            >
              <AppText variant="label" color="accent">
                {t('overview.seeAll')}
              </AppText>
            </PressableScale>
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
              {earlierTransactions.map((tx, idx) => {
                const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
                const catName = cat?.name ?? t('common.uncategorized');
                const wallet = tx.accountId ? accountsById.get(tx.accountId) : undefined;
                const isIncome = tx.type === 'income';
                const dateLabel =
                  tx.occurredOn === today
                    ? t('common.today')
                    : tx.occurredOn === addDays(today, -1)
                      ? t('common.yesterday')
                      : formatShortDate(tx.occurredOn);
                const whenLabel = tx.occurredTime
                  ? `${dateLabel}, ${formatFriendlyTime(tx.occurredTime, use24Hour)}`
                  : dateLabel;
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
                        color={isIncome ? 'income' : 'expense'}
                        hidden={hideAmounts}
                      />
                    }
                    showDivider={idx < earlierTransactions.length - 1}
                    onPress={() =>
                      router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                    }
                  />
                );
              })}
            </Surface>
          )}
        </View>
      ) : null}

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
  heroTabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  heroTab: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  heroTabLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Manrope_700Bold',
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
  rightAlignedText: {
    textAlign: 'right',
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
  stripColBorder: {
    borderLeftWidth: 1,
    paddingLeft: 10,
  },
  noBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  semiBold: {
    fontWeight: '600',
  },
  daybookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    gap: 8,
  },
  daybookEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daybookFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  daybookFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proportionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proportionBarSegment: {
    height: 5,
    borderRadius: 3,
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
