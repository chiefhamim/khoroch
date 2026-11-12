import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { addDays, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { parseMoneyInput } from '@/domain/money';
import type { Category, CurrencyCode, LocalDate, TransactionType } from '@/domain/types';
import { isValidLocalTime } from '@/domain/validation';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AmountPad } from './AmountPad';
import { AppText } from './AppText';
import { Button } from './Button';
import { resolveIoniconName } from './CategoryIcon';
import { Chip } from './Chip';
import { SegmentedControl } from './SegmentedControl';

export interface TransactionFormValues {
  type: TransactionType;
  amountMinor: number;
  categoryId: string | null;
  description: string;
  occurredOn: LocalDate;
  occurredTime: string | null;
  note: string;
}

export interface TransactionFormProps {
  currency: CurrencyCode;
  categories: Category[];
  recentDescriptions: string[];
  initialValues?: {
    type?: TransactionType;
    amountText?: string;
    categoryId?: string | null;
    description?: string;
    occurredOn?: LocalDate;
    occurredTime?: string | null;
    note?: string;
  };
  submitLabel?: string;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}

const FALLBACK_SUGGESTIONS = ['Lunch', 'Uber', 'Electricity bill', 'Groceries', 'Coffee'];

export function TransactionForm({
  currency,
  categories,
  recentDescriptions,
  initialValues,
  submitLabel,
  onSubmit,
}: TransactionFormProps) {
  const { theme } = useTheme();
  const today = todayLocalDate();
  const yesterday = addDays(today, -1);

  const [type, setType] = useState<TransactionType>(initialValues?.type ?? 'expense');
  const [amountText, setAmountText] = useState(initialValues?.amountText ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(
    initialValues?.categoryId ?? 'food_dining'
  );
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [occurredOn, setOccurredOn] = useState<LocalDate>(initialValues?.occurredOn ?? today);
  const [showDateInput, setShowDateInput] = useState(
    Boolean(initialValues?.occurredOn && initialValues.occurredOn !== today && initialValues.occurredOn !== yesterday)
  );
  const [showMore, setShowMore] = useState(
    Boolean(initialValues?.occurredTime || initialValues?.note)
  );
  const [occurredTime, setOccurredTime] = useState(initialValues?.occurredTime ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const orderedCategories = useMemo(() => {
    const relevant = categories.filter(
      (c) =>
        c.kind === type &&
        (c.archivedAt == null || c.id === categoryId)
    );
    return relevant.sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categories, type, categoryId]);

  const effectiveCategoryId = useMemo(() => {
    if (orderedCategories.some((c) => c.id === categoryId)) {
      return categoryId;
    }
    return orderedCategories[0]?.id ?? null;
  }, [orderedCategories, categoryId]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const nextMatch = categories.find(
      (c) => c.kind === nextType && c.archivedAt == null
    );
    setCategoryId(nextMatch?.id ?? null);
  };

  const suggestions = useMemo(() => {
    if (recentDescriptions.length > 0) return recentDescriptions;
    return type === 'expense' ? FALLBACK_SUGGESTIONS : ['Salary', 'Freelance', 'Gift'];
  }, [recentDescriptions, type]);

  const handleSubmit = async () => {
    if (saving) return;
    setError(null);

    const parsed = parseMoneyInput(amountText);
    if (!parsed.ok) {
      if (parsed.error === 'too_large') setError(t('tx.errorTooLarge'));
      else if (parsed.error === 'too_many_decimals') setError(t('tx.errorTooManyDecimals'));
      else setError(t('tx.errorInvalidAmount'));
      return;
    }
    if (parsed.minor === null) {
      setError(t('tx.errorInvalidAmount'));
      return;
    }
    const cleanDate = occurredOn.trim();
    if (!isValidLocalDate(cleanDate)) {
      setError(t('tx.errorInvalidDate'));
      return;
    }
    const cleanTime = occurredTime.trim();
    if (cleanTime.length > 0 && !isValidLocalTime(cleanTime)) {
      setError(t('tx.errorInvalidTime'));
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        type,
        amountMinor: parsed.minor,
        categoryId: effectiveCategoryId,
        description: description.trim(),
        occurredOn: cleanDate,
        occurredTime: cleanTime.length > 0 ? cleanTime : null,
        note: note.trim(),
      });
    } catch {
      setError(t('tx.errorSaveFailed'));
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <SegmentedControl
        value={type}
        onChange={handleTypeChange}
        options={[
          { value: 'expense', label: t('common.expense') },
          { value: 'income', label: t('common.income') },
        ]}
      />

      <AmountPad value={amountText} onChange={setAmountText} currency={currency} />

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted">
          {t('common.category')}
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          {orderedCategories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              icon={resolveIoniconName(cat.icon)}
              selected={effectiveCategoryId === cat.id}
              onPress={() => setCategoryId(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted">
          {t('common.description')}
        </AppText>
        <TextInput
          testID="description-input"
          value={description}
          onChangeText={setDescription}
          placeholder={t('tx.descriptionPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={t('common.description')}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
            },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          {suggestions.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={description.trim().toLowerCase() === item.toLowerCase()}
              onPress={() => setDescription(item)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="label" color="textMuted">
          {t('common.date')}
        </AppText>
        <View style={[styles.rowWrap, { gap: theme.spacing.sm }]}>
          <Chip
            label={t('common.today')}
            selected={!showDateInput && occurredOn === today}
            onPress={() => {
              setOccurredOn(today);
              setShowDateInput(false);
            }}
          />
          <Chip
            label={t('common.yesterday')}
            selected={!showDateInput && occurredOn === yesterday}
            onPress={() => {
              setOccurredOn(yesterday);
              setShowDateInput(false);
            }}
          />
          <Chip
            label={t('common.pickDate')}
            icon="calendar-outline"
            selected={showDateInput || (occurredOn !== today && occurredOn !== yesterday)}
            onPress={() => setShowDateInput((v) => !v)}
          />
        </View>
        {showDateInput ? (
          <TextInput
            testID="date-input"
            value={occurredOn}
            onChangeText={setOccurredOn}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel={t('common.date')}
            style={[
              theme.typography.body,
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.md,
              },
            ]}
          />
        ) : null}
      </View>

      <Button
        title={showMore ? t('common.less') : t('common.more')}
        variant="ghost"
        onPress={() => setShowMore((v) => !v)}
      />

      {showMore ? (
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              {t('common.time')}
            </AppText>
            <TextInput
              testID="time-input"
              value={occurredTime}
              onChangeText={setOccurredTime}
              placeholder={t('tx.timePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t('common.time')}
              style={[
                theme.typography.body,
                styles.input,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            />
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              {t('common.note')}
            </AppText>
            <TextInput
              testID="note-input"
              value={note}
              onChangeText={setNote}
              placeholder={t('tx.notePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              accessibilityLabel={t('common.note')}
              style={[
                theme.typography.body,
                styles.input,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {error ? (
        <AppText variant="label" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <Button
        testID="save-tx-button"
        title={saving ? t('common.saving') : (submitLabel ?? t('common.save'))}
        onPress={() => void handleSubmit()}
        loading={saving}
        disabled={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
