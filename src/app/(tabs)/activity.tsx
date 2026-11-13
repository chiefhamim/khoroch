import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DailyTransactionGroup } from '@/domain/calc';
import { addDays, isValidLocalDate, parseLocalDate, toEpochDay, todayLocalDate } from '@/domain/dates';
import { resolveInsightsWindow } from '@/domain/insights';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import type { LocalDate, TransactionType, TxQuery } from '@/domain/types';
import { t } from '@/i18n';
import {
  type ActivityDatePreset,
  useActivityFilterStore,
} from '@/state/activityFilterStore';
import { useAppContext } from '@/state/AppContext';
import { useTransactions } from '@/state/useTransactions';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { Screen, useTabScrollPadding } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';

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

function resolveDateRange(
  preset: ActivityDatePreset,
  customFrom: string,
  customTo: string,
  today: LocalDate,
  monthStartDay: number
): { fromIncl?: LocalDate; toExcl?: LocalDate } {
  switch (preset) {
    case 'all':
      return {};
    case 'today':
      return { fromIncl: today, toExcl: addDays(today, 1) };
    case 'this_week': {
      const w = resolveInsightsWindow('this_week', today, monthStartDay);
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
      const validFrom = isValidLocalDate(customFrom) ? customFrom : undefined;
      const validTo = isValidLocalDate(customTo) ? addDays(customTo, 1) : undefined;
      if (validFrom && validTo && customFrom > customTo) {
        return {};
      }
      return { fromIncl: validFrom, toExcl: validTo };
    }
  }
}

export default function ActivityScreen() {
  const { settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const tabScrollPadding = useTabScrollPadding();

  const {
    search,
    type,
    categoryId,
    datePreset,
    customFromIncl,
    customToIncl,
    minAmountText,
    maxAmountText,
    setSearch,
    setType,
    setCategoryId,
    setDatePreset,
    setCustomFromIncl,
    setCustomToIncl,
    setMinAmountText,
    setMaxAmountText,
    applyExternalFilters,
    resetAll,
  } = useActivityFilterStore();

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Modal draft states
  const [draftType, setDraftType] = useState<TransactionType | null>(type);
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(categoryId);
  const [draftPreset, setDraftPreset] = useState<ActivityDatePreset>(datePreset);
  const [draftFrom, setDraftFrom] = useState<string>(customFromIncl);
  const [draftTo, setDraftTo] = useState<string>(customToIncl);
  const [draftMin, setDraftMin] = useState(minAmountText);
  const [draftMax, setDraftMax] = useState(maxAmountText);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const delay = search.trim().length === 0 ? 0 : 250;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, delay);
    return () => clearTimeout(timer);
  }, [search]);

  const today = todayLocalDate();
  const yesterday = useMemo(() => addDays(today, -1), [today]);

  const txQuery = useMemo<TxQuery>(() => {
    const query: TxQuery = {};
    const s = debouncedSearch.trim();
    if (s) query.search = s;
    if (type) query.type = type;
    if (categoryId) query.categoryId = categoryId;

    const bounds = resolveDateRange(datePreset, customFromIncl, customToIncl, today, settings.monthStartDay);
    if (bounds.fromIncl) query.fromIncl = bounds.fromIncl;
    if (bounds.toExcl) query.toExcl = bounds.toExcl;

    const minRes = minAmountText.trim() ? parseMoneyInput(minAmountText) : null;
    if (minRes?.ok && minRes.minor) query.minAmountMinor = minRes.minor;

    const maxRes = maxAmountText.trim() ? parseMoneyInput(maxAmountText) : null;
    if (maxRes?.ok && maxRes.minor) query.maxAmountMinor = maxRes.minor;

    return query;
  }, [
    debouncedSearch,
    type,
    categoryId,
    datePreset,
    customFromIncl,
    customToIncl,
    today,
    settings.monthStartDay,
    minAmountText,
    maxAmountText,
  ]);

  const {
    groups,
    categoriesById,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reload,
  } = useTransactions(txQuery);

  const allCategories = useMemo(
    () =>
      Array.from(categoriesById.values()).sort((a, b) => a.sortOrder - b.sortOrder),
    [categoriesById]
  );

  const activeFilterCount =
    (type ? 1 : 0) +
    (categoryId ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0) +
    (minAmountText.trim() ? 1 : 0) +
    (maxAmountText.trim() ? 1 : 0);

  const hasAnyFilterOrSearch = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  const openFilterModal = () => {
    setDraftType(type);
    setDraftCategoryId(categoryId);
    setDraftPreset(datePreset);
    setDraftFrom(customFromIncl);
    setDraftTo(customToIncl);
    setDraftMin(minAmountText);
    setDraftMax(maxAmountText);
    setModalError(null);
    setFilterModalOpen(true);
  };

  const handleApplyModalFilters = () => {
    if (draftPreset === 'custom') {
      const hasFrom = draftFrom.trim().length > 0;
      const hasTo = draftTo.trim().length > 0;
      if (
        (hasFrom && !isValidLocalDate(draftFrom.trim())) ||
        (hasTo && !isValidLocalDate(draftTo.trim())) ||
        (hasFrom && hasTo && draftFrom.trim() > draftTo.trim())
      ) {
        setModalError(t('activity.invalidCustomDates'));
        return;
      }
    }

    applyExternalFilters({
      search,
      type: draftType,
      categoryId: draftCategoryId,
      datePreset: draftPreset,
      customFromIncl: (draftFrom.trim() as LocalDate | ''),
      customToIncl: (draftTo.trim() as LocalDate | ''),
      minAmountText: draftMin.trim(),
      maxAmountText: draftMax.trim(),
    });
    setFilterModalOpen(false);
  };

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

  const datePresetLabel = (() => {
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
        if (customFromIncl && customToIncl) return `${customFromIncl} – ${customToIncl}`;
        return customFromIncl || customToIncl || t('activity.dateCustom');
      default:
        return '';
    }
  })();

  const minParsed = minAmountText.trim() ? parseMoneyInput(minAmountText) : null;
  const maxParsed = maxAmountText.trim() ? parseMoneyInput(maxAmountText) : null;

  return (
    <Screen contentContainerStyle={{ paddingBottom: 0 }}>
      <View style={[styles.headerRow, { paddingBottom: theme.spacing.sm }]}>
        <AppText variant="title">{t('activity.title')}</AppText>
      </View>

      {/* Search & Filter trigger bar kept outside FlatList to preserve TextInput focus */}
      <View style={[styles.searchRow, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
        <View
          style={[
            styles.searchBox,
            {
              flex: 1,
              minWidth: 0,
              minHeight: theme.touch.min,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.xs,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            testID="activity-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder={t('activity.searchPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="search"
            style={[
              styles.searchInput,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.body.fontFamily,
                fontSize: theme.typography.body.fontSize,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          />
          {search.length > 0 ? (
            <Pressable
              testID="activity-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setSearch('')}
              style={[styles.clearIconBtn, { minWidth: theme.touch.min, minHeight: theme.touch.min }]}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          testID="activity-filter-button"
          accessibilityRole="button"
          accessibilityLabel={t('activity.filtersButton')}
          onPress={openFilterModal}
          style={[
            styles.filterBtn,
            {
              minHeight: theme.touch.min,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor:
                activeFilterCount > 0 ? theme.colors.primarySoft : theme.colors.surface,
              borderColor:
                activeFilterCount > 0 ? theme.colors.primary : theme.colors.border,
              gap: theme.spacing.xs,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? theme.colors.primary : theme.colors.text}
          />
          <AppText
            variant="label"
            color={activeFilterCount > 0 ? 'primary' : 'text'}
          >
            {activeFilterCount > 0
              ? t('activity.filtersActiveCount', { count: activeFilterCount })
              : t('activity.filtersButton')}
          </AppText>
        </Pressable>
      </View>

      {/* Active filter chips */}
      {hasAnyFilterOrSearch ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.activeChipsRow,
            { gap: theme.spacing.xs, paddingBottom: theme.spacing.sm },
          ]}
          style={{ flexGrow: 0 }}
        >
          {type ? (
            <Chip
              testID="active-chip-type"
              label={`${type === 'expense' ? t('common.expense') : t('common.income')} ×`}
              selected
              onPress={() => setType(null)}
            />
          ) : null}
          {categoryId ? (
            <Chip
              testID="active-chip-category"
              label={`${categoriesById.get(categoryId)?.name ?? t('common.uncategorized')} ×`}
              selected
              onPress={() => setCategoryId(null)}
            />
          ) : null}
          {datePreset !== 'all' ? (
            <Chip
              testID="active-chip-date"
              label={`${datePresetLabel} ×`}
              selected
              onPress={() => {
                setDatePreset('all');
                setCustomFromIncl('');
                setCustomToIncl('');
              }}
            />
          ) : null}
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
        </ScrollView>
      ) : null}

      {error && groups.length === 0 ? (
        <ErrorState
          title={t('error.genericTitle')}
          body={t('error.genericBody')}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      ) : !loading && groups.length === 0 ? (
        hasAnyFilterOrSearch ? (
          <EmptyState
            icon="search-outline"
            title={t('activity.emptyFilterTitle')}
            body={t('activity.emptyFilterBody')}
            ctaLabel={t('activity.resetFilters')}
            onCtaPress={() => resetAll()}
          />
        ) : (
          <EmptyState
            icon="receipt-outline"
            title={t('empty.activityTitle')}
            body={t('empty.activityBody')}
            ctaLabel={t('empty.activityCta')}
            onCtaPress={() => router.push('/transaction/new')}
          />
        )
      ) : (
        <FlatList
          testID="activity-flatlist"
          data={groups}
          keyExtractor={(item) => item.date}
          renderItem={renderGroup}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews={Platform.OS !== 'web'}
          contentContainerStyle={{
            gap: theme.spacing.lg,
            paddingBottom: tabScrollPadding,
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
      )}

      {filterModalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setFilterModalOpen(false)}
        >
          <View style={[styles.modalBackdrop, { padding: theme.spacing.xl }]}>
            <Card
              style={[
                styles.modalCard,
                { maxHeight: '85%', gap: theme.spacing.md },
              ]}
            >
              <View style={styles.modalHeader}>
                <AppText variant="title">{t('activity.filtersTitle')}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  onPress={() => setFilterModalOpen(false)}
                  style={{ minWidth: theme.touch.min, minHeight: theme.touch.min, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('activity.filterType')}
                  </AppText>
                  <SegmentedControl<'all' | TransactionType>
                    value={draftType ?? 'all'}
                    onChange={(val) => {
                      const next = val === 'all' ? null : val;
                      setDraftType(next);
                    }}
                    options={[
                      { value: 'all', label: t('activity.filterTypeAll') },
                      { value: 'expense', label: t('common.expense') },
                      { value: 'income', label: t('common.income') },
                    ]}
                  />
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('activity.filterDateRange')}
                  </AppText>
                  <View style={[styles.wrapChips, { gap: theme.spacing.sm }]}>
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
                          setModalError(null);
                        }}
                      />
                    ))}
                  </View>

                  {draftPreset === 'custom' ? (
                    <View style={[styles.rangeInputsRow, { gap: theme.spacing.sm }]}>
                      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
                        <AppText variant="caption" color="textMuted">
                          {t('activity.fromDateLabel')}
                        </AppText>
                        <TextInput
                          testID="filter-custom-from"
                          value={draftFrom}
                          onChangeText={(txt) => {
                            setDraftFrom(txt);
                            if (modalError) setModalError(null);
                          }}
                          placeholder={t('common.dateFormatHint')}
                          placeholderTextColor={theme.colors.textMuted}
                          style={[
                            styles.modalInput,
                            {
                              minHeight: theme.touch.min,
                              borderRadius: theme.radius.md,
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.surfaceAlt,
                              paddingHorizontal: theme.spacing.md,
                              color: theme.colors.text,
                              fontFamily: theme.typography.body.fontFamily,
                              fontSize: theme.typography.body.fontSize,
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xs }}>
                        <AppText variant="caption" color="textMuted">
                          {t('activity.toDateLabel')}
                        </AppText>
                        <TextInput
                          testID="filter-custom-to"
                          value={draftTo}
                          onChangeText={(txt) => {
                            setDraftTo(txt);
                            if (modalError) setModalError(null);
                          }}
                          placeholder={t('common.dateFormatHint')}
                          placeholderTextColor={theme.colors.textMuted}
                          style={[
                            styles.modalInput,
                            {
                              minHeight: theme.touch.min,
                              borderRadius: theme.radius.md,
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.surfaceAlt,
                              paddingHorizontal: theme.spacing.md,
                              color: theme.colors.text,
                              fontFamily: theme.typography.body.fontFamily,
                              fontSize: theme.typography.body.fontSize,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('activity.filterAmountRange')}
                  </AppText>
                  <View style={[styles.rangeInputsRow, { gap: theme.spacing.sm }]}>
                    <TextInput
                      testID="filter-amount-min"
                      value={draftMin}
                      onChangeText={setDraftMin}
                      placeholder={t('activity.minAmountLabel')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[
                        styles.modalInput,
                        {
                          flex: 1,
                          minWidth: 0,
                          minHeight: theme.touch.min,
                          borderRadius: theme.radius.md,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surfaceAlt,
                          paddingHorizontal: theme.spacing.md,
                          color: theme.colors.text,
                          fontFamily: theme.typography.body.fontFamily,
                          fontSize: theme.typography.body.fontSize,
                        },
                      ]}
                    />
                    <TextInput
                      testID="filter-amount-max"
                      value={draftMax}
                      onChangeText={setDraftMax}
                      placeholder={t('activity.maxAmountLabel')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="decimal-pad"
                      style={[
                        styles.modalInput,
                        {
                          flex: 1,
                          minWidth: 0,
                          minHeight: theme.touch.min,
                          borderRadius: theme.radius.md,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surfaceAlt,
                          paddingHorizontal: theme.spacing.md,
                          color: theme.colors.text,
                          fontFamily: theme.typography.body.fontFamily,
                          fontSize: theme.typography.body.fontSize,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('activity.filterCategory')}
                  </AppText>
                  <View style={[styles.wrapChips, { gap: theme.spacing.sm }]}>
                    <Chip
                      testID="filter-cat-all"
                      label={t('activity.filterAllCategories')}
                      selected={draftCategoryId === null}
                      onPress={() => setDraftCategoryId(null)}
                    />
                    {allCategories
                      .filter((c) => !draftType || c.kind === draftType)
                      .map((cat) => (
                        <Chip
                          key={cat.id}
                          testID={`filter-cat-${cat.id}`}
                          label={cat.name}
                          selected={draftCategoryId === cat.id}
                          onPress={() => setDraftCategoryId(cat.id)}
                        />
                      ))}
                  </View>
                </View>

                {modalError ? (
                  <AppText variant="caption" color="danger">
                    {modalError}
                  </AppText>
                ) : null}
              </ScrollView>

              <View style={[styles.modalActions, { gap: theme.spacing.sm }]}>
                <Button
                  title={t('activity.resetFilters')}
                  variant="ghost"
                  onPress={() => {
                    resetAll();
                    setFilterModalOpen(false);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  testID="activity-apply-filters-btn"
                  title={t('activity.applyFilters')}
                  onPress={handleApplyModalFilters}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
  },
  clearIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  activeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rangeInputsRow: {
    flexDirection: 'row',
  },
  modalInput: {
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
  },
});
