import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatWalletSubtitle } from '@/domain/accounts';
import {
  addDays,
  formatFriendlyDate,
  formatFriendlyTime,
  formatShortDate,
  isDevice24HourClock,
  todayLocalDate,
} from '@/domain/dates';
import { resolveInsightsWindow } from '@/domain/insights';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import type {
  LocalDate,
  Transaction,
  TransactionType,
  Transfer,
  TxQuery,
  WeekStartDay,
} from '@/domain/types';
import { t } from '@/i18n';
import {
  type ActivityDatePreset,
  useActivityFilterStore,
} from '@/state/activityFilterStore';
import { useAppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { useTransactions } from '@/state/useTransactions';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Field } from '@/ui/Field';
import { hapticLight, hapticSelection } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen, useTabScrollPadding } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { WalletAvatar } from '@/ui/WalletAvatar';
import { PressableScale } from '@/ui/PressableScale';
import { DayBookView } from '@/ui/DayBookView';

function resolveDateRange(
  preset: ActivityDatePreset,
  customFrom: string,
  customTo: string,
  today: LocalDate,
  monthStartDay: number,
  weekStartsOn: WeekStartDay
): { fromIncl?: LocalDate; toExcl?: LocalDate } {
  switch (preset) {
    case 'all':
      return {};
    case 'today':
      return { fromIncl: today, toExcl: addDays(today, 1) };
    case 'this_week': {
      const w = resolveInsightsWindow('this_week', today, monthStartDay, undefined, weekStartsOn);
      return { fromIncl: w.fromIncl, toExcl: w.toExcl };
    }
    case 'this_month': {
      const w = resolveInsightsWindow('this_month', today, monthStartDay);
      return { fromIncl: w.fromIncl, toExcl: w.toExcl };
    }
    case 'last_month': {
      const w = resolveInsightsWindow('last_month', today, monthStartDay);
      return { fromIncl: w.fromIncl, toExcl: w.toExcl };
    }
    case 'custom': {
      const validFrom = customFrom ? (customFrom as LocalDate) : undefined;
      const validTo = customTo ? addDays(customTo as LocalDate, 1) : undefined;
      if (validFrom && validTo && customFrom > customTo) {
        return {};
      }
      return { fromIncl: validFrom, toExcl: validTo };
    }
  }
}

function buildTxQueryFromState(params: {
  search: string;
  type: TransactionType | null;
  categoryIds: string[];
  accountId: string | null | undefined;
  datePreset: ActivityDatePreset;
  customFromIncl: string;
  customToIncl: string;
  minAmountText: string;
  maxAmountText: string;
  today: LocalDate;
  monthStartDay: number;
  weekStartsOn: WeekStartDay;
}): TxQuery {
  const query: TxQuery = {};
  const s = params.search.trim();
  if (s) query.search = s;
  if (params.type) query.type = params.type;
  if (params.categoryIds.length === 1) {
    query.categoryId = params.categoryIds[0];
  } else if (params.categoryIds.length > 1) {
    query.categoryIds = params.categoryIds;
  }
  if (params.accountId !== undefined) {
    query.accountId = params.accountId;
  }

  const bounds = resolveDateRange(
    params.datePreset,
    params.customFromIncl,
    params.customToIncl,
    params.today,
    params.monthStartDay,
    params.weekStartsOn
  );
  if (bounds.fromIncl) query.fromIncl = bounds.fromIncl;
  if (bounds.toExcl) query.toExcl = bounds.toExcl;

  const minRes = params.minAmountText.trim()
    ? parseMoneyInput(params.minAmountText)
    : null;
  if (minRes?.ok && minRes.minor !== null && minRes.minor > 0) {
    query.minAmountMinor = minRes.minor;
  }

  const maxRes = params.maxAmountText.trim()
    ? parseMoneyInput(params.maxAmountText)
    : null;
  if (maxRes?.ok && maxRes.minor !== null && maxRes.minor > 0) {
    query.maxAmountMinor = maxRes.minor;
  }

  return query;
}

type LedgerRowItem =
  | { kind: 'tx'; id: string; tx: Transaction; createdAt: number }
  | { kind: 'transfer'; id: string; transfer: Transfer; createdAt: number };

interface ActivitySection {
  group: {
    date: LocalDate;
    incomeMinor: number;
    expenseMinor: number;
  };
  data: LedgerRowItem[];
}

function AllEntriesScreen({ header }: { header: React.ReactNode }) {
  const { repo, settings } = useAppContext();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const tabScrollPadding = useTabScrollPadding();
  const use24Hour = isDevice24HourClock();

  const {
    search,
    type,
    categoryId,
    categoryIds,
    accountId,
    datePreset,
    customFromIncl,
    customToIncl,
    minAmountText,
    maxAmountText,
    setSearch,
    setType,
    setCategoryIds,
    setAccountId,
    setDatePreset,
    setCustomFromIncl,
    setCustomToIncl,
    setMinAmountText,
    setMaxAmountText,
    applyExternalFilters,
    resetAll,
  } = useActivityFilterStore();

  const effectiveCategoryIds = useMemo(() => {
    if (categoryIds.length > 0) return categoryIds;
    return categoryId ? [categoryId] : [];
  }, [categoryIds, categoryId]);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);

  // Filter sheet draft states
  const [draftType, setDraftType] = useState<TransactionType | null>(type);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(effectiveCategoryIds);
  const [draftAccountId, setDraftAccountId] = useState<string | null | undefined>(accountId);
  const [draftPreset, setDraftPreset] = useState<ActivityDatePreset>(datePreset);
  const [draftFrom, setDraftFrom] = useState<LocalDate>(customFromIncl || todayLocalDate());
  const [draftTo, setDraftTo] = useState<LocalDate>(customToIncl || todayLocalDate());
  const [draftMin, setDraftMin] = useState(minAmountText);
  const [draftMax, setDraftMax] = useState(maxAmountText);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    const delay = search.trim().length === 0 ? 0 : 250;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, delay);
    return () => clearTimeout(timer);
  }, [search]);

  const today = todayLocalDate();

  const txQuery = useMemo<TxQuery>(
    () =>
      buildTxQueryFromState({
        search: debouncedSearch,
        type,
        categoryIds: effectiveCategoryIds,
        accountId,
        datePreset,
        customFromIncl,
        customToIncl,
        minAmountText,
        maxAmountText,
        today,
        monthStartDay: settings.monthStartDay,
        weekStartsOn: settings.weekStartsOn,
      }),
    [
      debouncedSearch,
      type,
      effectiveCategoryIds,
      accountId,
      datePreset,
      customFromIncl,
      customToIncl,
      minAmountText,
      maxAmountText,
      today,
      settings.monthStartDay,
      settings.weekStartsOn,
    ]
  );

  const {
    transfers,
    groups,
    summary,
    categoriesById,
    accounts,
    accountsById,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reload,
  } = useTransactions(txQuery);

  // Live preview count inside Filter Sheet
  useEffect(() => {
    if (!filterSheetOpen) return;
    let active = true;
    const draftQuery = buildTxQueryFromState({
      search,
      type: draftType,
      categoryIds: draftCategoryIds,
      accountId: draftAccountId,
      datePreset: draftPreset,
      customFromIncl: draftPreset === 'custom' ? draftFrom : '',
      customToIncl: draftPreset === 'custom' ? draftTo : '',
      minAmountText: draftMin,
      maxAmountText: draftMax,
      today,
      monthStartDay: settings.monthStartDay,
      weekStartsOn: settings.weekStartsOn,
    });
    repo
      .summarizeTransactions(draftQuery, settings.currency)
      .then((res) => {
        if (active) setDraftCount(res.count);
      })
      .catch(() => {
        // Ignore transient preview errors
      });
    return () => {
      active = false;
    };
  }, [
    filterSheetOpen,
    repo,
    settings.currency,
    settings.monthStartDay,
    settings.weekStartsOn,
    today,
    search,
    draftType,
    draftCategoryIds,
    draftAccountId,
    draftPreset,
    draftFrom,
    draftTo,
    draftMin,
    draftMax,
  ]);

  const allCategories = useMemo(
    () =>
      Array.from(categoriesById.values())
        .filter((c) => c.archivedAt == null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categoriesById]
  );

  const activeWallets = useMemo(
    () =>
      accounts
        .filter((a) => a.archivedAt == null)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [accounts]
  );

  const activeFilterCount =
    (type ? 1 : 0) +
    effectiveCategoryIds.length +
    (accountId !== undefined ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0) +
    (minAmountText.trim() ? 1 : 0) +
    (maxAmountText.trim() ? 1 : 0);

  const nonPeriodFilterCount =
    (type ? 1 : 0) +
    effectiveCategoryIds.length +
    (accountId !== undefined ? 1 : 0) +
    (minAmountText.trim() ? 1 : 0) +
    (maxAmountText.trim() ? 1 : 0);

  const hasAnyFilterOrSearch = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  const openFilterSheet = () => {
    setDraftType(type);
    setDraftCategoryIds(effectiveCategoryIds);
    setDraftAccountId(accountId);
    setDraftPreset(datePreset);
    setDraftFrom(customFromIncl || addDays(today, -30));
    setDraftTo(customToIncl || today);
    setDraftMin(minAmountText);
    setDraftMax(maxAmountText);
    setSheetError(null);
    setDraftCount(summary.count);
    setFilterSheetOpen(true);
  };

  const handleToggleDraftCategory = (catId: string) => {
    hapticSelection();
    setDraftCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleResetDraft = () => {
    hapticLight();
    setDraftType(null);
    setDraftCategoryIds([]);
    setDraftAccountId(undefined);
    setDraftPreset('all');
    setDraftFrom(addDays(today, -30));
    setDraftTo(today);
    setDraftMin('');
    setDraftMax('');
    setSheetError(null);
  };

  const handleApplyFilters = () => {
    if (draftPreset === 'custom' && draftFrom > draftTo) {
      setSheetError(t('activity.invalidCustomDates'));
      return;
    }

    applyExternalFilters({
      search,
      type: draftType,
      categoryIds: draftCategoryIds,
      accountId: draftAccountId,
      datePreset: draftPreset,
      customFromIncl: draftPreset === 'custom' ? draftFrom : '',
      customToIncl: draftPreset === 'custom' ? draftTo : '',
      minAmountText: draftMin.trim(),
      maxAmountText: draftMax.trim(),
    });
    setFilterSheetOpen(false);
  };

  const minParsed = minAmountText.trim() ? parseMoneyInput(minAmountText) : null;
  const maxParsed = maxAmountText.trim() ? parseMoneyInput(maxAmountText) : null;

  const sections = useMemo<ActivitySection[]>(() => {
    const searchNeedle = debouncedSearch.trim().toLowerCase();
    const minVal = minParsed?.ok && minParsed.minor && minParsed.minor > 0 ? minParsed.minor : null;
    const maxVal = maxParsed?.ok && maxParsed.minor && maxParsed.minor > 0 ? maxParsed.minor : null;

    const visibleTransfers = transfers.filter((tr) => {
      if (tr.deletedAt != null) return false;
      if (minVal !== null && tr.amountMinor < minVal) return false;
      if (maxVal !== null && tr.amountMinor > maxVal) return false;
      if (searchNeedle) {
        const fromName = accountsById.get(tr.fromAccountId)?.name ?? '';
        const toName = accountsById.get(tr.toAccountId)?.name ?? '';
        const hay = `${fromName} ${toName} ${tr.note} transfer`.toLowerCase();
        if (!hay.includes(searchNeedle)) return false;
      }
      return true;
    });

    const visibleTransferIds = new Set(visibleTransfers.map((tr) => tr.id));
    const bucketMap = new Map<
      LocalDate,
      { incomeMinor: number; expenseMinor: number; items: LedgerRowItem[] }
    >();

    for (const g of groups) {
      const items: LedgerRowItem[] = [];
      for (const tx of g.transactions) {
        if (tx.transferId && visibleTransferIds.has(tx.transferId)) {
          continue;
        }
        items.push({ kind: 'tx', id: `tx_${tx.id}`, tx, createdAt: tx.createdAt });
      }
      bucketMap.set(g.date, {
        incomeMinor: g.incomeMinor,
        expenseMinor: g.expenseMinor,
        items,
      });
    }

    for (const tr of visibleTransfers) {
      let bucket = bucketMap.get(tr.occurredOn);
      if (!bucket) {
        bucket = { incomeMinor: 0, expenseMinor: 0, items: [] };
        bucketMap.set(tr.occurredOn, bucket);
      }
      bucket.items.push({
        kind: 'transfer',
        id: `tr_${tr.id}`,
        transfer: tr,
        createdAt: tr.createdAt,
      });
    }

    return Array.from(bucketMap.entries())
      .filter(([, b]) => b.items.length > 0)
      .sort(([da], [db]) => db.localeCompare(da))
      .map(([date, b]) => ({
        group: {
          date,
          incomeMinor: b.incomeMinor,
          expenseMinor: b.expenseMinor,
        },
        data: [...b.items].sort((a, bb) => {
          if (a.createdAt !== bb.createdAt) return bb.createdAt - a.createdAt;
          return bb.id.localeCompare(a.id);
        }),
      }));
  }, [groups, transfers, debouncedSearch, minParsed, maxParsed, accountsById]);

  const periodLabel = useMemo(() => {
    switch (datePreset) {
      case 'today':
        return t('activity.dateToday');
      case 'this_week':
        return t('activity.dateThisWeek');
      case 'this_month':
        return t('activity.dateThisMonth');
      case 'last_month':
        return t('activity.dateLastMonth');
      case 'custom':
        if (customFromIncl && customToIncl) {
          return `${formatShortDate(customFromIncl)} – ${formatShortDate(customToIncl)}`;
        }
        return t('activity.dateCustom');
      default:
        return t('activity.dateAll');
    }
  }, [datePreset, customFromIncl, customToIncl]);

  const searchBg =
    theme.scheme === 'dark' ? theme.colors.surfaceSunken : theme.colors.surface;

  return (
    <Screen contentContainerStyle={{ paddingBottom: 0 }}>
      <View style={{ marginBottom: theme.spacing.md }}>{header}</View>

      {/* Search + Filter icon button with badge */}
      <View style={[styles.searchRow, { gap: theme.spacing.sm, marginBottom: theme.spacing.md }]}>
        <View
          style={[
            styles.searchBox,
            {
              height: 44,
              borderRadius: theme.radius.md,
              backgroundColor: searchBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.separator,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <AppIcon name="search" size={18} color={theme.colors.textTertiary} />
          <TextInput
            testID="activity-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder={t('activity.searchPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="search"
            style={[
              styles.searchInput,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.body.fontFamily,
                fontSize: theme.typography.body.fontSize,
              },
              Platform.OS === 'web'
                ? ({ outlineStyle: 'none', outlineWidth: 0 } as never)
                : null,
            ]}
          />
          {search.length > 0 ? (
            <PressableScale pressScale={0.98}
              testID="activity-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              onPress={() => setSearch('')}
            >
              <AppIcon name="x" size={16} color={theme.colors.textTertiary} />
            </PressableScale>
          ) : null}
        </View>

        <IconButton
          testID="activity-filter-button"
          icon="sliders-horizontal"
          variant={activeFilterCount > 0 ? 'accentSoft' : 'surface'}
          size={44}
          iconSize={20}
          badgeCount={activeFilterCount > 0 ? activeFilterCount : undefined}
          accessibilityLabel={t('activity.filtersButton')}
          onPress={openFilterSheet}
        />
      </View>

      {/* Horizontal underlined wallet filter tabs */}
      {activeWallets.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[
            styles.underlineTabsScroll,
            {
              marginBottom: theme.spacing.sm,
              borderBottomColor: theme.colors.separator,
            },
          ]}
          contentContainerStyle={[
            styles.underlineTabsRow,
            { gap: theme.spacing.md },
          ]}
        >
          <PressableScale pressScale={0.98}
            testID="ledger-wallet-tab-all"
            accessibilityRole="tab"
            accessibilityState={{ selected: accountId === undefined }}
            onPress={() => {
              hapticSelection();
              setAccountId(undefined);
            }}
            style={({ pressed }) => [
              styles.underlineTab,
              {
                borderBottomColor:
                  accountId === undefined ? theme.colors.text : 'transparent',
                opacity: pressed && !reducedMotion ? 0.72 : 1,
              },
            ]}
          >
            <AppText
              variant="label"
              color={accountId === undefined ? 'text' : 'textSecondary'}
              numberOfLines={1}
            >
              {t('activity.allWalletsTab')}
            </AppText>
          </PressableScale>

          {activeWallets.map((w) => {
            const selected = accountId === w.id;
            return (
              <PressableScale pressScale={0.98}
                key={w.id}
                testID={`ledger-wallet-tab-${w.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  setAccountId(selected ? undefined : w.id);
                }}
                style={({ pressed }) => [
                  styles.underlineTab,
                  {
                    borderBottomColor: selected ? theme.colors.text : 'transparent',
                    opacity: pressed && !reducedMotion ? 0.72 : 1,
                  },
                ]}
              >
                <AppText
                  variant="label"
                  color={selected ? 'text' : 'textSecondary'}
                  numberOfLines={1}
                >
                  {w.name}
                </AppText>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Period selector chip + live summary */}
      <View style={[styles.summaryBar, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
        <PressableScale pressScale={0.98}
          testID="activity-period-chip"
          accessibilityRole="button"
          accessibilityLabel={periodLabel}
          onPress={() => {
            hapticLight();
            setPeriodSheetOpen(true);
          }}
          style={({ pressed }) => [
            styles.periodPill,
            {
              backgroundColor:
                datePreset !== 'all'
                  ? theme.colors.accentSoft
                  : theme.colors.surfaceSunken,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
              opacity: pressed && !reducedMotion ? 0.72 : 1,
            },
          ]}
        >
          <AppText
            variant="label"
            color={datePreset !== 'all' ? 'accent' : 'text'}
            numberOfLines={1}
          >
            {periodLabel}
          </AppText>
          <AppIcon
            name="chevron-down"
            size={14}
            color={datePreset !== 'all' ? theme.colors.accent : theme.colors.textSecondary}
          />
        </PressableScale>

        <AppText
          testID="activity-summary-line"
          variant="label"
          color="textSecondary"
          tabularNums
          style={styles.summaryRight}
        >
          {t('activity.summaryLine', {
            spent: formatMoney(summary.expenseMinor, settings.currency, {
              hidden: hideAmounts,
              showPoisha,
            }),
            income: formatMoney(summary.incomeMinor, settings.currency, {
              hidden: hideAmounts,
              showPoisha,
            }),
          })}
        </AppText>
      </View>

      {/* Dismissible active filter chips */}
      {nonPeriodFilterCount > 0 ? (
        <View
          style={[
            styles.activeChipsWrap,
            { gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
          ]}
        >
          {type ? (
            <Chip
              testID="active-chip-type"
              label={`${type === 'expense' ? t('common.expense') : t('common.income')} ×`}
              selected
              onPress={() => setType(null)}
            />
          ) : null}
          {accountId !== undefined ? (
            <Chip
              testID="active-chip-wallet"
              label={`${
                accountId === null
                  ? t('tx.noWallet')
                  : accountsById.get(accountId)?.name ?? t('tx.walletLabel')
              } ×`}
              selected
              onPress={() => setAccountId(undefined)}
            />
          ) : null}
          {effectiveCategoryIds.map((id) => (
            <Chip
              key={id}
              testID={`active-chip-cat-${id}`}
              label={`${categoriesById.get(id)?.name ?? t('common.uncategorized')} ×`}
              selected
              onPress={() =>
                setCategoryIds(effectiveCategoryIds.filter((existing) => existing !== id))
              }
            />
          ))}
          {minParsed?.ok && minParsed.minor ? (
            <Chip
              testID="active-chip-min"
              label={`≥ ${formatMoney(minParsed.minor, settings.currency)} ×`}
              selected
              onPress={() => setMinAmountText('')}
            />
          ) : null}
          {maxParsed?.ok && maxParsed.minor ? (
            <Chip
              testID="active-chip-max"
              label={`≤ ${formatMoney(maxParsed.minor, settings.currency)} ×`}
              selected
              onPress={() => setMaxAmountText('')}
            />
          ) : null}
          <Chip
            testID="activity-reset-all-chip"
            label={t('activity.resetFilters')}
            onPress={() => resetAll()}
          />
        </View>
      ) : null}

      {error && sections.length === 0 ? (
        <ErrorState
          title={t('error.genericTitle')}
          body={t('error.genericBody')}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      ) : !loading && sections.length === 0 ? (
        hasAnyFilterOrSearch ? (
          <EmptyState
            icon="search"
            title={t('activity.emptyFilterTitle')}
            body={t('activity.emptyFilterBody')}
            ctaLabel={t('activity.resetFilters')}
            onCtaPress={() => resetAll()}
          />
        ) : (
          <EmptyState
            icon="list"
            title={t('empty.activityTitle')}
            body={t('empty.activityBody')}
            ctaLabel={t('empty.activityCta')}
            onCtaPress={() => router.push('/transaction/new')}
          />
        )
      ) : (
        <SectionList<LedgerRowItem, ActivitySection>
          testID="activity-flatlist"
          style={styles.flexOne}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          windowSize={9}
          // Fabric on Android throws IndexOutOfBoundsException in ReactClippingViewManager when clipped subviews update
          removeClippedSubviews={false}
          contentContainerStyle={{
            paddingBottom: tabScrollPadding,
          }}
          renderSectionHeader={({ section }) => {
            const netMinor =
              section.group.incomeMinor - section.group.expenseMinor;
            return (
              <View
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: theme.colors.bg,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xs,
                    paddingHorizontal: 2,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color="textTertiary"
                  style={styles.sectionDateText}
                >
                  {formatFriendlyDate(section.group.date, today).toUpperCase()}
                </AppText>
                <Money
                  variant="caption"
                  amountMinor={Math.abs(netMinor)}
                  currency={settings.currency}
                  prefix={netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}
                  color={netMinor > 0 ? 'accent' : 'textSecondary'}
                />
              </View>
            );
          }}
          renderItem={({ item, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;
            const cardRadiusStyle = {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: isFirst ? theme.radius.card : 0,
              borderTopRightRadius: isFirst ? theme.radius.card : 0,
              borderBottomLeftRadius: isLast ? theme.radius.card : 0,
              borderBottomRightRadius: isLast ? theme.radius.card : 0,
              overflow: 'hidden' as const,
            };

            if (item.kind === 'transfer') {
              const tr = item.transfer;
              const fromAcc = accountsById.get(tr.fromAccountId);
              const toAcc = accountsById.get(tr.toAccountId);
              const fromName = fromAcc?.name ?? t('tx.walletLabel');
              const toName = toAcc?.name ?? t('tx.walletLabel');
              const isCashOut =
                fromAcc?.kind === 'mobile_wallet' && toAcc?.kind === 'cash';

              const subParts: string[] = [];
              if (tr.feeMinor > 0) {
                const feeStr = formatMoney(tr.feeMinor, settings.currency, {
                  hidden: hideAmounts,
                  showPoisha,
                });
                subParts.push(
                  isCashOut
                    ? t('activity.cashOutWithFeeSub', { fee: feeStr })
                    : t('activity.transferWithFeeSub', { fee: feeStr })
                );
              } else {
                subParts.push(t('activity.transferSub'));
              }
              if (tr.note.trim()) {
                subParts.push(tr.note.trim());
              }
              subParts.push(
                tr.occurredTime
                  ? formatFriendlyTime(tr.occurredTime, use24Hour)
                  : formatShortDate(tr.occurredOn)
              );

              return (
                <View style={cardRadiusStyle}>
                  <ListRow
                    testID={`activity-transfer-${tr.id}`}
                    title={t('activity.transferTitle', {
                      from: fromName,
                      to: toName,
                    })}
                    subtitle={subParts.join(' · ')}
                    left={
                      <IconTile
                        icon="arrow-left-right"
                        colorKey="gray"
                        size="md"
                      />
                    }
                    right={
                      <View style={styles.transferAmtCol}>
                        <Money
                          amountMinor={tr.amountMinor}
                          currency={settings.currency}
                          variant="bodyStrong"
                          color="text"
                        />
                        <AppText variant="caption" color="textTertiary">
                          {t('activity.transferBadge')}
                        </AppText>
                      </View>
                    }
                    showDivider={!isLast}
                    onPress={() =>
                      router.push({
                        pathname: '/transfer/[id]',
                        params: { id: tr.id },
                      })
                    }
                  />
                </View>
              );
            }

            const tx = item.tx;
            const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
            const catLabel = cat?.name ?? t('common.uncategorized');
            const wallet = tx.accountId ? accountsById.get(tx.accountId) : undefined;
            const subtitleParts = [catLabel];
            if (cat?.archivedAt) subtitleParts.push(t('categories.archivedBadge'));
            if (wallet) subtitleParts.push(formatWalletSubtitle(wallet));
            subtitleParts.push(
              tx.occurredTime
                ? formatFriendlyTime(tx.occurredTime, use24Hour)
                : formatShortDate(tx.occurredOn)
            );
            const isIncome = tx.type === 'income';

            return (
              <View style={cardRadiusStyle}>
                <ListRow
                  testID={`activity-tx-${tx.id}`}
                  title={tx.description.trim() || catLabel}
                  subtitle={subtitleParts.join(' · ')}
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
                      variant="bodyStrong"
                      color={isIncome ? 'accent' : 'text'}
                      prefix={isIncome ? '+' : '−'}
                    />
                  }
                  showDivider={!isLast}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: tx.id },
                    })
                  }
                />
              </View>
            );
          }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              void loadMore();
            }
          }}
          ListFooterComponent={
            hasMore ? (
              <View style={{ paddingTop: theme.spacing.md }}>
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
      )}

      {/* Quick period selector sheet */}
      <Sheet
        visible={periodSheetOpen}
        onClose={() => setPeriodSheetOpen(false)}
        title={t('activity.choosePeriodTitle')}
      >
        <Surface padded={false}>
          {(
            [
              ['all', t('activity.dateAll')],
              ['today', t('activity.dateToday')],
              ['this_week', t('activity.dateThisWeek')],
              ['this_month', t('activity.dateThisMonth')],
              ['last_month', t('activity.dateLastMonth')],
              ['custom', t('activity.dateCustom')],
            ] as const
          ).map(([val, label], idx, arr) => (
            <ListRow
              key={val}
              testID={`activity-period-opt-${val}`}
              compact
              title={label}
              right={
                datePreset === val ? (
                  <AppIcon name="check" size={18} color={theme.colors.accent} />
                ) : null
              }
              showDivider={idx < arr.length - 1}
              onPress={() => {
                setPeriodSheetOpen(false);
                if (val === 'custom') {
                  openFilterSheet();
                  setDraftPreset('custom');
                } else {
                  setDatePreset(val);
                  if (customFromIncl) setCustomFromIncl('');
                  if (customToIncl) setCustomToIncl('');
                }
              }}
            />
          ))}
        </Surface>
      </Sheet>

      {/* Filters bottom sheet */}
      <Sheet
        testID="activity-filters-sheet"
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title={t('activity.filtersTitle')}
        footer={
          <View style={[styles.twoColRow, { gap: theme.spacing.sm }]}>
            <Button
              testID="filter-reset-btn"
              title={t('activity.resetFilters')}
              variant="secondary"
              onPress={handleResetDraft}
              style={styles.flexOne}
            />
            <Button
              testID="filter-apply-btn"
              title={t('activity.showResults', { count: draftCount ?? summary.count })}
              variant="primary"
              onPress={handleApplyFilters}
              style={styles.applyBtn}
            />
          </View>
        }
      >
        {/* Type */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('activity.filterType')}
          </AppText>
          <SegmentedControl<'all' | TransactionType>
            testID="filter-type-segmented"
            value={draftType ?? 'all'}
            onChange={(val) => setDraftType(val === 'all' ? null : val)}
            options={[
              { value: 'all', label: t('activity.filterTypeAll') },
              { value: 'expense', label: t('common.expense') },
              { value: 'income', label: t('common.income') },
            ]}
          />
        </View>

        {/* Wallets */}
        {accounts.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textSecondary">
              {t('activity.filterWallet')}
            </AppText>
            <View style={[styles.wrapChips, { gap: theme.spacing.xs }]}>
              <Chip
                testID="filter-wallet-all"
                label={t('activity.filterAllWallets')}
                selected={draftAccountId === undefined}
                onPress={() => setDraftAccountId(undefined)}
              />
              <Chip
                testID="filter-wallet-none"
                label={t('tx.noWallet')}
                selected={draftAccountId === null}
                onPress={() => setDraftAccountId(null)}
              />
              {activeWallets.map((w) => {
                const selected = draftAccountId === w.id;
                return (
                  <PressableScale pressScale={0.98}
                    key={w.id}
                    testID={`filter-wallet-${w.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      hapticSelection();
                      setDraftAccountId(selected ? undefined : w.id);
                    }}
                    style={({ pressed }) => [
                      styles.categoryTileBtn,
                      {
                        minHeight: 40,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xs,
                        borderRadius: theme.radius.pill,
                        backgroundColor: selected
                          ? theme.colors.accentSoft
                          : theme.colors.surfaceSunken,
                        borderColor: selected
                          ? theme.colors.accent
                          : theme.colors.separator,
                        gap: theme.spacing.xs,
                        opacity: pressed && !reducedMotion ? 0.72 : 1,
                      },
                    ]}
                  >
                    <WalletAvatar account={w} size="xs" />
                    <AppText
                      variant="label"
                      color={selected ? 'accent' : 'text'}
                    >
                      {w.name}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Categories multi-select tiles */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('activity.filterCategory')}
          </AppText>
          <View style={[styles.categoryGrid, { gap: theme.spacing.xs }]}>
            {allCategories.map((c) => {
              const selected = draftCategoryIds.includes(c.id);
              return (
                <PressableScale pressScale={0.98}
                  key={c.id}
                  testID={`filter-cat-${c.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => handleToggleDraftCategory(c.id)}
                  style={({ pressed }) => [
                    styles.categoryTileBtn,
                    {
                      backgroundColor: selected
                        ? theme.colors.accentSoft
                        : theme.colors.surfaceSunken,
                      borderColor: selected ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.pill,
                      paddingLeft: 6,
                      paddingRight: theme.spacing.md,
                      paddingVertical: 6,
                      gap: theme.spacing.xs + 2,
                      opacity: pressed && !reducedMotion ? 0.72 : 1,
                    },
                  ]}
                >
                  <IconTile
                    icon={c.icon}
                    colorKey={c.colorKey}
                    size="sm"
                    selected={selected}
                  />
                  <AppText
                    variant="label"
                    color={selected ? 'accent' : 'text'}
                    numberOfLines={1}
                  >
                    {c.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* Date range presets + DateFields */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('activity.filterDateRange')}
          </AppText>
          <View style={[styles.wrapChips, { gap: theme.spacing.xs }]}>
            {(
              [
                ['all', t('activity.dateAll')],
                ['today', t('activity.dateToday')],
                ['this_week', t('activity.dateThisWeek')],
                ['this_month', t('activity.dateThisMonth')],
                ['last_month', t('activity.dateLastMonth')],
                ['custom', t('activity.dateCustom')],
              ] as const
            ).map(([presetVal, presetLabel]) => (
              <Chip
                key={presetVal}
                testID={`filter-date-${presetVal}`}
                label={presetLabel}
                selected={draftPreset === presetVal}
                onPress={() => {
                  setDraftPreset(presetVal);
                  setSheetError(null);
                }}
              />
            ))}
          </View>

          {draftPreset === 'custom' ? (
            <View style={[styles.twoColRow, { gap: theme.spacing.sm, marginTop: theme.spacing.xs }]}>
              <View style={[styles.flexOne, { gap: 4 }]}>
                <AppText variant="caption" color="textSecondary">
                  {t('activity.fromDateLabel')}
                </AppText>
                <DateField
                  testID="filter-custom-from"
                  value={draftFrom}
                  today={today}
                  onChange={(d) => {
                    setDraftFrom(d);
                    if (sheetError) setSheetError(null);
                  }}
                />
              </View>
              <View style={[styles.flexOne, { gap: 4 }]}>
                <AppText variant="caption" color="textSecondary">
                  {t('activity.toDateLabel')}
                </AppText>
                <DateField
                  testID="filter-custom-to"
                  value={draftTo}
                  today={today}
                  onChange={(d) => {
                    setDraftTo(d);
                    if (sheetError) setSheetError(null);
                  }}
                />
              </View>
            </View>
          ) : null}
        </View>

        {/* Amount range */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('activity.filterAmountRange')}
          </AppText>
          <View style={[styles.twoColRow, { gap: theme.spacing.sm }]}>
            <View style={styles.flexOne}>
              <Field
                testID="filter-amount-min"
                value={draftMin}
                onChangeText={setDraftMin}
                placeholder={t('activity.minAmountLabel')}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.flexOne}>
              <Field
                testID="filter-amount-max"
                value={draftMax}
                onChangeText={setDraftMax}
                placeholder={t('activity.maxAmountLabel')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {sheetError ? (
          <AppText variant="caption" color="danger">
            {sheetError}
          </AppText>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ledgerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
  },
  summaryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  periodPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRight: {
    flexShrink: 1,
  },
  activeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionDateText: {
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryTileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  applyBtn: {
    flex: 2,
  },
  underlineTabsScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  underlineTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  underlineTab: {
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  transferAmtCol: {
    alignItems: 'flex-end',
  },
});

type LedgerMode = 'day' | 'all';

export default function LedgerScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<LedgerMode>('day');
  const externalFilterActive = useActivityFilterStore(
    (s) =>
      Boolean(s.type) ||
      s.categoryIds.length > 0 ||
      Boolean(s.categoryId) ||
      s.accountId !== undefined ||
      s.datePreset !== 'all' ||
      s.search.trim().length > 0
  );
  const [lastFilterActive, setLastFilterActive] = useState(externalFilterActive);
  if (externalFilterActive !== lastFilterActive) {
    // "See all" links from Home arrive with filters set: show them the full list.
    setLastFilterActive(externalFilterActive);
    if (externalFilterActive) setMode('all');
  }

  const header = (
    <View style={[styles.ledgerHeader, { gap: theme.spacing.md }]}>
      <AppText variant="title">{t('tabs.ledger')}</AppText>
      <SegmentedControl<LedgerMode>
        size="sm"
        testID="ledger-mode"
        value={mode}
        onChange={(next) => {
          hapticSelection();
          setMode(next);
        }}
        options={[
          { value: 'day', label: t('daybook.tabDay') },
          { value: 'all', label: t('daybook.tabAll') },
        ]}
      />
    </View>
  );

  if (mode === 'day') {
    return (
      <Screen contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
        <DayBookView header={header} />
      </Screen>
    );
  }
  return <AllEntriesScreen header={header} />;
}
