import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatUtilizationPct } from '@/domain/calc';
import {
  formatMinorToDraft,
  formatMoney,
  getCurrencySymbol,
  groupThousands,
  parseMoneyInput,
} from '@/domain/money';
import { formatCycleLabel } from '@/domain/period';
import { isValidBudgetAmount } from '@/domain/validation';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { usePrivacyStore } from '@/state/privacyStore';
import { useBudgets } from '@/state/useBudgets';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { hapticLight, hapticSuccess } from '@/ui/haptics';
import { IconTile } from '@/ui/IconTile';
import { Keypad } from '@/ui/Keypad';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';
import { PressableScale } from '@/ui/PressableScale';

type SheetMode =
  | { kind: 'overall' }
  | { kind: 'addCategory' }
  | { kind: 'editCategory'; categoryId: string };

export default function PlanScreen() {
  const router = useRouter();
  const locale = useLocale();
  const { settings } = useAppContext();
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const showPoisha = usePrivacyStore((s) => s.showPoisha);
  const { theme, reducedMotion } = useTheme();
  const { showToast } = useToast();
  const {
    period,
    remainingDaysCount,
    overallBudgetMinor,
    overallSummary,
    categoryBudgets,
    allocation,
    history,
    categories,
    categoriesById,
    loading,
    error,
    reload,
    setOverallBudget,
    removeOverallBudget,
    setCategoryBudget,
    removeCategoryBudget,
  } = useBudgets();

  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);
  const [pickedCategoryId, setPickedCategoryId] = useState<string>('');
  const [amountDraft, setAmountDraft] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);

  const budgetedCatIds = useMemo(
    () => new Set(categoryBudgets.map((c) => c.categoryId)),
    [categoryBudgets]
  );

  const availableCategoriesForAdd = useMemo(
    () =>
      categories.filter(
        (c) => c.archivedAt == null && c.kind === 'expense' && !budgetedCatIds.has(c.id)
      ),
    [categories, budgetedCatIds]
  );

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

  const cycleLabel = formatCycleLabel(period, settings.monthStartDay, { locale });
  const currencySymbol = getCurrencySymbol(settings.currency);
  const displayAmountDraft = amountDraft ? groupThousands(amountDraft) : '0';

  const bnMinWidth = (text: string, fontSize: number, maxWidth?: number) => {
    if (locale !== 'bn') return undefined;
    const width = estimateSingleLineMinWidth(text, fontSize);
    return { minWidth: maxWidth !== undefined ? Math.min(width, maxWidth) : width };
  };

  const openEditOverall = () => {
    setAmountDraft(overallBudgetMinor !== null ? formatMinorToDraft(overallBudgetMinor) : '');
    setSheetError(null);
    setSheetMode({ kind: 'overall' });
  };

  const openAddCategory = () => {
    const first = availableCategoriesForAdd[0];
    if (!first) return;
    setPickedCategoryId(first.id);
    setAmountDraft('');
    setSheetError(null);
    setSheetMode({ kind: 'addCategory' });
  };

  const openEditCategory = (categoryId: string, currentMinor: number) => {
    setPickedCategoryId(categoryId);
    setAmountDraft(formatMinorToDraft(currentMinor));
    setSheetError(null);
    setSheetMode({ kind: 'editCategory', categoryId });
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetMode(null);
    setSheetError(null);
  };

  const handleSaveSheet = async () => {
    const parsed = parseMoneyInput(amountDraft);
    if (!parsed.ok || !isValidBudgetAmount(parsed.minor)) {
      setSheetError(t('budget.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      if (sheetMode?.kind === 'overall') {
        await setOverallBudget(parsed.minor);
      } else if (sheetMode?.kind === 'addCategory') {
        if (!pickedCategoryId) {
          setSaving(false);
          return;
        }
        await setCategoryBudget(pickedCategoryId, parsed.minor);
      } else if (sheetMode?.kind === 'editCategory') {
        await setCategoryBudget(sheetMode.categoryId, parsed.minor);
      }
      hapticSuccess();
      setSheetMode(null);
      showToast({ message: t('tx.savedToast') });
    } catch {
      setSheetError(t('settings.actionError'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBudget = async () => {
    if (!sheetMode) return;
    setSaving(true);
    try {
      if (sheetMode.kind === 'overall') {
        await removeOverallBudget();
      } else if (sheetMode.kind === 'editCategory') {
        await removeCategoryBudget(sheetMode.categoryId);
      }
      hapticSuccess();
      setSheetMode(null);
      showToast({ message: t('tx.deletedToast') });
    } catch {
      setSheetError(t('settings.actionError'));
    } finally {
      setSaving(false);
    }
  };

  const isNegativeRemaining =
    overallSummary.remainingMinor !== null && overallSummary.remainingMinor < 0;

  const sheetTitle = (() => {
    if (sheetMode?.kind === 'overall') {
      return overallBudgetMinor !== null
        ? t('budget.editOverallTitle')
        : t('budget.setOverallTitle');
    }
    if (sheetMode?.kind === 'editCategory') {
      return categoriesById.get(sheetMode.categoryId)?.name ?? t('budget.editCategoryBudget');
    }
    return t('budget.addCategoryRow');
  })();

  const allocationSummaryText = (() => {
    if (
      overallBudgetMinor === null ||
      allocation.unallocatedMinor === null ||
      allocation.allocatedMinor <= 0
    ) {
      return null;
    }
    if (allocation.unallocatedMinor < 0) {
      return {
        text: t('budget.overAllocatedInline', {
          amount: formatMoney(Math.abs(allocation.unallocatedMinor), settings.currency, {
            hidden: hideAmounts,
            showPoisha,
          }),
        }),
        tone: 'warning' as const,
      };
    }
    return {
      text: t('budget.unallocatedInline', {
        amount: formatMoney(allocation.unallocatedMinor, settings.currency, {
          hidden: hideAmounts,
          showPoisha,
        }),
      }),
      tone: 'textSecondary' as const,
    };
  })();

  return (
    <Screen scroll bottomSpacer>
      {/* Page header: Title + cycle range */}
      <View style={styles.headerRow}>
        <AppText variant="title">{t('plan.title')}</AppText>
        <AppText
          variant="label"
          color="textSecondary"
          numberOfLines={1}
          style={[styles.rightText, bnMinWidth(cycleLabel, 13, 180)]}
        >
          {cycleLabel}
        </AppText>
      </View>

      {/* Overall budget hero card */}
      <Surface style={{ gap: theme.spacing.lg }}>
        {overallBudgetMinor !== null && overallSummary.remainingMinor !== null ? (
          <>
            <ProgressRing
              testID="budget-overall-ring"
              size={196}
              strokeWidth={12}
              pct={overallSummary.utilizationPct}
              status={overallSummary.status}
            >
              <Money
                testID="budget-ring-remaining"
                variant="display"
                amountMinor={Math.abs(overallSummary.remainingMinor)}
                currency={settings.currency}
                color={isNegativeRemaining ? 'danger' : 'text'}
                allowCompact
                numberOfLines={1}
                style={
                  Math.abs(overallSummary.remainingMinor) >= 10_000_000
                    ? styles.ringMoneyCompact
                    : styles.ringMoney
                }
              />
              {(() => {
                const ringCaption = `${isNegativeRemaining ? t('budget.overSuffix') : t('budget.leftSuffix')} · ${formatUtilizationPct(overallSummary.utilizationPct ?? 0)}`;
                return (
                  <AppText
                    variant="caption"
                    color={isNegativeRemaining ? 'danger' : 'textSecondary'}
                    numberOfLines={1}
                    style={[styles.centerText, bnMinWidth(ringCaption, 13, 156)]}
                  >
                    {ringCaption}
                  </AppText>
                );
              })()}
            </ProgressRing>

            <View style={[styles.heroFooter, { gap: theme.spacing.sm }]}>
              <AppText variant="label" color="textSecondary" style={styles.flexOne}>
                {overallSummary.safeToSpendPerDayMinor !== null
                  ? t('budget.safePerDaySummary', {
                      days: remainingDaysCount,
                      amount: formatMoney(
                        overallSummary.safeToSpendPerDayMinor,
                        settings.currency,
                        { hidden: hideAmounts, showPoisha }
                      ),
                    })
                  : t('budget.remainingDays', { days: remainingDaysCount })}
              </AppText>
              <PressableScale pressScale={0.98}
                testID="budget-edit-overall-btn"
                accessibilityRole="button"
                accessibilityLabel={t('budget.editOverallTitle')}
                hitSlop={8}
                onPress={openEditOverall}
                style={({ pressed }) => [
                  styles.editLink,
                  {
                    gap: theme.spacing.xs,
                    opacity: pressed && !reducedMotion ? 0.65 : 1,
                  },
                ]}
              >
                <AppIcon name="pencil" size={14} color={theme.colors.accent} />
                <AppText
                  variant="label"
                  color="accent"
                  numberOfLines={1}
                  style={[styles.semiBold, bnMinWidth(t('budget.editShort'), 13)]}
                >
                  {t('budget.editShort')}
                </AppText>
              </PressableScale>
            </View>
          </>
        ) : (
          <EmptyState
            testID="budget-empty-overall"
            icon="pie-chart"
            title={t('empty.budgetTitle')}
            body={t('empty.budgetBody')}
            ctaLabel={t('budget.setMonthlyCta')}
            onCtaPress={openEditOverall}
          />
        )}
      </Surface>

      {/* Category budgets section */}
      <View style={{ gap: theme.spacing.md }}>
        <View style={[styles.catSectionHeader, { gap: theme.spacing.sm }]}>
          <AppText
            variant="headline"
            numberOfLines={1}
            style={bnMinWidth(t('budget.categorySection'), 17, 220)}
          >
            {t('budget.categorySection')}
          </AppText>
          {allocationSummaryText ? (
            <AppText
              variant="label"
              color={allocationSummaryText.tone}
              tabularNums
              numberOfLines={1}
              style={[styles.rightText, bnMinWidth(allocationSummaryText.text, 13, 210)]}
            >
              {allocationSummaryText.text}
            </AppText>
          ) : null}
        </View>

        {categoryBudgets.length > 0 ? (
          <Surface padded={false}>
            {categoryBudgets.map((item, idx) => {
              const cat = categoriesById.get(item.categoryId);
              const catName = cat?.name ?? t('common.uncategorized');
              const isOver = item.remainingMinor < 0;
              const statusTone: 'danger' | 'warning' | 'textSecondary' =
                item.status === 'over'
                  ? 'danger'
                  : item.status === 'attention' || item.status === 'reached'
                    ? 'warning'
                    : 'textSecondary';
              const statusText = isOver
                ? t('budget.overAmount', {
                    amount: formatMoney(Math.abs(item.remainingMinor), settings.currency, {
                      hidden: hideAmounts,
                      showPoisha,
                    }),
                  })
                : t('budget.leftAmount', {
                    amount: formatMoney(item.remainingMinor, settings.currency, {
                      hidden: hideAmounts,
                      showPoisha,
                    }),
                  });
              const ofLimitText = t('budget.ofLimitLabel', {
                spent: formatMoney(item.spentMinor, settings.currency, {
                  hidden: hideAmounts,
                  showPoisha,
                }),
                limit: formatMoney(item.budgetMinor, settings.currency, {
                  hidden: hideAmounts,
                  showPoisha,
                }),
              });

              return (
                <View key={item.categoryId}>
                  <PressableScale pressScale={0.98}
                    testID={`budget-cat-row-${item.categoryId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${catName}: ${ofLimitText}`}
                    onPress={() => openEditCategory(item.categoryId, item.budgetMinor)}
                    style={({ pressed }) => [
                      styles.catRow,
                      {
                        minHeight: 72,
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
                      size="md"
                    />
                    <View style={[styles.flexOne, { gap: theme.spacing.xs }]}>
                      <View style={[styles.catRowTop, { gap: theme.spacing.sm }]}>
                        <AppText
                          variant="bodyStrong"
                          style={styles.flexOne}
                          numberOfLines={1}
                        >
                          {catName}
                        </AppText>
                        <AppText
                          variant="label"
                          color={statusTone}
                          tabularNums
                          numberOfLines={1}
                          style={[styles.rightText, bnMinWidth(statusText, 13, 160)]}
                        >
                          {statusText}
                        </AppText>
                      </View>
                      <AppText variant="caption" color="textSecondary" tabularNums>
                        {ofLimitText}
                      </AppText>
                      <ProgressBar
                        pct={item.utilizationPct}
                        status={item.status}
                        height={4}
                      />
                    </View>
                  </PressableScale>
                  {idx < categoryBudgets.length - 1 ? (
                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor: theme.colors.separator,
                          marginLeft: 68,
                          marginRight: theme.spacing.lg,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </Surface>
        ) : null}

        {availableCategoriesForAdd.length > 0 ? (
          <PressableScale pressScale={0.98}
            testID="budget-add-category-row"
            accessibilityRole="button"
            accessibilityLabel={t('budget.addCategoryRow')}
            onPress={openAddCategory}
            style={({ pressed }) => [
              styles.addRow,
              {
                minHeight: theme.geometry.buttonHeight,
                borderRadius: theme.radius.card,
                borderColor: theme.colors.separator,
                backgroundColor: theme.colors.surface,
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                opacity: pressed && !reducedMotion ? 0.68 : 1,
              },
            ]}
          >
            <AppIcon name="plus" size={18} color={theme.colors.accent} />
            <AppText
              variant="bodyStrong"
              color="accent"
              numberOfLines={1}
              style={bnMinWidth(t('budget.addCategoryRow'), 15)}
            >
              {t('budget.addCategoryRow')}
            </AppText>
          </PressableScale>
        ) : null}
      </View>

      {/* Collapsible Past cycles card */}
      <Surface padded={false}>
        <PressableScale pressScale={0.98}
          testID="budget-past-cycles-toggle"
          accessibilityRole="button"
          accessibilityLabel={t('budget.pastCyclesTitle')}
          accessibilityState={{ expanded: pastExpanded }}
          onPress={() => {
            hapticLight();
            setPastExpanded((v) => !v);
          }}
          style={({ pressed }) => [
            styles.pastHeader,
            {
              minHeight: theme.geometry.listRowHeight,
              paddingHorizontal: theme.spacing.lg,
              opacity: pressed && !reducedMotion ? 0.72 : 1,
            },
          ]}
        >
          <View style={[styles.pastTitleWrap, { gap: theme.spacing.sm }]}>
            <AppText
              variant="headline"
              numberOfLines={1}
              style={bnMinWidth(t('budget.pastCyclesTitle'), 17, 240)}
            >
              {t('budget.pastCyclesTitle')}
            </AppText>
            {history.length > 0 ? (
              <AppText variant="label" color="textSecondary" tabularNums>
                {String(history.length)}
              </AppText>
            ) : null}
          </View>
          <AppIcon
            name={pastExpanded ? 'chevron-down' : 'chevron-right'}
            size={18}
            color={theme.colors.textTertiary}
          />
        </PressableScale>

        {pastExpanded ? (
          <View>
            <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
            {history.length === 0 ? (
              <View style={{ padding: theme.spacing.lg }}>
                <AppText variant="body" color="textSecondary">
                  {t('budget.emptyHistory')}
                </AppText>
              </View>
            ) : (
              history.map((item, idx) => (
                <ListRow
                  key={item.period.start}
                  compact
                  title={formatCycleLabel(item.period, settings.monthStartDay, { locale })}
                  subtitle={
                    item.overallBudgetMinor !== null
                      ? t('budget.ofLimitLabel', {
                          spent: formatMoney(item.spentMinor, settings.currency, {
                            hidden: hideAmounts,
                            showPoisha,
                          }),
                          limit: formatMoney(item.overallBudgetMinor, settings.currency, {
                            hidden: hideAmounts,
                            showPoisha,
                          }),
                        })
                      : formatMoney(item.spentMinor, settings.currency, {
                          hidden: hideAmounts,
                          showPoisha,
                        })
                  }
                  right={<BudgetStatusBadge status={item.status} />}
                  showDivider={idx < history.length - 1}
                />
              ))
            )}
          </View>
        ) : null}
      </Surface>

      {/* Insights entry card (moved from bottom bar under Plan) */}
      <Surface padded={false}>
        <ListRow
          testID="plan-insights-row"
          left={<IconTile icon="chart-column" colorKey="teal" size="md" />}
          title={t('plan.insightsRowTitle')}
          subtitle={t('plan.insightsRowSubtitle')}
          showChevron
          onPress={() => {
            hapticLight();
            router.push('/plan/insights' as never);
          }}
        />
      </Surface>

      {/* Budget editor bottom sheet */}
      <Sheet visible={sheetMode !== null} onClose={closeSheet} title={sheetTitle}>
        {sheetMode?.kind === 'addCategory' ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textSecondary">
              {t('budget.pickCategoryLabel')}
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.catChipList, { gap: theme.spacing.xs }]}
            >
              {availableCategoriesForAdd.map((c) => (
                <Chip
                  key={c.id}
                  testID={`budget-pick-cat-${c.id}`}
                  label={c.name}
                  selected={pickedCategoryId === c.id}
                  onPress={() => setPickedCategoryId(c.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View
          testID="budget-sheet-amount-hero"
          style={[styles.heroAmountBox, { paddingVertical: theme.spacing.sm }]}
        >
          <AppText
            variant="hero"
            tabularNums
            color={amountDraft ? 'text' : 'textTertiary'}
          >
            {`${currencySymbol} ${displayAmountDraft}`}
          </AppText>
        </View>

        {sheetError ? (
          <AppText variant="label" color="danger" style={styles.centerText}>
            {sheetError}
          </AppText>
        ) : null}

        <Keypad
          testID="budget-sheet-keypad"
          value={amountDraft}
          onChange={(next) => {
            setAmountDraft(next);
            if (sheetError) setSheetError(null);
          }}
        />

        <Button
          testID="budget-sheet-save-btn"
          title={t('common.save')}
          onPress={handleSaveSheet}
          loading={saving}
        />

        {(sheetMode?.kind === 'overall' && overallBudgetMinor !== null) ||
        sheetMode?.kind === 'editCategory' ? (
          <Button
            testID="budget-sheet-remove-btn"
            title={t('budget.removeBudget')}
            variant="dangerSoft"
            onPress={handleRemoveBudget}
            disabled={saving}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  ringMoney: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  ringMoneyCompact: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 4,
  },
  semiBold: {
    fontWeight: '600',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catChipList: {
    paddingVertical: 2,
  },
  heroAmountBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  rightText: {
    textAlign: 'right',
  },
  divider: {
    height: 1,
  },
  flexOne: {
    flex: 1,
  },
});
