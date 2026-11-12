import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { formatUtilizationPct } from '@/domain/calc';
import { formatPeriodRange } from '@/domain/dates';
import { formatMinorToDraft, getCurrencySymbol, parseMoneyInput } from '@/domain/money';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useBudgets } from '@/state/useBudgets';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryIcon, resolveIoniconName } from '@/ui/CategoryIcon';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Money } from '@/ui/Money';
import { ProgressBar } from '@/ui/ProgressBar';
import { Screen } from '@/ui/Screen';
import { SectionHeader } from '@/ui/SectionHeader';

function formatMinorInput(minor: number | null): string {
  if (minor === null || minor <= 0) return '';
  return formatMinorToDraft(minor);
}

export default function BudgetScreen() {
  const { settings } = useAppContext();
  const { theme, reducedMotion } = useTheme();
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

  // Overall budget edit modal
  const [overallModalOpen, setOverallModalOpen] = useState(false);
  const [overallInput, setOverallInput] = useState('');
  const [overallError, setOverallError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Category budget add/edit modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [isEditingExistingCat, setIsEditingExistingCat] = useState(false);
  const [catAmountInput, setCatAmountInput] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  const availableCategoriesForAdd = useMemo(() => {
    const existingSet = new Set(categoryBudgets.map((cb) => cb.categoryId));
    return categories.filter(
      (c) => c.kind === 'expense' && c.archivedAt == null && !existingSet.has(c.id)
    );
  }, [categories, categoryBudgets]);

  const openOverallModal = () => {
    setOverallInput(formatMinorInput(overallBudgetMinor));
    setOverallError(null);
    setOverallModalOpen(true);
  };

  const handleSaveOverall = async () => {
    if (saving) return;
    const parsed = parseMoneyInput(overallInput);
    if (!parsed.ok || parsed.minor === null || parsed.minor <= 0) {
      setOverallError(t('budget.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      await setOverallBudget(parsed.minor);
      setOverallModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverall = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await removeOverallBudget();
      setOverallModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openAddCategoryBudget = () => {
    const first = availableCategoriesForAdd[0];
    if (!first) return;
    setIsEditingExistingCat(false);
    setSelectedCatId(first.id);
    setCatAmountInput('');
    setCatError(null);
    setCatModalOpen(true);
  };

  const openEditCategoryBudget = (categoryId: string, currentMinor: number) => {
    setIsEditingExistingCat(true);
    setSelectedCatId(categoryId);
    setCatAmountInput(formatMinorInput(currentMinor));
    setCatError(null);
    setCatModalOpen(true);
  };

  const handleSaveCategoryBudget = async () => {
    if (saving || !selectedCatId) return;
    const parsed = parseMoneyInput(catAmountInput);
    if (!parsed.ok || parsed.minor === null || parsed.minor <= 0) {
      setCatError(t('budget.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      await setCategoryBudget(selectedCatId, parsed.minor);
      setCatModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCategoryBudget = async () => {
    if (saving || !selectedCatId) return;
    setSaving(true);
    try {
      await removeCategoryBudget(selectedCatId);
      setCatModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

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

  const symbol = getCurrencySymbol(settings.currency);
  const isOverAllocated = allocation.unallocatedMinor !== null && allocation.unallocatedMinor < 0;

  return (
    <Screen scroll bottomSpacer>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ gap: 2 }}>
          <AppText variant="title">{t('budget.title')}</AppText>
          <AppText variant="caption" color="textMuted">
            {formatPeriodRange(period.start, period.endExcl)}
          </AppText>
        </View>
        <View
          style={[
            styles.daysPill,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            },
          ]}
        >
          <AppText variant="label" color="text">
            {t('budget.remainingDays', { days: remainingDaysCount })}
          </AppText>
        </View>
      </View>

      {/* Overall Monthly Budget Card */}
      <SectionHeader
        title={t('budget.overallSection')}
        actionLabel={overallBudgetMinor !== null ? t('common.edit') : t('overview.setBudgetCta')}
        onActionPress={openOverallModal}
      />
      <Card style={{ gap: theme.spacing.md }}>
        {overallBudgetMinor !== null && overallSummary.remainingMinor !== null ? (
          <>
            <View style={styles.rowBetween}>
              <Money amountMinor={overallBudgetMinor} currency={settings.currency} variant="display" />
              <BudgetStatusBadge status={overallSummary.status} />
            </View>
            <ProgressBar pct={overallSummary.utilizationPct} status={overallSummary.status} height={10} />
            <View style={styles.rowBetween}>
              <View style={{ gap: 2 }}>
                <AppText variant="caption" color="textMuted">
                  {t('overview.spentLabel')}
                </AppText>
                <Money amountMinor={overallSummary.spentMinor} currency={settings.currency} variant="heading" />
              </View>
              <View style={{ gap: 2, alignItems: 'center' }}>
                <AppText variant="caption" color="textMuted">
                  {overallSummary.utilizationPct !== null
                    ? t('overview.usedPct', {
                        pct: formatUtilizationPct(overallSummary.utilizationPct),
                      })
                    : ''}
                </AppText>
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <AppText
                  variant="caption"
                  color={overallSummary.remainingMinor < 0 ? 'danger' : 'textMuted'}
                >
                  {overallSummary.remainingMinor < 0
                    ? t('overview.overByLabel')
                    : t('overview.remainingLabel')}
                </AppText>
                <Money
                  amountMinor={overallSummary.remainingMinor}
                  currency={settings.currency}
                  variant="heading"
                  color={overallSummary.remainingMinor < 0 ? 'danger' : 'text'}
                />
              </View>
            </View>
          </>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading">{t('overview.noBudgetSet')}</AppText>
            <AppText variant="body" color="textMuted">
              {t('overview.noBudgetHint')}
            </AppText>
            <Button
              testID="budget-set-overall-btn"
              title={t('overview.setBudgetCta')}
              variant="secondary"
              onPress={openOverallModal}
            />
          </View>
        )}
        <AppText variant="caption" color="textMuted">
          {t('overview.budgetPlanNote')}
        </AppText>
      </Card>

      {/* Allocation summary */}
      <Card tone="alt" style={{ gap: theme.spacing.sm }}>
        <View style={styles.rowBetween}>
          <AppText variant="label" color="textMuted">
            {t('budget.allocatedLabel')}
          </AppText>
          <Money amountMinor={allocation.allocatedMinor} currency={settings.currency} variant="heading" />
        </View>
        {allocation.unallocatedMinor !== null ? (
          <View style={styles.rowBetween}>
            <AppText variant="label" color={isOverAllocated ? 'warning' : 'textMuted'}>
              {isOverAllocated ? t('budget.overAllocatedLabel') : t('budget.unallocatedLabel')}
            </AppText>
            <Money
              amountMinor={Math.abs(allocation.unallocatedMinor)}
              currency={settings.currency}
              variant="heading"
              color={isOverAllocated ? 'warning' : 'text'}
            />
          </View>
        ) : null}
      </Card>

      {/* Category Budgets */}
      <SectionHeader
        title={t('budget.categorySection')}
        actionLabel={availableCategoriesForAdd.length > 0 ? t('budget.addCategoryBudget') : undefined}
        onActionPress={availableCategoriesForAdd.length > 0 ? openAddCategoryBudget : undefined}
      />
      {categoryBudgets.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title={t('budget.emptyCategoriesTitle')}
          body={t('budget.emptyCategoriesBody')}
          ctaLabel={availableCategoriesForAdd.length > 0 ? t('budget.addCategoryBudget') : undefined}
          onCtaPress={availableCategoriesForAdd.length > 0 ? openAddCategoryBudget : undefined}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {categoryBudgets.map((item) => {
            const cat = categoriesById.get(item.categoryId);
            const catName = cat?.name ?? t('common.uncategorized');
            const isOver = item.remainingMinor < 0;
            return (
              <Pressable
                key={item.categoryId}
                accessibilityRole="button"
                accessibilityLabel={catName}
                onPress={() => openEditCategoryBudget(item.categoryId, item.budgetMinor)}
                style={({ pressed }) => ({
                  opacity: pressed && !reducedMotion ? 0.8 : 1,
                })}
              >
                <Card style={{ gap: theme.spacing.sm }}>
                  <View style={styles.rowBetween}>
                    <View style={[styles.catLeft, { gap: theme.spacing.sm }]}>
                      <CategoryIcon icon={cat?.icon} size="sm" tone="primary" />
                      <AppText variant="heading" numberOfLines={1} style={styles.flexOne}>
                        {catName}
                      </AppText>
                    </View>
                    <BudgetStatusBadge status={item.status} />
                  </View>

                  <ProgressBar pct={item.utilizationPct} status={item.status} height={8} />

                  <View style={styles.rowBetween}>
                    <View style={[styles.inlinePair, { gap: theme.spacing.xs }]}>
                      <Money amountMinor={item.spentMinor} currency={settings.currency} variant="label" />
                      <AppText variant="caption" color="textMuted">
                        /
                      </AppText>
                      <Money
                        amountMinor={item.budgetMinor}
                        currency={settings.currency}
                        variant="label"
                        color="textMuted"
                      />
                    </View>
                    <Money
                      amountMinor={item.remainingMinor}
                      currency={settings.currency}
                      variant="label"
                      color={isOver ? 'danger' : 'text'}
                    />
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Previous Periods (read-only) */}
      <SectionHeader title={t('budget.historySection')} />
      <Card style={{ gap: theme.spacing.md }}>
        {history.length === 0 ? (
          <AppText variant="body" color="textMuted">
            {t('budget.emptyHistory')}
          </AppText>
        ) : (
          history.map((h, idx) => (
            <View key={h.period.start} style={{ gap: theme.spacing.xs }}>
              {idx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.xs }} /> : null}
              <View style={styles.rowBetween}>
                <AppText variant="heading">{formatPeriodRange(h.period.start, h.period.endExcl)}</AppText>
                <BudgetStatusBadge status={h.status} />
              </View>
              <View style={styles.rowBetween}>
                <AppText variant="caption" color="textMuted">
                  {t('overview.spentLabel')}
                </AppText>
                <View style={[styles.inlinePair, { gap: theme.spacing.xs }]}>
                  <Money amountMinor={h.spentMinor} currency={settings.currency} variant="label" />
                  {h.overallBudgetMinor !== null ? (
                    <>
                      <AppText variant="caption" color="textMuted">
                        /
                      </AppText>
                      <Money
                        amountMinor={h.overallBudgetMinor}
                        currency={settings.currency}
                        variant="label"
                        color="textMuted"
                      />
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Overall Budget Edit Modal */}
      {overallModalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setOverallModalOpen(false)}
        >
          <View style={[styles.backdrop, { padding: theme.spacing.xl }]}>
            <Card style={[styles.dialog, { gap: theme.spacing.md }]}>
              <AppText variant="title">{t('budget.editOverallTitle')}</AppText>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="textMuted">
                  {`${t('budget.amountLabel')} (${symbol})`}
                </AppText>
                <TextInput
                  testID="overall-budget-input"
                  value={overallInput}
                  onChangeText={(txt) => {
                    setOverallInput(txt);
                    if (overallError) setOverallError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="40000"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      minHeight: theme.touch.min,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.md,
                      color: theme.colors.text,
                      fontFamily: theme.typography.heading.fontFamily,
                      fontSize: theme.typography.heading.fontSize,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                />
              </View>
              {overallError ? (
                <AppText variant="caption" color="danger">
                  {overallError}
                </AppText>
              ) : null}
              <View style={[styles.modalActions, { gap: theme.spacing.sm }]}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  disabled={saving}
                  onPress={() => setOverallModalOpen(false)}
                  style={styles.flexOne}
                />
                <Button
                  testID="save-overall-budget-btn"
                  title={t('common.save')}
                  loading={saving}
                  disabled={saving}
                  onPress={() => void handleSaveOverall()}
                  style={styles.flexOne}
                />
              </View>
              {overallBudgetMinor !== null ? (
                <Button
                  title={t('budget.removeBudget')}
                  variant="danger"
                  disabled={saving}
                  onPress={() => void handleRemoveOverall()}
                />
              ) : null}
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Category Budget Modal */}
      {catModalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setCatModalOpen(false)}
        >
          <View style={[styles.backdrop, { padding: theme.spacing.xl }]}>
            <Card style={[styles.dialog, { gap: theme.spacing.md }]}>
              <AppText variant="title">
                {isEditingExistingCat ? t('budget.editCategoryBudget') : t('budget.addCategoryBudget')}
              </AppText>

              {isEditingExistingCat ? (
                <AppText variant="heading">
                  {categoriesById.get(selectedCatId)?.name ?? t('common.uncategorized')}
                </AppText>
              ) : (
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('budget.pickCategoryLabel')}
                  </AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: theme.spacing.sm }}
                  >
                    {availableCategoriesForAdd.map((cat) => (
                      <Chip
                        key={cat.id}
                        label={cat.name}
                        icon={resolveIoniconName(cat.icon)}
                        selected={selectedCatId === cat.id}
                        onPress={() => setSelectedCatId(cat.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="textMuted">
                  {`${t('budget.amountLabel')} (${symbol})`}
                </AppText>
                <TextInput
                  testID="category-budget-input"
                  value={catAmountInput}
                  onChangeText={(txt) => {
                    setCatAmountInput(txt);
                    if (catError) setCatError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="5000"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.input,
                    {
                      minHeight: theme.touch.min,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.md,
                      color: theme.colors.text,
                      fontFamily: theme.typography.heading.fontFamily,
                      fontSize: theme.typography.heading.fontSize,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                />
              </View>

              {catError ? (
                <AppText variant="caption" color="danger">
                  {catError}
                </AppText>
              ) : null}

              <View style={[styles.modalActions, { gap: theme.spacing.sm }]}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  disabled={saving}
                  onPress={() => setCatModalOpen(false)}
                  style={styles.flexOne}
                />
                <Button
                  testID="save-category-budget-btn"
                  title={t('common.save')}
                  loading={saving}
                  disabled={saving}
                  onPress={() => void handleSaveCategoryBudget()}
                  style={styles.flexOne}
                />
              </View>

              {isEditingExistingCat ? (
                <Button
                  title={t('budget.removeBudget')}
                  variant="danger"
                  disabled={saving}
                  onPress={() => void handleRemoveCategoryBudget()}
                />
              ) : null}
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
    gap: spacing.md,
  },
  daysPill: {
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  catLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlinePair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexOne: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
  },
  input: {
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
  },
});
