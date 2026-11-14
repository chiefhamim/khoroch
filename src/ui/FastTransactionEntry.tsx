import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { addDays, formatFriendlyDate, todayLocalDate } from '@/domain/dates';
import { parseMoneyInput } from '@/domain/money';
import type { Account, Category, CurrencyCode, LocalDate, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { DateTimeSheet } from './DateTimeSheet';
import { Keypad } from './Keypad';
import { Money } from './Money';
import { Sheet } from './Sheet';
import { WalletAvatar } from './WalletAvatar';
import { WalletPickerSheet } from './WalletPickerSheet';
import { PressableScale } from './PressableScale';

export interface FastTransactionEntryProps {
  currency: CurrencyCode;
  categories: Category[];
  accounts: Account[];
  defaultAccountId?: string | null;
  recentTransactions?: Transaction[];
  onClose: () => void;
  onSubmit: (values: {
    type: 'expense';
    amountMinor: number;
    categoryId: string;
    accountId: string | null;
    description: string;
    note: string;
    occurredOn: LocalDate;
    occurredTime: string | null;
  }) => Promise<void>;
  onSubmitAndAddAnother?: (values: {
    type: 'expense';
    amountMinor: number;
    categoryId: string;
    accountId: string | null;
    description: string;
    note: string;
    occurredOn: LocalDate;
    occurredTime: string | null;
  }) => Promise<void>;
}

function draftAmount(text: string): number | null {
  const parsed = parseMoneyInput(text);
  return parsed.ok && parsed.minor !== null && parsed.minor > 0 ? parsed.minor : null;
}

export function FastTransactionEntry({
  currency,
  categories,
  accounts,
  defaultAccountId,
  recentTransactions = [],
  onClose,
  onSubmit,
  onSubmitAndAddAnother,
}: FastTransactionEntryProps) {
  const { theme } = useTheme();
  const today = todayLocalDate();
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(
    () => categories.find((category) => category.kind === 'expense' && category.isSelected)?.id ?? null
  );
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId && accounts.some((account) => account.id === defaultAccountId)
      ? defaultAccountId
      : accounts[0]?.id ?? null
  );
  const [occurredOn, setOccurredOn] = useState<LocalDate>(today);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRows, setSavedRows] = useState<{ amountMinor: number; categoryName: string }[]>([]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense' && category.archivedAt === null),
    [categories]
  );
  const recentCategoryIds = useMemo(() => {
    const ids: string[] = [];
    for (const transaction of recentTransactions) {
      if (transaction.type !== 'expense' || !transaction.categoryId || ids.includes(transaction.categoryId)) continue;
      ids.push(transaction.categoryId);
      if (ids.length === 5) break;
    }
    return ids;
  }, [recentTransactions]);
  const quickCategories = useMemo(() => {
    const recent = recentCategoryIds
      .map((id) => expenseCategories.find((category) => category.id === id))
      .filter((category): category is Category => Boolean(category));
    return [...recent, ...expenseCategories.filter((category) => !recentCategoryIds.includes(category.id))].slice(0, 5);
  }, [expenseCategories, recentCategoryIds]);
  const selectedCategory = expenseCategories.find((category) => category.id === categoryId) ?? quickCategories[0] ?? null;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const parsedAmount = draftAmount(amountText);
  const canSave = parsedAmount !== null && selectedCategory !== null && !saving;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const submit = async (keepOpen: boolean) => {
    if (!canSave || !selectedCategory || parsedAmount === null) return;
    setSaving(true);
    const values = {
      type: 'expense' as const,
      amountMinor: parsedAmount,
      categoryId: selectedCategory.id,
      accountId,
      description: selectedCategory.name,
      note: note.trim(),
      occurredOn,
      occurredTime: null,
    };
    try {
      if (keepOpen && onSubmitAndAddAnother) {
        await onSubmitAndAddAnother(values);
        setSavedRows((rows) => [{ amountMinor: parsedAmount, categoryName: selectedCategory.name }, ...rows].slice(0, 4));
        setAmountText('');
        setNote('');
        setNoteOpen(false);
      } else {
        await onSubmit(values);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <View style={[styles.header, { paddingHorizontal: theme.geometry.screenMargin }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.close}
        >
          <AppIcon name="x" size={22} color={theme.colors.text} />
        </PressableScale>
        <AppText variant="headline">{t('tx.newTitle')}</AppText>
        <View style={styles.close} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: theme.geometry.screenMargin }]}
      >
        <View style={styles.amount}>
          <Money
            amountMinor={parsedAmount ?? 0}
            currency={currency}
            variant="hero"
            showDecimals
            color={parsedAmount === null ? 'textTertiary' : 'text'}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label={selectedCategory?.name ?? t('common.category')}
            icon="shapes"
            selected={categoryOpen}
            onPress={() => setCategoryOpen(true)}
          />
          <Chip
            label={selectedAccount?.name ?? t('tx.noWallet')}
            left={selectedAccount ? <WalletAvatar account={selectedAccount} size="xs" /> : undefined}
            selected={Boolean(selectedAccount)}
            onPress={() => setWalletOpen(true)}
          />
          <Chip
            label={occurredOn === today ? t('common.today') : occurredOn === addDays(today, -1) ? t('common.yesterday') : formatFriendlyDate(occurredOn, today)}
            icon="calendar"
            selected={whenOpen}
            onPress={() => setWhenOpen(true)}
          />
        </ScrollView>

        {noteOpen ? (
          <View style={[styles.noteRow, { borderColor: theme.colors.separator }]}>
            <AppIcon name="pencil" size={18} color={theme.colors.textSecondary} />
            <TextInput
              accessibilityLabel={t('common.note')}
              placeholder={t('tx.notePlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              value={note}
              onChangeText={setNote}
              style={[styles.noteInput, { color: theme.colors.text }]}
            />
          </View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('tx.addNoteCta')}
            onPress={() => setNoteOpen(true)}
            style={styles.addNote}
          >
            <AppIcon name="plus" size={16} color={theme.colors.accent} />
            <AppText variant="label" color="accent">{t('tx.addNoteCta')}</AppText>
          </PressableScale>
        )}

        {!keyboardVisible && !noteOpen ? (
          <Keypad value={amountText} onChange={setAmountText} keyHeight={56} testID="fast-keypad" />
        ) : null}

        {savedRows.length > 0 ? (
          <View style={[styles.saved, { borderColor: theme.colors.separator }]}>
            <AppText variant="caption" color="textSecondary">{t('tx.saved')}</AppText>
            {savedRows.map((row, index) => (
              <View key={`${row.categoryName}-${index}`} style={styles.savedRow}>
                <AppText variant="label" style={styles.savedLabel}>{row.categoryName}</AppText>
                <Money amountMinor={row.amountMinor} currency={currency} variant="label" />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {!keyboardVisible ? (
        <View style={[styles.footer, { borderTopColor: theme.colors.separator, paddingHorizontal: theme.geometry.screenMargin }]}>
          <Button title={t('common.save')} disabled={!canSave} loading={saving} onPress={() => void submit(false)} style={styles.flex} />
          <Button
            title={t('tx.saveAndAddAnother')}
            variant="secondary"
            disabled={!canSave || !onSubmitAndAddAnother}
            onPress={() => void submit(true)}
            style={styles.flex}
          />
        </View>
      ) : null}

      <Sheet visible={categoryOpen} onClose={() => setCategoryOpen(false)} title={t('common.category')} testID="fast-category-sheet">
        <View style={styles.categoryGrid}>
          {[...quickCategories, ...expenseCategories.filter((category) => !quickCategories.includes(category))].map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={category.id === categoryId}
              onPress={() => {
                setCategoryId(category.id);
                setCategoryOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>

      <DateTimeSheet
        visible={whenOpen}
        mode="date"
        date={occurredOn}
        onDateChange={setOccurredOn}
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
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 16, paddingTop: 12, paddingBottom: 16 },
  amount: { alignItems: 'center', minHeight: 64, justifyContent: 'center' },
  chips: { gap: 8, paddingVertical: 2 },
  addNote: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteRow: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { flex: 1 },
  noteInput: { flex: 1, minHeight: 48, fontSize: 15 },
  saved: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  savedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  savedLabel: { flex: 1 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
