import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  addDays,
  currentLocalTime,
  formatFriendlyDate,
  formatFriendlyTime,
  isDevice24HourClock,
  todayLocalDate,
} from '@/domain/dates';
import { canPinAmount, pinAmount, recentDistinctEntries, unpinAmount } from '@/domain/captureShortcuts';
import { formatMinorToDraft, parseMoneyInput } from '@/domain/money';
import {
  emptyPinnedAmounts,
  type Account,
  type Category,
  type CurrencyCode,
  type LocalDate,
  type LocalTime,
  type PinnedAmounts,
  type Transaction,
  type TransactionType,
  type WeekStartDay,
} from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { bn } from '@/i18n/bn';
import { en } from '@/i18n/en';
import { containsBengali, mapFontToBangla } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Button } from './Button';
import { PresetAmounts, RepeatChips } from './CaptureShortcuts';
import { DateTimeSheet } from './DateTimeSheet';
import { hapticSelection } from './haptics';
import { IconTile } from './IconTile';
import { Keypad } from './Keypad';
import { Money } from './Money';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { WalletAvatar } from './WalletAvatar';
import { WalletPickerSheet } from './WalletPickerSheet';

export interface FastEntryValues {
  type: TransactionType;
  amountMinor: number;
  categoryId: string;
  accountId: string | null;
  description: string;
  note: string;
  occurredOn: LocalDate;
  occurredTime: string | null;
}

export interface FastTransactionEntryProps {
  currency: CurrencyCode;
  categories: Category[];
  accounts: Account[];
  defaultAccountId?: string | null;
  recentTransactions?: Transaction[];
  /** Pinned quick amounts. Presets and the Pin amount action show only when a change handler is given. */
  pinnedAmounts?: PinnedAmounts;
  onPinnedAmountsChange?: (next: PinnedAmounts) => void;
  weekStartsOn?: WeekStartDay;
  onClose: () => void;
  onSubmit: (values: FastEntryValues) => Promise<void>;
  onSubmitAndAddAnother?: (values: FastEntryValues) => Promise<void>;
  /** Edit mode opens an existing entry in this same screen: Delete + Save instead of Save & next. */
  mode?: 'new' | 'edit';
  initialValues?: Partial<Omit<FastEntryValues, 'categoryId'>> & { categoryId?: string | null };
  onDeletePress?: () => void;
}

interface Suggestion {
  description: string;
  categoryId: string | null;
  accountId: string | null;
}

function draftAmount(text: string): number | null {
  const parsed = parseMoneyInput(text);
  return parsed.ok && parsed.minor !== null && parsed.minor > 0 ? parsed.minor : null;
}

/** Most frequent recent descriptions for one direction, newest first on ties. */
export function buildDescriptionSuggestions(
  transactions: readonly Transaction[],
  type: TransactionType,
  categoryNames: ReadonlySet<string>,
  limit = 8
): Suggestion[] {
  const byKey = new Map<string, Suggestion & { count: number; order: number }>();
  let order = 0;
  for (const tx of transactions) {
    if (tx.deletedAt != null || tx.type !== type || tx.transferId) continue;
    const description = tx.description.trim();
    if (!description || categoryNames.has(description)) continue;
    const key = description.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { description, categoryId: tx.categoryId, accountId: tx.accountId, count: 1, order });
      order += 1;
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map(({ description, categoryId, accountId }) => ({ description, categoryId, accountId }));
}

const THUMB_W = 112;

/** Spent / Received switch: one coloured thumb glides between the two labels. */
function TypeSwitch({ type, onChange }: { type: 'expense' | 'income'; onChange: (next: 'expense' | 'income') => void }) {
  const { theme, reducedMotion } = useTheme();
  const slide = useSharedValue(type === 'income' ? 1 : 0);
  useEffect(() => {
    const target = type === 'income' ? 1 : 0;
    slide.set(reducedMotion ? target : withTiming(target, { duration: 360, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [type, reducedMotion, slide]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get() * THUMB_W }],
    backgroundColor: interpolateColor(slide.get(), [0, 1], [theme.colors.expense, theme.colors.income]),
  }));
  const items = [
    { key: 'expense' as const, label: t('fast.spent'), icon: 'arrow-up-right' as const },
    { key: 'income' as const, label: t('fast.received'), icon: 'arrow-down-left' as const },
  ];
  return (
    <View
      style={[
        styles.typeSwitch,
        {
          // Same card style as Today's Daybook: surface fill, hairline border, soft drop shadow.
          backgroundColor: theme.colors.surface,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.colors.cardBorder,
        },
        theme.elevation.e1,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.typeThumb, { borderRadius: theme.radius.pill }, thumbStyle]}
      />
      {items.map((item) => {
        const active = type === item.key;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => {
              hapticSelection();
              onChange(item.key);
            }}
            style={styles.typeBtn}
          >
            <AppIcon name={item.icon} size={15} color={active ? '#FFFFFF' : theme.colors.textTertiary} />
            <AppText
              variant="label"
              numberOfLines={1}
              style={{
                color: active ? '#FFFFFF' : theme.colors.textTertiary,
                fontFamily: active ? 'Manrope_700Bold' : 'Manrope_500Medium',
              }}
            >
              {item.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function FastTransactionEntry({
  currency,
  categories,
  accounts,
  defaultAccountId,
  recentTransactions = [],
  pinnedAmounts,
  onPinnedAmountsChange,
  weekStartsOn,
  onClose,
  onSubmit,
  onSubmitAndAddAnother,
  mode = 'new',
  initialValues,
  onDeletePress,
}: FastTransactionEntryProps) {
  const { theme } = useTheme();
  const locale = useLocale();
  const today = todayLocalDate();
  const use24Hour = isDevice24HourClock();

  const isEdit = mode === 'edit';
  const [type, setType] = useState<TransactionType>(initialValues?.type ?? 'expense');
  const [amountText, setAmountText] = useState(
    initialValues?.amountMinor ? formatMinorToDraft(initialValues.amountMinor) : ''
  );
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [categoryByType, setCategoryByType] = useState<Record<TransactionType, string | null>>({
    expense: initialValues?.type !== 'income' ? initialValues?.categoryId ?? null : null,
    income: initialValues?.type === 'income' ? initialValues?.categoryId ?? null : null,
  });
  const [accountId, setAccountId] = useState<string | null>(
    initialValues && 'accountId' in initialValues
      ? initialValues.accountId ?? null
      : defaultAccountId && accounts.some((account) => account.id === defaultAccountId)
        ? defaultAccountId
        : accounts[0]?.id ?? null
  );
  const [occurredOn, setOccurredOn] = useState<LocalDate>(initialValues?.occurredOn ?? today);
  const [occurredTime, setOccurredTime] = useState<LocalTime>(
    initialValues?.occurredTime ?? currentLocalTime()
  );
  // Editing an old entry that never had a time keeps it blank until a time is picked.
  const timeUnsetAtStart = isEdit && initialValues?.occurredTime == null;
  const [timeChosen, setTimeChosen] = useState(false);
  const [timeTouched, setTimeTouched] = useState(isEdit);
  const [noteOpen, setNoteOpen] = useState(Boolean(initialValues?.note));
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRows, setSavedRows] = useState<
    { key: string; type: TransactionType; amountMinor: number; label: string; time: LocalTime }[]
  >([]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Keep "now" fresh while the screen stays open, until the person picks a time.
  useEffect(() => {
    if (timeTouched) return;
    const timer = setInterval(() => setOccurredTime(currentLocalTime()), 30_000);
    return () => clearInterval(timer);
  }, [timeTouched]);

  const typeCategories = useMemo(
    () =>
      categories
        .filter((category) => category.kind === type && category.archivedAt === null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, type]
  );
  const categoryNames = useMemo(() => new Set(categories.map((c) => c.name)), [categories]);

  const quickCategories = useMemo(() => {
    const ids: string[] = [];
    for (const tx of recentTransactions) {
      if (tx.deletedAt != null || tx.type !== type || !tx.categoryId || ids.includes(tx.categoryId)) continue;
      ids.push(tx.categoryId);
      if (ids.length === 6) break;
    }
    const recent = ids
      .map((id) => typeCategories.find((c) => c.id === id))
      .filter((c): c is Category => Boolean(c));
    const top = [...recent, ...typeCategories.filter((c) => !ids.includes(c.id))].slice(0, 6);
    const picked = typeCategories.find((c) => c.id === categoryByType[type]);
    if (picked && !top.some((c) => c.id === picked.id)) top[top.length - 1] = picked;
    return top;
  }, [recentTransactions, type, typeCategories, categoryByType]);

  const suggestions = useMemo(
    () => buildDescriptionSuggestions(recentTransactions, type, categoryNames),
    [recentTransactions, type, categoryNames]
  );
  const visibleSuggestions = useMemo(() => {
    const needle = description.trim().toLowerCase();
    if (!needle) return suggestions;
    return suggestions.filter(
      (s) => s.description.toLowerCase().includes(needle) && s.description.toLowerCase() !== needle
    );
  }, [description, suggestions]);

  const categoryId = categoryByType[type];
  const selectedCategory = typeCategories.find((c) => c.id === categoryId) ?? null;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const parsedAmount = draftAmount(amountText);
  const canSave = parsedAmount !== null && selectedCategory !== null && !saving;
  const isIncome = type === 'income';

  const setCategory = (id: string | null) =>
    setCategoryByType((prev) => ({ ...prev, [type]: id }));

  const applySuggestion = (s: Suggestion) => {
    hapticSelection();
    setDescription(s.description);
    if (s.categoryId && typeCategories.some((c) => c.id === s.categoryId)) setCategory(s.categoryId);
    Keyboard.dismiss();
  };

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // Up to three recent distinct entries whose category is still active. Fills the form only.
  const repeatEntries = useMemo(() => {
    if (isEdit) return [];
    const usable = recentTransactions.filter((tx) => {
      const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      return category !== undefined && category.archivedAt === null && category.kind === tx.type;
    });
    return recentDistinctEntries(usable, {
      adjustmentDescriptions: [en['wallets.adjustmentDescription'], bn['wallets.adjustmentDescription']],
    });
  }, [isEdit, recentTransactions, categoriesById]);

  const applyRepeat = (entry: Transaction) => {
    setType(entry.type);
    setCategoryByType((prev) => ({ ...prev, [entry.type]: entry.categoryId }));
    if (entry.accountId === null || accounts.some((account) => account.id === entry.accountId)) {
      setAccountId(entry.accountId);
    }
    setAmountText(formatMinorToDraft(entry.amountMinor));
    setDescription(entry.description);
    setNote(entry.note);
    setNoteOpen(Boolean(entry.note));
    setOccurredOn(today);
    setOccurredTime(currentLocalTime());
    setTimeTouched(false);
  };

  const pinned = pinnedAmounts ?? emptyPinnedAmounts();
  const presetsEnabled = !isEdit && onPinnedAmountsChange !== undefined;
  const presetAmounts = presetsEnabled ? pinned[type] : [];
  const canPin = presetsEnabled && canPinAmount(pinned, type, parsedAmount);

  const whenLabel = (() => {
    const day =
      occurredOn === today
        ? t('common.today')
        : occurredOn === addDays(today, -1)
          ? t('common.yesterday')
          : formatFriendlyDate(occurredOn, today, locale);
    return timeUnsetAtStart && !timeChosen ? day : `${day}, ${formatFriendlyTime(occurredTime, use24Hour)}`;
  })();

  const descriptionFontFamily =
    locale === 'bn' || containsBengali(description)
      ? mapFontToBangla('Manrope_600SemiBold', undefined, theme.banglaFont)
      : 'Manrope_600SemiBold';
  const noteFontFamily =
    locale === 'bn' || containsBengali(note)
      ? mapFontToBangla('Manrope_400Regular', undefined, theme.banglaFont)
      : 'Manrope_400Regular';

  const submit = async (keepOpen: boolean) => {
    if (!canSave || !selectedCategory || parsedAmount === null) return;
    setSaving(true);
    const values: FastEntryValues = {
      type,
      amountMinor: parsedAmount,
      categoryId: selectedCategory.id,
      accountId,
      description: description.trim() || selectedCategory.name,
      note: note.trim(),
      occurredOn,
      occurredTime: timeUnsetAtStart && !timeChosen ? null : occurredTime,
    };
    try {
      if (keepOpen && onSubmitAndAddAnother) {
        await onSubmitAndAddAnother(values);
        setSavedRows((rows) =>
          [
            {
              key: `${Date.now()}`,
              type,
              amountMinor: parsedAmount,
              label: values.description,
              time: occurredTime,
            },
            ...rows,
          ].slice(0, 5)
        );
        setAmountText('');
        setDescription('');
        setNote('');
        setNoteOpen(false);
        if (!timeTouched) setOccurredTime(currentLocalTime());
      } else {
        await onSubmit(values);
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    ...theme.cardShadow,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: theme.spacing.sm }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.headerBtn}
        >
          <AppIcon name="x" size={22} color={theme.colors.text} />
        </PressableScale>
        <TypeSwitch type={type} onChange={setType} />
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: theme.geometry.screenMargin, gap: theme.spacing.sm }]}
      >
        {/* Amount */}
        <View style={styles.amount}>
          <View style={styles.amountRow}>
            {isIncome && parsedAmount !== null ? (
              <AppText variant="hero" style={{ color: theme.colors.income }}>+</AppText>
            ) : null}
            <Money
              amountMinor={parsedAmount ?? 0}
              currency={currency}
              variant="hero"
              animate={false}
              showDecimals={amountText.includes('.')}
              color={parsedAmount === null ? 'textTertiary' : isIncome ? 'income' : 'expense'}
            />
          </View>
        </View>

        {/* What for */}
        <View style={[styles.field, fieldStyle]}>
          <AppIcon name="pencil" size={17} color={theme.colors.textTertiary} />
          <TextInput
            accessibilityLabel={t('fast.whatFor')}
            placeholder={isIncome ? t('fast.whereFromPlaceholder') : t('fast.whatForPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            returnKeyType="done"
            maxLength={80}
            style={[styles.input, { color: theme.colors.text, fontFamily: descriptionFontFamily }]}
            testID="fast-description"
          />
          {description ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('fast.clearDescription')}
              onPress={() => setDescription('')}
              style={styles.clearBtn}
            >
              <AppIcon name="x" size={16} color={theme.colors.textTertiary} />
            </PressableScale>
          ) : null}
        </View>

        {visibleSuggestions.length > 0 ? (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.sm }}
            style={styles.bleed}
          >
            <View style={{ width: theme.geometry.screenMargin - theme.spacing.sm }} />
            {visibleSuggestions.map((s) => (
              <PressableScale
                key={s.description}
                accessibilityRole="button"
                accessibilityLabel={s.description}
                onPress={() => applySuggestion(s)}
                style={[
                  styles.suggestion,
                  { borderRadius: theme.radius.pill, borderColor: theme.colors.separator, backgroundColor: theme.colors.surface },
                ]}
              >
                <AppText
                  variant="label"
                  color="textSecondary"
                  numberOfLines={1}
                  style={{
                    minWidth: estimateSingleLineMinWidth(s.description, theme.typography.label.fontSize),
                    textAlign: 'center',
                  }}
                >
                  {s.description}
                </AppText>
              </PressableScale>
            ))}
            <View style={{ width: theme.geometry.screenMargin - theme.spacing.sm }} />
          </ScrollView>
        ) : null}

        {/* Category */}
        <View style={{ gap: theme.spacing.xs }}>
          <View style={styles.labelRow}>
            <AppText variant="overline" color="textTertiary">
              {t('common.category').toUpperCase()}
            </AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('fast.allCategories')}
              onPress={() => setCategoryOpen(true)}
              style={styles.linkBtn}
            >
              <AppText
                variant="label"
                color="accent"
                numberOfLines={1}
                style={{
                  minWidth: estimateSingleLineMinWidth(t('fast.allCategories'), theme.typography.label.fontSize),
                  textAlign: 'right',
                }}
              >
                {t('fast.allCategories')}
              </AppText>
            </PressableScale>
          </View>
          <View style={[styles.catGrid, { gap: theme.spacing.sm }]}>
            {quickCategories.map((category) => {
              const active = category.id === categoryId;
              return (
                <PressableScale
                  key={category.id}
                  pressScale={0.96}
                  accessibilityRole="button"
                  accessibilityLabel={category.name}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticSelection();
                    setCategory(active ? null : category.id);
                  }}
                  style={[
                    styles.catCell,
                    {
                      borderRadius: theme.radius.md,
                      borderColor: active ? theme.colors.accent : theme.colors.separator,
                      backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
                    },
                  ]}
                >
                  <IconTile icon={category.icon as AppIconName} colorKey={category.colorKey} size={24} />
                  <AppText
                    variant="caption"
                    style={[styles.catLabel, { color: active ? theme.colors.text : theme.colors.textSecondary }]}
                  >
                    {category.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
          {selectedCategory && !quickCategories.some((c) => c.id === selectedCategory.id) ? (
            <AppText variant="caption" color="textSecondary">
              {t('fast.selectedCategory', { name: selectedCategory.name })}
            </AppText>
          ) : null}
        </View>

        {/* Wallet + When */}
        <View style={[styles.detailRow, { gap: theme.spacing.sm }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t('fast.wallet')}: ${selectedAccount?.name ?? t('tx.noWallet')}`}
            onPress={() => setWalletOpen(true)}
            style={[styles.detail, fieldStyle]}
          >
            {selectedAccount ? (
              <WalletAvatar account={selectedAccount} size="xs" />
            ) : (
              <AppIcon name="wallet" size={16} color={theme.colors.textTertiary} />
            )}
            <View style={styles.detailText}>
              <AppText variant="caption" color="textTertiary">
                {isIncome ? t('fast.into') : t('fast.from')}
              </AppText>
              <AppText variant="label" numberOfLines={1} ellipsizeMode="clip">
                {selectedAccount?.name ?? t('tx.noWallet')}
              </AppText>
            </View>
            <AppIcon name="chevron-down" size={15} color={theme.colors.textTertiary} />
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${t('dateTime.when')}: ${whenLabel}`}
            onPress={() => setWhenOpen(true)}
            style={[styles.detail, styles.detailWide, fieldStyle]}
            testID="fast-when"
          >
            <AppIcon name="calendar" size={16} color={theme.colors.textTertiary} />
            <View style={styles.detailText}>
              <AppText variant="caption" color="textTertiary">
                {t('dateTime.when')}
              </AppText>
              <AppText variant="label" numberOfLines={1} ellipsizeMode="clip" tabularNums>
                {whenLabel}
              </AppText>
            </View>
            <AppIcon name="chevron-down" size={15} color={theme.colors.textTertiary} />
          </PressableScale>
        </View>

        {noteOpen ? (
          <View style={[styles.field, fieldStyle]}>
            <AppIcon name="message-circle" size={17} color={theme.colors.textTertiary} />
            <TextInput
              accessibilityLabel={t('common.note')}
              placeholder={t('tx.notePlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              value={note}
              onChangeText={setNote}
              autoFocus
              style={[styles.input, { color: theme.colors.text, fontFamily: noteFontFamily }]}
            />
          </View>
        ) : null}

        {!keyboardVisible ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {!noteOpen ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('tx.addNoteCta')}
                  onPress={() => setNoteOpen(true)}
                  style={styles.addNote}
                >
                  <AppIcon name="plus" size={15} color={theme.colors.textSecondary} />
                  <AppText variant="label" color="textSecondary">
                    {t('tx.addNoteCta')}
                  </AppText>
                </PressableScale>
              ) : (
                <View />
              )}
              {!isEdit ? (
                <PressableScale
                  testID="fast-inbox-shortcut"
                  accessibilityRole="button"
                  accessibilityLabel={t('fast.captureShortcut')}
                  onPress={() => {
                    hapticSelection();
                    router.push('/inbox' as never);
                  }}
                  style={[
                    styles.addNote,
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: theme.radius.pill,
                      backgroundColor: theme.colors.accentSoft,
                    },
                  ]}
                >
                  <AppIcon name="scan-line" size={14} color={theme.colors.accent} />
                  <AppText variant="caption" color="accent" style={{ fontWeight: '600' }}>
                    {t('fast.captureShortcut')}
                  </AppText>
                </PressableScale>
              ) : null}
            </View>
            <RepeatChips
              entries={repeatEntries}
              categoriesById={categoriesById}
              currency={currency}
              onSelect={applyRepeat}
            />
            {presetsEnabled ? (
              <PresetAmounts
                amounts={presetAmounts}
                typedAmountMinor={parsedAmount}
                canPin={canPin}
                currency={currency}
                onSelect={(minor) => setAmountText(formatMinorToDraft(minor))}
                onPin={() => {
                  if (parsedAmount !== null) onPinnedAmountsChange?.(pinAmount(pinned, type, parsedAmount));
                }}
                onRemove={(minor) => onPinnedAmountsChange?.(unpinAmount(pinned, type, minor))}
              />
            ) : null}
            <Keypad value={amountText} onChange={setAmountText} keyHeight={48} variant="tonal" testID="fast-keypad" />
          </View>
        ) : null}

        {savedRows.length > 0 ? (
          <View style={[styles.saved, theme.cardShadow, { borderRadius: theme.radius.card, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.surface }]}>
            <AppText variant="overline" color="textTertiary">
              {t('fast.addedNow').toUpperCase()}
            </AppText>
            {savedRows.map((row) => (
              <View key={row.key} style={styles.savedRow}>
                <AppText variant="caption" color="textTertiary" tabularNums style={styles.savedTime}>
                  {formatFriendlyTime(row.time, use24Hour)}
                </AppText>
                <AppText variant="label" style={styles.flex}>
                  {row.label}
                </AppText>
                <Money
                  amountMinor={row.type === 'income' ? row.amountMinor : -row.amountMinor}
                  currency={currency}
                  variant="label"
                  color={row.type === 'income' ? 'income' : 'expense'}
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {!keyboardVisible ? (
        <View style={[styles.footer, { borderTopColor: theme.colors.separator, paddingHorizontal: theme.geometry.screenMargin, gap: theme.spacing.sm }]}>
          {isEdit ? (
            <Button
              title={t('common.delete')}
              variant="danger"
              leftIcon="trash-2"
              onPress={() => onDeletePress?.()}
              style={styles.flex}
              testID="tx-delete-button"
            />
          ) : (
            <Button
              title={t('fast.saveNext')}
              variant="secondary"
              disabled={!canSave || !onSubmitAndAddAnother}
              onPress={() => void submit(true)}
              style={styles.flex}
              testID="fast-save-next"
            />
          )}
          <Button
            title={t('common.save')}
            disabled={!canSave}
            loading={saving}
            onPress={() => void submit(false)}
            style={styles.flex}
            testID="fast-save"
          />
        </View>
      ) : null}

      <Sheet visible={categoryOpen} onClose={() => setCategoryOpen(false)} title={t('common.category')} testID="fast-category-sheet">
        <View style={[styles.sheetGrid, { gap: theme.spacing.sm }]}>
          {typeCategories.map((category) => {
            const active = category.id === categoryId;
            return (
              <PressableScale
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={category.name}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  setCategory(category.id);
                  setCategoryOpen(false);
                }}
                style={[
                  styles.sheetCell,
                  {
                    borderRadius: theme.radius.md,
                    borderColor: active ? theme.colors.accent : theme.colors.separator,
                    backgroundColor: active ? theme.colors.accentSoft : 'transparent',
                  },
                ]}
              >
                <IconTile icon={category.icon as AppIconName} colorKey={category.colorKey} size={36} />
                <AppText variant="caption" style={styles.sheetLabel}>
                  {category.name}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </Sheet>

      <DateTimeSheet
        visible={whenOpen}
        mode="datetime"
        date={occurredOn}
        time={occurredTime}
        maxDate={today}
        weekStartsOn={weekStartsOn}
        use24Hour={use24Hour}
        onChange={({ date, time }) => {
          setOccurredOn(date);
          setOccurredTime(time);
          setTimeTouched(true);
          setTimeChosen(true);
        }}
        onClose={() => setWhenOpen(false)}
      />
      <WalletPickerSheet
        visible={walletOpen}
        onClose={() => setWalletOpen(false)}
        title={t('tx.chooseWalletTitle')}
        accounts={accounts}
        selectedAccountId={accountId}
        allowNone
        currency={currency}
        onSelect={(next) => {
          setAccountId(next);
          setWalletOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  typeSwitch: { flexDirection: 'row', alignItems: 'center', height: 34, padding: 3 },
  typeThumb: { position: 'absolute', top: 2, left: 2, width: THUMB_W, height: 28 },
  typeBtn: { width: THUMB_W, height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  content: { paddingTop: 0, paddingBottom: 8 },
  amount: { alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  field: { minHeight: 46, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, minHeight: 44, fontSize: 16 },
  clearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bleed: { marginHorizontal: -20 },
  suggestion: { minHeight: 34, paddingHorizontal: 14, borderWidth: 1, justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkBtn: { minHeight: 28, justifyContent: 'center', paddingLeft: 12 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  catCell: { width: '31.6%', minHeight: 62, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 5, gap: 4 },
  catLabel: { textAlign: 'center' },
  detailRow: { flexDirection: 'row' },
  detail: { flex: 1, minHeight: 48, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  detailWide: { flex: 1.06 },
  detailText: { flex: 1 },
  addNote: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  saved: { borderWidth: 1, padding: 14, gap: 10 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedTime: { width: 64 },
  flex: { flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingBottom: 8, flexDirection: 'row' },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sheetCell: { width: '31.6%', minHeight: 82, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 8 },
  sheetLabel: { textAlign: 'center' },
});
