import * as Crypto from 'expo-crypto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isSavingsAssetKind, resolveWalletColorHex } from '@/domain/accounts';
import { formatUtilizationPct } from '@/domain/calc';
import { addWageId, buildWageEntry, pruneWageLast, removeWageId } from '@/domain/dailyWage';
import {
  addDays,
  currentLocalTime,
  formatFriendlyTime,
  formatShortDate,
  formatWeekdayShortDate,
  isDevice24HourClock,
  todayLocalDate,
} from '@/domain/dates';
import { fitMoneyGroup } from '@/domain/fitMoney';
import { formatMoney, getCurrencySymbol, HIDDEN_AMOUNT_TEXT } from '@/domain/money';
import { remainingDays } from '@/domain/period';
import { formatHomeDuesSummaryLine } from '@/domain/dues';
import type { LocalDate } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { toBnDigits } from '@/i18n/displayText';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { usePrivacyStore } from '@/state/privacyStore';
import { useAccounts } from '@/state/useAccounts';
import { useDashboard } from '@/state/useDashboard';
import { useTodayWithRefresh } from '@/state/useToday';
import { formatSpendingPeriodLabel } from '@/state/periodLabel';
import { usePeople } from '@/state/usePeople';
import { getCategoryTileVisual } from '@/theme/categoryColors';
import type { TypographyVariant } from '@/theme/tokens';
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
import { hapticLight } from '@/ui/haptics';
import { useToast } from '@/ui/Toast';

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

/** Candidate type sizes for amounts in the three-column hero strips, largest first. */
const STRIP_FIT = ['bodyStrong', 'label'] as const;
/** Candidate type sizes for the large hero amount, largest first. */
const HERO_FIT = ['hero', 'display', 'title'] as const;
/** Candidate type sizes for wallet tile balances, largest first. */
const WALLET_TILE_FIT = ['headline', 'bodyStrong', 'label'] as const;
const STRIP_COLUMNS = 3;
/** Placeholder the translated caption is split on so the amount renders as a Money inline. */
const AMOUNT_SLOT = '\u0001';

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
  // Today's date refreshes on focus and when the app returns to the foreground.
  const { today: liveToday, refresh: refreshToday } = useTodayWithRefresh();

  const {
    today,
    periodKind,
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
    billsCommitment,
    afterBills,
    periodFeesMinor,
    dailyBudgetLimitMinor,
    pendingDraftsCount,
    loading,
    error,
    reload,
  } = useDashboard(todayOverride ?? liveToday);

  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('daily');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const homeParams = useLocalSearchParams<{ howItWorks?: string }>();
  const howItWorksVisible = howItWorksOpen || homeParams.howItWorks === '1';
  const closeHowItWorks = () => {
    setHowItWorksOpen(false);
    if (homeParams.howItWorks) {
      router.setParams({ howItWorks: undefined });
    }
  };
  const { width: winW } = useWindowDimensions();
  const [userHeroMode, setUserHeroMode] = useState<'budget' | 'net_worth' | 'wallets' | null>(null);
  // Measured widths (dp) that let every amount pick a size that fits on one line.
  const [heroMeasuredW, setHeroMeasuredW] = useState<number | null>(null);
  const [walletGridW, setWalletGridW] = useState<number | null>(null);
  const onHeroLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    setHeroMeasuredW((prev) => (prev === w ? prev : w));
  };
  const onWalletGridLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    setWalletGridW((prev) => (prev === w ? prev : w));
  };

  const { hideAmounts, toggleHideAmounts, showPoisha } = usePrivacyStore();
  const {
    overview: accountsOverview,
    accountsById,
    allAccounts,
    netWorth,
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
  const effectiveHeroMode: 'budget' | 'net_worth' | 'wallets' =
    userHeroMode ?? (hasWallets && overallBudgetMinor === null ? 'wallets' : 'budget');

  const { overview: duesOverview } = usePeople();
  const duesSummaryLine = formatHomeDuesSummaryLine(duesOverview, settings.currency, undefined, {
    personOwesYou: (name, amount) => t('overview.duePersonOwesYou', { name, amount }),
    youOwePerson: (name, amount) => t('overview.dueYouOwePerson', { name, amount }),
    youWillGet: (amount) => t('overview.dueYouWillGet', { amount }),
    youOwe: (amount) => t('overview.dueYouOwe', { amount }),
  });

  // "Worked today": one tap records the saved daily wage as income for today.
  const { showToast } = useToast();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const dailyWage = settings.dailyWage;
  const wageCategory = dailyWage ? categoriesById.get(dailyWage.categoryId) : undefined;
  const wageUsable =
    dailyWage !== null &&
    wageCategory !== undefined &&
    wageCategory.kind === 'income' &&
    wageCategory.archivedAt === null;
  // Whether today's wage is recorded, for the day it was read. Unknown (null) while the first read
  // is running, for another day, or after a failed read: the strip then shows no tappable button.
  const [wageStatus, setWageStatus] = useState<{ day: LocalDate; recorded: boolean } | null>(null);
  const wageRecorded = wageStatus !== null && wageStatus.day === today ? wageStatus.recorded : null;
  const wageBusyRef = useRef(false);
  // Set when an entry went in but neither its pointer nor the rollback could be written: that day
  // counts as recorded for this session, so the button is not offered again.
  const wageForcedDayRef = useRef<LocalDate | null>(null);
  // One confirmation per opening of the "Record again" sheet. Reset only when the sheet opens.
  const wageConfirmedRef = useRef(false);
  const [wageSaving, setWageSaving] = useState(false);
  const [anotherWageOpen, setAnotherWageOpen] = useState(false);
  /** Reads through the repo: the saved pointer cut down to the entries still live and dated that day. */
  const readWageLast = useCallback(
    async (day: LocalDate) => {
      const last = (await repo.getSettings()).dailyWageLast;
      if (last === null || last.day !== day) return null;
      const found = await Promise.all(last.ids.map((id) => repo.getTransaction(id)));
      return pruneWageLast(last, found, day);
    },
    [repo]
  );
  const readWageRecorded = useCallback(
    async (day: LocalDate): Promise<boolean> =>
      wageForcedDayRef.current === day || (await readWageLast(day)) !== null,
    [readWageLast]
  );
  useEffect(() => {
    if (!wageUsable) return;
    let active = true;
    readWageRecorded(today)
      .then((recorded) => {
        if (active && !wageBusyRef.current) setWageStatus({ day: today, recorded });
      })
      .catch(() => {
        if (active && !wageBusyRef.current) setWageStatus(null);
      });
    return () => {
      active = false;
    };
  }, [readWageRecorded, today, dataVersion, wageUsable]);
  const wageAmountText =
    dailyWage === null
      ? ''
      : hideAmounts
        ? HIDDEN_AMOUNT_TEXT
        : locale === 'bn'
          ? toBnDigits(formatMoney(dailyWage.amountMinor, settings.currency, { showPoisha }))
          : formatMoney(dailyWage.amountMinor, settings.currency, { showPoisha });
  /**
   * Records the saved wage as income. The day and time come from the clock at the moment of the tap.
   * The first entry of a day re-checks through the repo just before inserting; a second shift
   * (again) skips that check because the person confirmed it. A ref blocks re-entry.
   */
  const recordWage = async (again: boolean) => {
    if (!dailyWage || !wageCategory || wageBusyRef.current) return;
    if (!again && wageRecorded !== false) return;
    wageBusyRef.current = true;
    setWageSaving(true);
    let insertedId: string | null = null;
    let recordDay: LocalDate | null = null;
    try {
      const now = new Date();
      const day = todayLocalDate(now);
      recordDay = day;
      const previous = await readWageLast(day);
      if (!again && (previous !== null || wageForcedDayRef.current === day)) {
        setWageStatus({ day, recorded: true });
        return;
      }
      // The wallet is resolved from the repo, so it never depends on a half-loaded screen.
      let accountId = dailyWage.accountId;
      let walletDropped = false;
      if (accountId !== null) {
        const wallets = await repo.listAccounts({ includeArchived: true });
        const wallet = wallets.find((a) => a.id === accountId);
        if (wallet === undefined || wallet.archivedAt != null) {
          accountId = null;
          walletDropped = true;
        }
      }
      const id = Crypto.randomUUID();
      await repo.insertTransaction(
        buildWageEntry({
          id,
          wage: { ...dailyWage, accountId },
          categoryName: wageCategory.name,
          currency: settings.currency,
          day,
          time: currentLocalTime(now),
        })
      );
      insertedId = id;
      await repo.setSetting('dailyWageLast', addWageId(previous, id, day));
      insertedId = null;
      setWageStatus({ day, recorded: true });
      // The clock passed midnight since this screen last read it: move the strip and the day book
      // header to the new day together.
      if (day !== today) refreshToday();
      hapticLight();
      bumpDataVersion();
      showToast({
        message: walletDropped ? t('dailyWage.savedNoWalletToast') : t('dailyWage.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
        actionLabel: t('common.undo'),
        onAction: () => {
          void (async () => {
            await repo.softDeleteTransaction(id);
            // Only this entry's id leaves the list; the other entries of the day stay recorded.
            const current = (await repo.getSettings()).dailyWageLast;
            if (current !== null) await repo.setSetting('dailyWageLast', removeWageId(current, id));
          })()
            .catch(() => {})
            .finally(() => bumpDataVersion());
        },
      });
    } catch {
      let halfFailed = false;
      if (insertedId !== null) {
        // The entry went in but its pointer did not: take the entry back so nothing is half done.
        try {
          await repo.softDeleteTransaction(insertedId);
        } catch {
          halfFailed = true;
        }
      }
      if (halfFailed && recordDay !== null) {
        // The entry is still there and could not be taken back: say so, and treat the day as recorded.
        wageForcedDayRef.current = recordDay;
        setWageStatus({ day: recordDay, recorded: true });
        showToast({ message: t('dailyWage.checkEntriesToast'), icon: 'circle-alert', tone: 'danger' });
      } else {
        showToast({ message: t('dailyWage.failedToast'), icon: 'circle-alert', tone: 'danger' });
      }
      bumpDataVersion();
    } finally {
      wageBusyRef.current = false;
      setWageSaving(false);
    }
  };

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
  const isWeekly = periodKind === 'week';
  // Weekly mode only: the week's date range ("14 to 20 Nov") for the hero captions.
  const weekRangeLabel = isWeekly
    ? formatSpendingPeriodLabel(period, { ...settings, periodKind }, locale)
    : '';
  const isNegativeRemaining =
    summary.remainingMinor !== null && summary.remainingMinor < 0;
  const usedPctText =
    overallBudgetMinor !== null
      ? t('overview.usedPct', {
          pct: formatUtilizationPct(summary.utilizationPct ?? 0),
        })
      : '';
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

  // Inner width of the hero card (the top row spans it); estimated from the window until measured.
  const heroInnerW =
    heroMeasuredW ?? winW - 2 * theme.geometry.screenMargin - 2 * theme.spacing.xl - 2;
  // Strip column width: strip inner width, minus the column gaps, split evenly, minus the divider
  // (1) and its padding so the narrowest (divided) columns are covered.
  const stripDividerPad = theme.spacing.sm;
  const stripColW = Math.max(
    0,
    Math.floor(
      (heroInnerW - 2 - 2 * theme.spacing.md - (STRIP_COLUMNS - 1) * theme.spacing.sm) / STRIP_COLUMNS
    ) -
      1 -
      stripDividerPad
  );
  // All amounts in one strip share one type size: the smallest any of them needs to fit its column.
  // Compact formatting stays per amount (Money decides it again with the same inputs).
  const stripVariantFor = (
    items: readonly { amountMinor: number; signed?: boolean }[]
  ): TypographyVariant => {
    if (hideAmounts || items.length === 0) return STRIP_FIT[0];
    const symbolChars = getCurrencySymbol(settings.currency).length;
    const fitted = fitMoneyGroup(
      items.map((item) => ({
        amountMinor: item.amountMinor,
        compact: false,
        showDecimals: showPoisha,
        roundToWhole: false,
        hasSign: item.signed === true,
        symbolChars,
      })),
      {
        availableWidth: stripColW,
        variants: STRIP_FIT.map((key) => ({ key, fontSize: theme.typography[key].fontSize })),
        bangla: locale === 'bn',
      }
    );
    return fitted[0].variant;
  };
  // Wallet tiles: two columns separated by the card gap; inner width excludes the tile padding.
  const walletTileW =
    walletGridW !== null ? Math.floor((walletGridW - theme.geometry.cardGap) / 2) : null;
  const walletTileInnerW =
    walletTileW !== null ? Math.max(0, walletTileW - 2 * theme.spacing.md) : undefined;

  const noticeCount =
    (summary.ignoredOtherCurrencyCount > 0 ? 1 : 0) +
    (showNewCycleHint ? 1 : 0) +
    (predated.count > 0 ? 1 : 0);

  const liquidCashMfsMinor = accountsOverview.balances
    .filter(
      (entry) =>
        entry.account.includeInTotal &&
        (entry.account.kind === 'cash' ||
          entry.account.kind === 'mobile_wallet' ||
          entry.account.kind === 'other')
    )
    .reduce((acc, entry) => acc + entry.balanceMinor, 0);
  const liquidBankCardMinor = accountsOverview.balances
    .filter(
      (entry) =>
        entry.account.includeInTotal &&
        (entry.account.kind === 'bank' || entry.account.kind === 'credit_card')
    )
    .reduce((acc, entry) => acc + entry.balanceMinor, 0);

  const duesNetSigned = netWorth.netDuesMinor - netWorth.cardDebtMinor;
  const safePerDayMinor = afterBills.safePerDayAfterBillsMinor;
  const walletsStripVariant = stripVariantFor([
    { amountMinor: Math.abs(liquidCashMfsMinor), signed: liquidCashMfsMinor < 0 },
    { amountMinor: Math.abs(liquidBankCardMinor), signed: liquidBankCardMinor < 0 },
    { amountMinor: netWorth.savingsAssetsMinor },
  ]);
  const budgetStripVariant = stripVariantFor([
    { amountMinor: safePerDayMinor ?? 0 },
    { amountMinor: summary.spentMinor },
    hasWallets
      ? { amountMinor: Math.abs(accountsOverview.totalMinor), signed: accountsOverview.totalMinor < 0 }
      : { amountMinor: summary.incomeMinor },
  ]);
  const netWorthStripVariant = stripVariantFor([
    { amountMinor: Math.abs(netWorth.liquidAssetsMinor), signed: netWorth.liquidAssetsMinor < 0 },
    { amountMinor: Math.abs(netWorth.savingsAssetsMinor) },
    { amountMinor: Math.abs(duesNetSigned), signed: duesNetSigned !== 0 },
  ]);

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
              fitWidth={heroInnerW}
              fitVariants={HERO_FIT}
              amountMinor={Math.abs(accountsOverview.totalMinor)}
              prefix={accountsOverview.totalMinor < 0 ? '−' : ''}
              currency={settings.currency}
              color="heroText"
              hidden={hideAmounts}
            />

            <View
              style={[
                styles.stripRow,
                {
                  gap: theme.spacing.sm,
                  backgroundColor: theme.colors.heroStrip,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.heroLine,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.cashMfsLabel')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  fitWidth={stripColW}
                  fitVariants={[walletsStripVariant]}
                  amountMinor={Math.abs(liquidCashMfsMinor)}
                  prefix={liquidCashMfsMinor < 0 ? '−' : ''}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
                ]}
              >
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.bankCardLabel')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  fitWidth={stripColW}
                  fitVariants={[walletsStripVariant]}
                  amountMinor={Math.abs(liquidBankCardMinor)}
                  prefix={liquidBankCardMinor < 0 ? '−' : ''}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
                ]}
              >
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.savingsLabel')}
                </AppText>
                <Money
                  variant="bodyStrong"
                  fitWidth={stripColW}
                  fitVariants={[walletsStripVariant]}
                  amountMinor={netWorth.savingsAssetsMinor}
                  currency={settings.currency}
                  color="heroText"
                  hidden={hideAmounts}
                />
              </View>
            </View>
          </>
  );
  const budgetBody =
    overallBudgetMinor !== null && summary.remainingMinor !== null ? (
          <>
            <AppText variant="label" color="heroTextSecondary">
              {isNegativeRemaining
                ? t('overview.overByHero')
                : isWeekly
                  ? t('overview.leftToSpendWeek', { range: weekRangeLabel })
                  : t('overview.leftToSpend')}
            </AppText>

            <Money
              testID="hero-remaining-amount"
              variant="hero"
              fitWidth={heroInnerW}
              fitVariants={HERO_FIT}
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

            {afterBills.unpaidCount > 0 && afterBills.leftAfterBillsMinor !== null ? (
              <AppText testID="hero-after-bills" variant="caption" color="heroTextSecondary">
                {t(
                  afterBills.leftAfterBillsMinor < 0
                    ? 'overview.shortAfterUnpaidBills'
                    : 'overview.afterUnpaidBills',
                  { amount: AMOUNT_SLOT }
                )
                  .split(AMOUNT_SLOT)
                  .flatMap((part, i) =>
                    i === 0
                      ? [part]
                      : [
                          <Money
                            key="after-bills-amount"
                            testID="hero-after-bills-amount"
                            variant="caption"
                            amountMinor={Math.abs(afterBills.leftAfterBillsMinor ?? 0)}
                            currency={settings.currency}
                            color="heroTextSecondary"
                            hidden={hideAmounts}
                          />,
                          part,
                        ]
                  )}
              </AppText>
            ) : null}

            <HeroProgressBar pct={summary.utilizationPct} />

            <View
              style={[
                styles.stripRow,
                {
                  gap: theme.spacing.sm,
                  backgroundColor: theme.colors.heroStrip,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.heroLine,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.stripCol}>
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.safeToday')}
                </AppText>
                {safePerDayMinor !== null ? (
                  <Money
                    variant="bodyStrong"
                    fitWidth={stripColW}
                    fitVariants={[budgetStripVariant]}
                    amountMinor={safePerDayMinor}
                    currency={settings.currency}
                    color="heroText"
                    hidden={hideAmounts}
                  />
                ) : (
                  <AppText variant="label" color="heroText">
                    {remainingDaysCount <= 0
                      ? t('overview.safeTodayCycleEnded')
                      : t('overview.noBudgetSet')}
                  </AppText>
                )}
              </View>
              <View
                style={[
                  styles.stripCol,
                  styles.stripColBorder,
                  { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
                ]}
              >
                <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
                  {t('overview.spentShort')}
                </AppText>
                <Money
                  testID="hero-spent-strip"
                  variant="bodyStrong"
                  fitWidth={stripColW}
                  fitVariants={[budgetStripVariant]}
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
                  { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
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
                      fitWidth={stripColW}
                      fitVariants={[budgetStripVariant]}
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
                      fitWidth={stripColW}
                      fitVariants={[budgetStripVariant]}
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
              {isWeekly
                ? t('overview.spentThisWeek', { range: weekRangeLabel })
                : t('overview.spentThisCycle')}
            </AppText>

            <Money
              testID="hero-spent-no-budget"
              variant="hero"
              fitWidth={heroInnerW}
              fitVariants={HERO_FIT}
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
              hitSlop={{ top: theme.spacing.sm, bottom: theme.spacing.sm }}
              style={({ pressed }) => [
                styles.noBudgetRow,
                {
                  gap: theme.spacing.sm,
                  opacity: pressed && !reducedMotion ? 0.7 : 1,
                },
              ]}
            >
              <AppText variant="label" color="heroTextSecondary" style={styles.flexOne}>
                {isWeekly ? t('overview.noBudgetInlineWeek') : t('overview.noBudgetInline')}
              </AppText>
              <AppText variant="label" color="heroText" style={styles.semiBold}>
                {t('overview.setBudgetCta')}
              </AppText>
              <AppIcon name="chevron-right" size={16} color={theme.colors.heroText} />
            </PressableScale>
          </>
  );

  const netWorthBody = (
    <>
      <AppText variant="label" color="heroTextSecondary">
        {t('overview.netWorthLabel')}
      </AppText>

      <Money
        testID="hero-networth-total"
        variant="hero"
        fitWidth={heroInnerW}
        fitVariants={HERO_FIT}
        amountMinor={Math.abs(netWorth.netWorthMinor)}
        prefix={netWorth.netWorthMinor < 0 ? '−' : ''}
        currency={settings.currency}
        color="heroText"
        hidden={hideAmounts}
      />

      {periodFeesMinor > 0 || billsCommitment.unpaidCount > 0 ? (
        <View style={[styles.heroSubRow, { gap: theme.spacing.sm }]}>
          <AppText variant="caption" color="heroTextSecondary" numberOfLines={1}>
            {periodFeesMinor > 0
              ? `${t('overview.mfsFeesLabel')}: ${hideAmounts ? HIDDEN_AMOUNT_TEXT : formatMoney(periodFeesMinor, settings.currency, { showPoisha: false })}`
              : ''}
          </AppText>
          {billsCommitment.unpaidCount > 0 && billsCommitment.uncommittedSafePerDayMinor !== null ? (
            <AppText variant="caption" color="heroTextSecondary" numberOfLines={1}>
              {`${t('overview.afterBillsLabel')}: ${hideAmounts ? HIDDEN_AMOUNT_TEXT : t('overview.perDayAmount', { amount: formatMoney(billsCommitment.uncommittedSafePerDayMinor, settings.currency, { showPoisha: false }) })}`}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.stripRow,
          {
            gap: theme.spacing.sm,
            backgroundColor: theme.colors.heroStrip,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.heroLine,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.stripCol}>
          <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
            {t('overview.liquidLabel')}
          </AppText>
          <Money
            variant="bodyStrong"
            fitWidth={stripColW}
            fitVariants={[netWorthStripVariant]}
            amountMinor={Math.abs(netWorth.liquidAssetsMinor)}
            prefix={netWorth.liquidAssetsMinor < 0 ? '−' : ''}
            currency={settings.currency}
            color="heroText"
            hidden={hideAmounts}
          />
        </View>
        <View
          style={[
            styles.stripCol,
            styles.stripColBorder,
            { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
          ]}
        >
          <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
            {t('overview.savingsLabel')}
          </AppText>
          <Money
            variant="bodyStrong"
            fitWidth={stripColW}
            fitVariants={[netWorthStripVariant]}
            amountMinor={Math.abs(netWorth.savingsAssetsMinor)}
            currency={settings.currency}
            color="heroText"
            hidden={hideAmounts}
          />
        </View>
        <View
          style={[
            styles.stripCol,
            styles.stripColBorder,
            { borderLeftColor: theme.colors.heroLine, paddingLeft: stripDividerPad },
          ]}
        >
          <AppText variant="label" color="heroTextSecondary" numberOfLines={1}>
            {t('overview.duesCardLabel')}
          </AppText>
          <Money
            variant="bodyStrong"
            fitWidth={stripColW}
            fitVariants={[netWorthStripVariant]}
            amountMinor={Math.abs(duesNetSigned)}
            prefix={duesNetSigned > 0 ? '+' : duesNetSigned < 0 ? '−' : ''}
            currency={settings.currency}
            color="heroText"
            hidden={hideAmounts}
          />
        </View>
      </View>
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
        {noticeCount > 0 ? (
          <IconButton
            testID="overview-notices"
            icon="bell"
            variant="surface"
            size={40}
            iconSize={19}
            badgeCount={noticeCount}
            accessibilityLabel={t('overview.noticesTitle')}
            onPress={() => setNoticesOpen(true)}
          />
        ) : null}
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
        <View testID="overview-hero-top-row" style={styles.heroTopRow} onLayout={onHeroLayout}>
          <SegmentedControl<'budget' | 'net_worth' | 'wallets'>
            testID="overview-hero-switcher"
            size="sm"
            tone="hero"
            value={effectiveHeroMode}
            onChange={setUserHeroMode}
            options={[
              { value: 'budget', label: tr('overview.heroTabBudget'), testID: 'overview-hero-tab-budget' },
              { value: 'net_worth', label: t('overview.heroTabNetWorth'), testID: 'overview-hero-tab-networth' },
              { value: 'wallets', label: tr('overview.heroTabWallets'), testID: 'overview-hero-tab-wallets' },
            ]}
          />
        </View>

        {(effectiveHeroMode === 'budget' && overallBudgetMinor !== null && summary.status !== 'over') ||
        (effectiveHeroMode === 'budget' && overallBudgetMinor === null) ? (
          <View style={[styles.heroTopRight, { gap: theme.spacing.xs }]}>
            {effectiveHeroMode === 'budget' &&
            overallBudgetMinor !== null &&
            summary.status !== 'over' ? (
              <BudgetStatusBadge status={summary.status} surface="hero" collapsible />
            ) : effectiveHeroMode === 'budget' && overallBudgetMinor === null ? (
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
            ) : null}
          </View>
        ) : null}

        {effectiveHeroMode === 'net_worth' ? (
          <View style={{ gap: theme.spacing.md }}>{netWorthBody}</View>
        ) : (
          <HeroSwap
            gap={theme.spacing.md}
            showA={effectiveHeroMode === 'wallets' && hasWallets}
            a={walletsBody}
            b={overallBudgetMinor !== null && summary.remainingMinor !== null ? budgetBody : noBudgetBody}
          />
        )}
      </HeroCard>

      {/* Pending Smart Inbox review banner */}
      {pendingDraftsCount > 0 ? (
        <Surface
          testID="overview-pending-inbox-banner"
          padded={false}
          onPress={() => router.push('/inbox' as never)}
          accessibilityLabel={t('overview.pendingInboxBanner', { count: pendingDraftsCount })}
        >
          <ListRow
            left={<IconTile icon="inbox" colorKey="blue" size="sm" />}
            title={t('overview.pendingInboxBanner', { count: pendingDraftsCount })}
            right={
              <AppText variant="label" color="accent" style={styles.semiBold}>
                {t('overview.pendingInboxReview')}
              </AppText>
            }
            showChevron
          />
        </Surface>
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
              paddingVertical: theme.spacing.sm,
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

        {wageUsable ? (
          <View
            testID="overview-wage-row"
            style={[
              styles.wageRow,
              {
                height: theme.geometry.buttonHeight + 2 * theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                borderBottomColor: theme.colors.separator,
              },
            ]}
          >
            {wageRecorded === null ? null : wageRecorded ? (
              <>
                <View
                  testID="overview-wage-recorded"
                  accessible
                  accessibilityLabel={t('overview.wageRecorded')}
                  style={[styles.wageRecorded, { gap: theme.spacing.sm }]}
                >
                  <AppIcon name="circle-check" size={16} color={theme.colors.income} />
                  <AppText
                    variant="label"
                    color="textSecondary"
                    numberOfLines={2}
                    ellipsizeMode="clip"
                    style={styles.wageRecordedLabel}
                  >
                    {t('overview.wageRecorded')}
                  </AppText>
                </View>
                <PressableScale
                  pressScale={0.97}
                  testID="overview-wage-add-again"
                  accessibilityRole="button"
                  accessibilityLabel={t('overview.wageAddAgainA11y')}
                  onPress={() => {
                    wageConfirmedRef.current = false;
                    setAnotherWageOpen(true);
                  }}
                  style={[
                    styles.wageAddAgain,
                    { minHeight: theme.touch.min, paddingHorizontal: theme.spacing.md },
                  ]}
                >
                  <AppText variant="label" color="accent" style={styles.semiBold}>
                    {t('overview.wageAddAgain')}
                  </AppText>
                </PressableScale>
              </>
            ) : (
              <PressableScale
                pressScale={0.97}
                testID="overview-worked-today-btn"
                accessibilityRole="button"
                accessibilityLabel={t('overview.workedTodayA11y', { amount: wageAmountText })}
                onPress={() => void recordWage(false)}
                style={[
                  styles.wageButton,
                  {
                    minHeight: theme.touch.min,
                    borderRadius: theme.radius.button,
                    borderWidth: 1,
                    borderColor: theme.colors.cardBorder,
                    paddingHorizontal: theme.spacing.lg,
                    gap: theme.spacing.sm,
                  },
                ]}
              >
                <AppIcon name="hand-coins" size={18} color={theme.colors.text} />
                <AppText
                  variant="label"
                  numberOfLines={1}
                  tabularNums
                  style={styles.semiBold}
                >
                  {t('overview.workedToday', { amount: wageAmountText })}
                </AppText>
              </PressableScale>
            )}
          </View>
        ) : null}

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

          <View testID="overview-wallets-list" style={{ gap: theme.geometry.cardGap }}>
            {barEntries.length > 0 && totalAbsBalance > 0 ? (
              <View
                testID="overview-wallets-proportion-bar"
                style={[
                  styles.proportionBarRow,
                  {
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

            <View
              style={[styles.walletGrid, { gap: theme.geometry.cardGap }]}
              onLayout={onWalletGridLayout}
            >
              {accountsOverview.balances.map((entry) => {
                const acc = entry.account;
                const brandHex = resolveWalletColorHex(acc);
                const isAsset = isSavingsAssetKind(acc.kind);

                return (
                  <PressableScale
                    key={acc.id}
                    pressScale={0.97}
                    testID={`overview-wallet-row-${acc.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={acc.name}
                    onPress={() => router.push(`/wallets/${acc.id}` as never)}
                    style={[
                      styles.walletGridTile,
                      {
                        width: walletTileW ?? '48%',
                        padding: theme.spacing.md,
                        backgroundColor: theme.colors.surfaceSunken,
                        borderRadius: theme.radius.md,
                        borderColor: theme.colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.walletGridTop}>
                      <WalletAvatar account={acc} size="xs" />
                      <View
                        style={[
                          styles.walletAccentDot,
                          { backgroundColor: entry.isDue ? theme.colors.danger : brandHex },
                        ]}
                      />
                    </View>
                    <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                      {acc.last4 ? `${acc.name} · ${acc.last4}` : isAsset ? `${acc.name} (${acc.kind.toUpperCase()})` : acc.name}
                    </AppText>
                    {!acc.includeInTotal ? (
                      <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                        {t('wallets.excludedBadge')}
                      </AppText>
                    ) : null}
                    {hideAmounts ? (
                      <AppText variant="bodyStrong" color="textSecondary" tabularNums>
                        {HIDDEN_AMOUNT_TEXT}
                      </AppText>
                    ) : entry.isDue ? (
                      <View
                        accessible
                        accessibilityLabel={entry.formattedBalance}
                        style={styles.walletDueRow}
                      >
                        <Money
                          variant="bodyStrong"
                          fitWidth={
                            walletTileInnerW !== undefined
                              ? Math.max(
                                  0,
                                  walletTileInnerW -
                                    estimateSingleLineMinWidth(
                                      ` ${t('wallets.dueSuffix')}`,
                                      theme.typography.caption.fontSize
                                    )
                                )
                              : undefined
                          }
                          fitVariants={WALLET_TILE_FIT}
                          amountMinor={Math.abs(entry.balanceMinor)}
                          currency={settings.currency}
                          color="danger"
                        />
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.danger, fontWeight: '600' },
                          ]}
                        >
                          {` ${t('wallets.dueSuffix')}`}
                        </Text>
                      </View>
                    ) : (
                      <Money
                        variant="bodyStrong"
                        fitWidth={walletTileInnerW}
                        fitVariants={WALLET_TILE_FIT}
                        amountMinor={Math.abs(entry.balanceMinor)}
                        prefix={entry.balanceMinor < 0 ? '−' : ''}
                        currency={settings.currency}
                        color={isAsset ? 'income' : 'text'}
                      />
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>
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
          dailyBudgetLimitMinor={dailyBudgetLimitMinor}
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
                          marginLeft: theme.geometry.dividerInsetNoTile,
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


      {/* Second shift: asks before recording another wage for today */}
      <Sheet
        testID="overview-wage-another-sheet"
        visible={anotherWageOpen}
        onClose={() => setAnotherWageOpen(false)}
        title={t('overview.wageAnotherTitle')}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="body" color="textSecondary">
            {t('overview.wageAnotherBody', { amount: wageAmountText })}
          </AppText>
          <Button
            testID="overview-wage-another-confirm"
            title={t('overview.wageAnotherConfirm')}
            disabled={wageSaving}
            onPress={() => {
              if (wageConfirmedRef.current) return;
              wageConfirmedRef.current = true;
              setAnotherWageOpen(false);
              void recordWage(true);
            }}
          />
          <Button
            testID="overview-wage-another-cancel"
            title={t('common.cancel')}
            variant="ghost"
            onPress={() => setAnotherWageOpen(false)}
          />
        </View>
      </Sheet>

      {/* Notices: every warning and nudge lives here, not between the hero and the day book */}
      <Sheet
        visible={noticesOpen}
        onClose={() => setNoticesOpen(false)}
        title={t('overview.noticesTitle')}
      >
        <View style={{ gap: theme.spacing.md }}>
      {summary.ignoredOtherCurrencyCount > 0 ? (
        <Banner
          tone="neutral"
          icon="info"
          message={t('overview.ignoredCurrencyBanner', {
            count: summary.ignoredOtherCurrencyCount,
          })}
        />
      ) : null}
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
          {noticeCount === 0 ? (
            <AppText variant="body" color="textSecondary">
              {t('overview.noticesEmpty')}
            </AppText>
          ) : null}
        </View>
      </Sheet>

      {/* "How these numbers work" bottom sheet */}
      <Sheet
        visible={howItWorksVisible}
        onClose={closeHowItWorks}
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
          onPress={closeHowItWorks}
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
    justifyContent: 'flex-end',
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
  wageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  wageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wageRecorded: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Wraps to a second line (2 x label line height 18 = 36 fits the 66 strip) instead of clipping.
  wageRecordedLabel: {
    flexShrink: 1,
  },
  wageAddAgain: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  walletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  walletGridTile: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  walletDueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  walletGridTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  walletAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
