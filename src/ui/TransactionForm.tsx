import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  addDays,
  currentLocalTime,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import { feeMinorFromRate, formatFeeRateBp } from '@/domain/fees';
import {
  formatMinorToDraft,
  formatMoney,
  getCurrencySymbol,
  groupThousands,
  parseMoneyInput,
  parseNonNegativeMoneyInput,
} from '@/domain/money';
import type {
  Account,
  Category,
  CategoryColorKey,
  CurrencyCode,
  LocalDate,
  PinnedAmounts,
  Transaction,
  TransactionType,
} from '@/domain/types';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTE_LENGTH,
  isValidLocalTime,
} from '@/domain/validation';
import { t, useLocale } from '@/i18n';
import { CATEGORY_COLORS, CATEGORY_COLOR_KEYS } from '@/theme/categoryColors';
import {
  TAKA_FONT_FAMILY,
  containsBengali,
  mapFontToBangla,
} from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, CATEGORY_ICON_CHOICES } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { FastTransactionEntry } from './FastTransactionEntry';
import { hapticLight, hapticSelection } from './haptics';
import { IconButton } from './IconButton';
import { IconTile } from './IconTile';
import { Keypad } from './Keypad';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { Surface } from './Surface';
import { TimeField } from './TimeField';
import { WalletAvatar } from './WalletAvatar';
import { WalletPickerSheet } from './WalletPickerSheet';
import { PressableScale } from '@/ui/PressableScale';

export type TransactionEntryMode = TransactionType | 'transfer';

export interface TransactionFormValues {
  type: TransactionType;
  amountMinor: number;
  categoryId: string | null;
  accountId: string | null;
  description: string;
  note: string;
  occurredOn: LocalDate;
  occurredTime: string | null;
}

export interface TransferFormValues {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  feeMinor: number;
  occurredOn: LocalDate;
  occurredTime: string | null;
  note: string;
}

export interface CreateCategoryInput {
  name: string;
  kind: TransactionType;
  icon: string;
  colorKey: CategoryColorKey;
}

export interface TransactionFormProps {
  mode?: 'new' | 'edit';
  fastEntry?: boolean;
  currency: CurrencyCode;
  categories: Category[];
  accounts?: Account[];
  defaultAccountId?: string | null;
  balancesById?: ReadonlyMap<string, number>;
  onPressSetupWallets?: () => void;
  onPressLendBorrow?: (prefill: {
    amountMinor: number | null;
    accountId: string | null;
    occurredOn: LocalDate;
  }) => void;
  recentDescriptions?: string[];
  recentTransactions?: Transaction[];
  pinnedAmounts?: PinnedAmounts;
  onPinnedAmountsChange?: (next: PinnedAmounts) => void;
  initialMode?: TransactionEntryMode;
  initialValues?: {
    type?: TransactionType;
    amountMinor?: number;
    categoryId?: string | null;
    accountId?: string | null;
    description?: string;
    note?: string;
    occurredOn?: LocalDate;
    occurredTime?: string | null;
  };
  initialTransferValues?: {
    fromAccountId?: string;
    toAccountId?: string;
    amountMinor?: number;
    feeMinor?: number;
    occurredOn?: LocalDate;
    occurredTime?: string | null;
    note?: string;
  };
  submitLabel?: string;
  onClose?: () => void;
  onDeletePress?: () => void;
  onMorePress?: () => void;
  onCreateCategory?: (input: CreateCategoryInput) => Promise<Category>;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onSubmitAndAddAnother?: (values: TransactionFormValues) => Promise<void>;
  onSubmitTransfer?: (values: TransferFormValues) => Promise<void>;
}

const CATEGORY_SUGGESTION_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  food_dining: ['Lunch', 'Dinner', 'Coffee', 'Breakfast'],
  groceries: ['Groceries', 'Vegetables', 'Fruits', 'Supermarket'],
  transportation: ['Uber', 'Rickshaw', 'CNG', 'Fuel'],
  shopping: ['Clothes', 'Shoes', 'Online order', 'Essentials'],
  housing_rent: ['House rent', 'Maintenance', 'Service charge'],
  utilities: ['Electricity bill', 'Internet bill', 'Gas bill', 'Water bill'],
  health: ['Medicine', 'Doctor visit', 'Lab test', 'Pharmacy'],
  entertainment: ['Movie', 'Streaming', 'Games'],
  education: ['Tuition', 'Books', 'Course'],
  travel: ['Flight', 'Hotel', 'Train ticket'],
  subscriptions: ['Spotify', 'Netflix', 'iCloud'],
  personal_care: ['Haircut', 'Skincare', 'Toiletries'],
  family: ['Family expense', 'Parents', 'Kids'],
  gifts: ['Birthday gift', 'Present'],
  other: ['Misc', 'Transfer'],
  salary: ['Monthly salary', 'Bonus'],
  rent_income: ['Monthly rent', 'Advance rent'],
  business: ['Client payment', 'Consulting', 'Project fee'],
  gift_received: ['Birthday gift', 'Eid gift', 'Cash gift'],
  other_income: ['Refund', 'Cashback', 'Dividend'],
};

const TYPE_FALLBACK_SUGGESTIONS: Readonly<Record<TransactionType, readonly string[]>> = {
  expense: ['Lunch', 'Coffee', 'Uber', 'Groceries'],
  income: ['Monthly salary', 'Client payment', 'Monthly rent', 'Refund'],
};

export function formatHeroAmountText(raw: string): string {
  if (!raw) return '0';
  const dotIdx = raw.indexOf('.');
  if (dotIdx === -1) {
    const cleanWhole = raw.replace(/^0+(?=\d)/, '') || '0';
    return groupThousands(cleanWhole);
  }
  const wholeRaw = raw.slice(0, dotIdx);
  const fracRaw = raw.slice(dotIdx + 1);
  const cleanWhole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  return `${groupThousands(cleanWhole)}.${fracRaw}`;
}

export function orderCategoriesForPicker(
  categories: readonly Category[],
  kind: TransactionType,
  recentTransactions: readonly Transaction[] = []
): Category[] {
  const active = categories.filter((c) => c.kind === kind && c.archivedAt === null);

  interface UsageStats {
    count: number;
    latestSortKey: string;
  }
  const statsByCat = new Map<string, UsageStats>();

  for (const tx of recentTransactions) {
    if (tx.deletedAt !== null || tx.type !== kind || !tx.categoryId) continue;
    const key = `${tx.occurredOn}|${String(tx.createdAt).padStart(16, '0')}`;
    const prev = statsByCat.get(tx.categoryId);
    if (!prev) {
      statsByCat.set(tx.categoryId, { count: 1, latestSortKey: key });
    } else {
      prev.count += 1;
      if (key > prev.latestSortKey) {
        prev.latestSortKey = key;
      }
    }
  }

  let mostRecentCatId: string | null = null;
  let mostRecentKey = '';
  for (const [catId, st] of statsByCat.entries()) {
    if (st.latestSortKey > mostRecentKey) {
      mostRecentKey = st.latestSortKey;
      mostRecentCatId = catId;
    }
  }

  return [...active].sort((a, b) => {
    if (a.id === mostRecentCatId && b.id !== mostRecentCatId) return -1;
    if (b.id === mostRecentCatId && a.id !== mostRecentCatId) return 1;

    const stA = statsByCat.get(a.id);
    const stB = statsByCat.get(b.id);
    if (stA && !stB) return -1;
    if (!stA && stB) return 1;
    if (stA && stB) {
      if (stA.count !== stB.count) return stB.count - stA.count;
      if (stA.latestSortKey !== stB.latestSortKey) {
        return stB.latestSortKey.localeCompare(stA.latestSortKey);
      }
    }

    if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

export function buildContextualSuggestions(
  type: TransactionType,
  categoryId: string | null,
  recentTransactions: readonly Transaction[] = []
): string[] {
  const matching = recentTransactions
    .filter(
      (tx) =>
        tx.deletedAt === null &&
        tx.type === type &&
        (categoryId === null || tx.categoryId === categoryId) &&
        tx.description.trim().length > 0
    )
    .sort((a, b) => {
      if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
      return b.createdAt - a.createdAt;
    });

  const out: string[] = [];
  const seen = new Set<string>();

  for (const tx of matching) {
    const clean = tx.description.trim();
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
      if (out.length >= 5) return out;
    }
  }

  const fallbacks =
    categoryId !== null
      ? (CATEGORY_SUGGESTION_FALLBACKS[categoryId] ?? [])
      : TYPE_FALLBACK_SUGGESTIONS[type];

  for (const item of fallbacks) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
      if (out.length >= 5) return out;
    }
  }

  return out;
}

interface AllCategoriesModalProps {
  visible: boolean;
  onClose: () => void;
  type: TransactionType;
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string) => void;
  onCreateCategory?: (input: CreateCategoryInput) => Promise<Category>;
}

function AllCategoriesSheet({
  visible,
  onClose,
  type,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
}: AllCategoriesModalProps) {
  const { theme } = useTheme();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<CategoryColorKey>('orange');
  const [newIcon, setNewIcon] = useState<string>('tag');
  const [savingCat, setSavingCat] = useState(false);

  const handleClose = () => {
    setCreating(false);
    setNewName('');
    onClose();
  };

  const handleStartCreate = () => {
    setNewName('');
    setNewColor(type === 'income' ? 'teal' : 'orange');
    setNewIcon(type === 'income' ? 'banknote' : 'tag');
    setCreating(true);
  };

  const handleCreateSubmit = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !onCreateCategory || savingCat) return;
    setSavingCat(true);
    try {
      const created = await onCreateCategory({
        name: trimmed,
        kind: type,
        icon: newIcon,
        colorKey: newColor,
      });
      hapticSelection();
      setCreating(false);
      setNewName('');
      onSelectCategory(created.id);
      onClose();
    } finally {
      setSavingCat(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={creating ? t('tx.newCategoryTitle') : t('tx.allCategoriesTitle')}
      testID="all-categories-sheet"
    >
      {creating ? (
        <View style={{ gap: theme.spacing.md }}>
          <Field
            testID="new-category-name-input"
            label={t('tx.categoryNamePlaceholder')}
            placeholder={t('tx.categoryNamePlaceholder')}
            value={newName}
            onChangeText={setNewName}
            maxLength={32}
            autoFocus
          />

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('tx.categoryColorLabel')}
            </AppText>
            <View style={styles.paletteRow}>
              {CATEGORY_COLOR_KEYS.map((colorKey) => {
                const swatch = CATEGORY_COLORS[colorKey];
                const isSelected = newColor === colorKey;
                return (
                  <PressableScale pressScale={0.98}
                    key={colorKey}
                    testID={`new-category-color-${colorKey}`}
                    accessibilityRole="button"
                    accessibilityLabel={colorKey}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      hapticSelection();
                      setNewColor(colorKey);
                    }}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor:
                          theme.scheme === 'dark' ? swatch.dark : swatch.light,
                        borderColor: isSelected ? theme.colors.text : 'transparent',
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="label" color="textSecondary">
              {t('tx.categoryIconLabel')}
            </AppText>
            <View style={styles.iconChoiceGrid}>
              {CATEGORY_ICON_CHOICES.map((iconName) => {
                const isSelected = newIcon === iconName;
                return (
                  <PressableScale pressScale={0.98}
                    key={iconName}
                    testID={`new-category-icon-${iconName}`}
                    accessibilityRole="button"
                    accessibilityLabel={iconName}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      hapticSelection();
                      setNewIcon(iconName);
                    }}
                  >
                    <IconTile icon={iconName} colorKey={newColor} selected={isSelected} size="md" />
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.sheetActionsRow}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              onPress={() => setCreating(false)}
              style={styles.flexButton}
            />
            <Button
              testID="new-category-save-button"
              title={t('common.save')}
              variant="primary"
              disabled={newName.trim().length === 0 || savingCat}
              loading={savingCat}
              onPress={() => {
                void handleCreateSubmit();
              }}
              style={styles.flexButton}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {categories.map((cat) => {
            const active = cat.id === selectedCategoryId;
            return (
              <PressableScale pressScale={0.98}
                key={cat.id}
                testID={`cat-sheet-item-${cat.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelection();
                  onSelectCategory(cat.id);
                  handleClose();
                }}
                style={({ pressed }) => [
                  styles.sheetCatRow,
                  {
                    backgroundColor: active
                      ? theme.colors.accentSoft
                      : pressed
                        ? theme.colors.surfaceSunken
                        : 'transparent',
                    borderRadius: theme.radius.md,
                    minHeight: theme.touch.min,
                    paddingHorizontal: theme.spacing.sm,
                  },
                ]}
              >
                <IconTile icon={cat.icon} colorKey={cat.colorKey} selected={active} size="sm" />
                <AppText
                  variant={active ? 'bodyStrong' : 'body'}
                  color={active ? 'accent' : 'text'}
                  style={styles.flex1}
                >
                  {cat.name}
                </AppText>
                {active ? <AppIcon name="check" size={18} color={theme.colors.accent} /> : null}
              </PressableScale>
            );
          })}

          {onCreateCategory ? (
            <Button
              testID="new-category-open-button"
              title={t('tx.newCategoryCta')}
              leftIcon="plus"
              variant="secondary"
              onPress={handleStartCreate}
              style={{ marginTop: theme.spacing.xs }}
            />
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

export function TransactionForm(props: TransactionFormProps) {
  if ((props.fastEntry && props.mode !== 'edit') || (props.mode === 'edit' && !props.initialTransferValues)) {
    return (
      <FastTransactionEntry
        currency={props.currency}
        categories={props.categories}
        accounts={(props.accounts ?? []).filter((account) => account.archivedAt == null)}
        defaultAccountId={props.defaultAccountId}
        recentTransactions={props.recentTransactions}
        pinnedAmounts={props.pinnedAmounts}
        onPinnedAmountsChange={props.onPinnedAmountsChange}
        onClose={props.onClose ?? (() => undefined)}
        onSubmit={props.onSubmit}
        onSubmitAndAddAnother={props.onSubmitAndAddAnother}
        mode={props.mode === 'edit' ? 'edit' : 'new'}
        initialValues={props.initialValues}
        onDeletePress={props.onDeletePress}
      />
    );
  }
  return <LegacyTransactionForm {...props} fastEntry={false} />;
}

function LegacyTransactionForm({
  mode = 'new',
  currency,
  categories,
  accounts = [],
  defaultAccountId = null,
  balancesById,
  onPressSetupWallets,
  onPressLendBorrow,
  recentTransactions = [],
  initialMode,
  initialValues,
  initialTransferValues,
  submitLabel,
  onClose,
  onDeletePress,
  onMorePress,
  onCreateCategory,
  onSubmit,
  onSubmitTransfer,
}: TransactionFormProps) {
  const { theme } = useTheme();
  const locale = useLocale();
  const isEditing = mode === 'edit';
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.archivedAt == null),
    [accounts]
  );
  const accountsMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const [entryMode, setEntryMode] = useState<TransactionEntryMode>(
    () => initialMode ?? initialValues?.type ?? 'expense'
  );
  const txType: TransactionType = entryMode === 'income' ? 'income' : 'expense';
  const isTransferMode = entryMode === 'transfer';

  const [amountText, setAmountText] = useState<string>(() => {
    const initAmt =
      (initialMode === 'transfer' ? initialTransferValues?.amountMinor : undefined) ??
      initialValues?.amountMinor;
    return initAmt && initAmt > 0 ? formatMinorToDraft(initAmt) : '';
  });
  // Strict v2 rule: NO preselected category on new creation.
  const [categoryId, setCategoryId] = useState<string | null>(
    initialValues?.categoryId ?? null
  );
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (isEditing) return initialValues?.accountId ?? null;
    if (initialValues?.accountId !== undefined) return initialValues.accountId;
    if (defaultAccountId && accounts.some((a) => a.id === defaultAccountId && a.archivedAt == null)) {
      return defaultAccountId;
    }
    return null;
  });

  const [fromAccountId, setFromAccountId] = useState<string | null>(() => {
    if (initialTransferValues?.fromAccountId) return initialTransferValues.fromAccountId;
    if (defaultAccountId && activeAccounts.some((a) => a.id === defaultAccountId)) {
      return defaultAccountId;
    }
    return activeAccounts[0]?.id ?? null;
  });
  const [toAccountId, setToAccountId] = useState<string | null>(() => {
    if (initialTransferValues?.toAccountId) return initialTransferValues.toAccountId;
    const initFrom =
      initialTransferValues?.fromAccountId ??
      (defaultAccountId && activeAccounts.some((a) => a.id === defaultAccountId)
        ? defaultAccountId
        : activeAccounts[0]?.id ?? null);
    return activeAccounts.find((a) => a.id !== initFrom)?.id ?? null;
  });
  const [feeText, setFeeText] = useState<string>(() =>
    initialTransferValues?.feeMinor && initialTransferValues.feeMinor > 0
      ? formatMinorToDraft(initialTransferValues.feeMinor)
      : ''
  );
  // True once the user has typed a fee (or opened a saved transfer); false falls back to the wallet default.
  const [feeEdited, setFeeEdited] = useState<boolean>(() => isEditing);

  const [description, setDescription] = useState<string>(initialValues?.description ?? '');
  const [note, setNote] = useState<string>(
    initialTransferValues?.note ?? initialValues?.note ?? ''
  );
  const [noteOpen, setNoteOpen] = useState<boolean>(() => {
    const initialNoteText = initialTransferValues?.note ?? initialValues?.note ?? '';
    return initialNoteText.trim().length > 0;
  });
  const [occurredOn, setOccurredOn] = useState<LocalDate>(
    initialTransferValues?.occurredOn ?? initialValues?.occurredOn ?? todayLocalDate()
  );
  // Strict v2 rule: auto-fill current time ONLY when creating new; preserve on edit.
  const [occurredTime, setOccurredTime] = useState<string>(() => {
    if (isEditing) {
      return initialTransferValues?.occurredTime ?? initialValues?.occurredTime ?? '';
    }
    if (initialTransferValues?.occurredTime !== undefined) {
      return initialTransferValues.occurredTime ?? '';
    }
    if (initialValues?.occurredTime !== undefined) {
      return initialValues.occurredTime ?? '';
    }
    return currentLocalTime();
  });

  const [allCatsOpen, setAllCatsOpen] = useState(false);
  const [walletPickerTarget, setWalletPickerTarget] = useState<'tx' | 'from' | 'to' | null>(
    null
  );
  const [activeField, setActiveField] = useState<'description' | 'note' | 'fee' | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const savingRef = useRef(false);
  const descriptionRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const noteRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const feeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setActiveField(null);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const orderedCategories = useMemo(
    () => orderCategoriesForPicker(categories, txType, recentTransactions),
    [categories, txType, recentTransactions]
  );

  const showLendBorrowTile = !isEditing && Boolean(onPressLendBorrow);

  const gridCategories = useMemo(() => {
    const slotCount = showLendBorrowTile ? 6 : 7;
    const topCategories = orderedCategories.slice(0, slotCount);
    if (!categoryId || topCategories.some((c) => c.id === categoryId)) {
      return topCategories;
    }
    const selectedCat = categories.find((c) => c.id === categoryId && c.kind === txType);
    if (!selectedCat) return topCategories;
    return [...orderedCategories.slice(0, slotCount - 1), selectedCat];
  }, [orderedCategories, showLendBorrowTile, categoryId, categories, txType]);

  const suggestions = useMemo(
    () => buildContextualSuggestions(txType, categoryId, recentTransactions),
    [txType, categoryId, recentTransactions]
  );

  const parsedAmount = useMemo(() => parseMoneyInput(amountText), [amountText]);
  const validAmountMinor =
    parsedAmount.ok && parsedAmount.minor !== null && parsedAmount.minor > 0
      ? parsedAmount.minor
      : null;

  const selectedAccount = accountId ? accountsMap.get(accountId) ?? null : null;
  const fromAccount = fromAccountId ? accountsMap.get(fromAccountId) ?? null : null;
  const toAccount = toAccountId ? accountsMap.get(toAccountId) ?? null : null;

  // Default fee: pre-fill from the source wallet's rate until the user types a fee by hand.
  const defaultFeeBp =
    isTransferMode && fromAccount?.defaultFeeBp != null && fromAccount.defaultFeeBp > 0
      ? fromAccount.defaultFeeBp
      : null;
  const autoFeeMinor = feeMinorFromRate(validAmountMinor ?? 0, defaultFeeBp);
  const feeIsAuto = defaultFeeBp !== null && !feeEdited;
  const shownFeeText = feeIsAuto ? (autoFeeMinor > 0 ? formatMinorToDraft(autoFeeMinor) : '') : feeText;

  const feeTrimmed = shownFeeText.trim();
  const parsedFee = useMemo(
    () => (feeTrimmed.length > 0 ? parseNonNegativeMoneyInput(feeTrimmed) : null),
    [feeTrimmed]
  );
  const feeMinorValid =
    feeTrimmed.length === 0 ||
    (parsedFee !== null && parsedFee.ok && parsedFee.minor !== null && parsedFee.minor >= 0);
  const validFeeMinor =
    feeTrimmed.length === 0
      ? 0
      : parsedFee && parsedFee.ok && parsedFee.minor !== null
        ? parsedFee.minor
        : 0;

  const canSave = isTransferMode
    ? validAmountMinor !== null &&
      fromAccountId !== null &&
      toAccountId !== null &&
      fromAccountId !== toAccountId &&
      feeMinorValid &&
      !saving
    : validAmountMinor !== null && categoryId !== null && !saving;

  const hideKeypad =
    activeField !== null ||
    keyboardVisible ||
    (isTransferMode && activeAccounts.length < 2);

  const dismissTextInputs = () => {
    descriptionRef.current?.blur();
    noteRef.current?.blur();
    feeRef.current?.blur();
    Keyboard.dismiss();
    setActiveField(null);
    setKeyboardVisible(false);
  };

  const handleModeChange = (nextMode: TransactionEntryMode) => {
    if (nextMode === entryMode) return;
    if (entryMode !== 'transfer' && nextMode !== 'transfer') {
      // Switching Out <-> In clears category selection (different category sets).
      setCategoryId(null);
    }
    setEntryMode(nextMode);
    setErrorMsg(null);
  };

  const handleSelectCategory = (id: string) => {
    hapticSelection();
    dismissTextInputs();
    setCategoryId(id);
    setErrorMsg(null);
  };

  const handleSelectWallet = (chosenId: string | null) => {
    if (walletPickerTarget === 'tx') {
      setAccountId(chosenId);
    } else if (walletPickerTarget === 'from' && chosenId) {
      if (chosenId === toAccountId) {
        setToAccountId(fromAccountId);
      }
      setFromAccountId(chosenId);
    } else if (walletPickerTarget === 'to' && chosenId) {
      if (chosenId === fromAccountId) {
        setFromAccountId(toAccountId);
      }
      setToAccountId(chosenId);
    }
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (savingRef.current || !canSave || validAmountMinor === null) {
      if (!savingRef.current && validAmountMinor === null) {
        if (!parsedAmount.ok) {
          setErrorMsg(
            parsedAmount.error === 'too_large'
              ? t('tx.errorTooLarge')
              : parsedAmount.error === 'too_many_decimals'
                ? t('tx.errorTooManyDecimals')
                : t('tx.errorInvalidAmount')
          );
        } else {
          setErrorMsg(t('tx.errorInvalidAmount'));
        }
      } else if (!savingRef.current && isTransferMode && fromAccountId === toAccountId) {
        setErrorMsg(t('transfer.sameAccountError'));
      }
      return;
    }

    const trimmedDate = occurredOn.trim();
    const today = todayLocalDate();
    if (!isValidLocalDate(trimmedDate) || trimmedDate > addDays(today, 30)) {
      setErrorMsg(t('tx.errorInvalidDate'));
      return;
    }

    const trimmedTime = occurredTime.trim();
    if (trimmedTime && !isValidLocalTime(trimmedTime)) {
      setErrorMsg(t('tx.errorInvalidTime'));
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (isTransferMode) {
        if (!onSubmitTransfer || !fromAccountId || !toAccountId) {
          return;
        }
        await onSubmitTransfer({
          fromAccountId,
          toAccountId,
          amountMinor: validAmountMinor,
          feeMinor: validFeeMinor,
          occurredOn: trimmedDate,
          occurredTime: trimmedTime || null,
          note: note.trim(),
        });
      } else {
        await onSubmit({
          type: txType,
          amountMinor: validAmountMinor,
          categoryId,
          accountId,
          description: description.trim(),
          note: note.trim(),
          occurredOn: trimmedDate,
          occurredTime: trimmedTime || null,
        });
      }
    } catch {
      setErrorMsg(t('tx.errorSaveFailed'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const heroFormatted = formatHeroAmountText(amountText);
  const symbol = getCurrencySymbol(currency);
  const isCompactHero = heroFormatted.length >= 9;
  const amountFontSize = isCompactHero ? 34 : 44;
  const amountLineHeight = isCompactHero ? 40 : 50;
  const symbolFontSize = Math.round(amountFontSize * 0.6);
  const heroColor =
    amountText.length === 0
      ? theme.colors.textTertiary
      : entryMode === 'income'
        ? theme.colors.income
        : entryMode === 'expense'
          ? theme.colors.expense
          : theme.colors.text;

  const primaryLabel = (() => {
    if (isTransferMode) {
      if (isEditing) return submitLabel ?? t('transfer.updateCta');
      const amountStr = formatMoney(validAmountMinor ?? 0, currency);
      return t('transfer.saveCta', { amount: amountStr });
    }
    if (submitLabel) return submitLabel;
    if (validAmountMinor !== null) {
      const amountStr = formatMoney(validAmountMinor, currency);
      if (selectedAccount) {
        return txType === 'income'
          ? t('tx.saveIntoWallet', { amount: amountStr, wallet: selectedAccount.name })
          : t('tx.saveFromWallet', { amount: amountStr, wallet: selectedAccount.name });
      }
      return t('tx.saveWithAmount', { amount: amountStr });
    }
    return txType === 'income' ? t('tx.saveIncomeCta') : t('tx.saveExpenseCta');
  })();

  const showCashOutFeeHint =
    isTransferMode &&
    fromAccount?.kind === 'mobile_wallet' &&
    toAccount?.kind === 'cash';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Top Bar: Close + Segmented Control + Optional More Menu */}
      <View
        style={[
          styles.topBar,
          {
            paddingHorizontal: theme.geometry.screenMargin,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.xs,
          },
        ]}
      >
        <IconButton
          testID="tx-close-button"
          icon="x"
          variant="sunken"
          size={40}
          accessibilityLabel={t('tx.closeForm')}
          onPress={() => {
            hapticLight();
            dismissTextInputs();
            onClose?.();
          }}
        />
        <View style={styles.topCenter}>
          {isEditing && initialMode === 'transfer' ? (
            <AppText
              variant="headline"
              numberOfLines={1}
              style={styles.topTitle}
            >
              {t('transfer.editTitle')}
            </AppText>
          ) : (
            <SegmentedControl<TransactionEntryMode>
              testID="tx-type-toggle"
              size="sm"
              value={entryMode}
              onChange={handleModeChange}
              options={
                isEditing
                  ? [
                      { value: 'expense', label: t('tx.typeOut') },
                      { value: 'income', label: t('tx.typeIn') },
                    ]
                  : [
                      { value: 'expense', label: t('tx.typeOut') },
                      { value: 'income', label: t('tx.typeIn') },
                      { value: 'transfer', label: t('tx.typeTransfer') },
                    ]
              }
            />
          )}
        </View>
        {isEditing && !onDeletePress && onMorePress ? (
          <IconButton
            testID="tx-more-button"
            icon="sliders-horizontal"
            variant="sunken"
            size={40}
            accessibilityLabel={t('tx.moreActions')}
            onPress={() => {
              hapticLight();
              dismissTextInputs();
              onMorePress();
            }}
          />
        ) : (
          <View style={styles.topRightSpacer} />
        )}
      </View>

      {/* Scrollable Middle Controls */}
      <KeyboardAwareScrollView
        style={styles.flex1}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        bottomOffset={88}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.geometry.screenMargin,
          paddingTop: 2,
          paddingBottom: theme.spacing.lg,
          gap: 10,
        }}
      >
        {/* Hero Amount + Optional Note CTA */}
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <PressableScale pressScale={0.98}
            testID="tx-hero-amount"
            accessibilityRole="button"
            accessibilityLabel={`${t('tx.editHeroLabel')}: ${symbol} ${heroFormatted}`}
            onPress={dismissTextInputs}
            style={styles.heroAmountTap}
          >
            <View style={styles.heroAmountRow}>
              <AppText
                tabularNums
                style={{
                  fontSize: amountFontSize,
                  lineHeight: amountLineHeight,
                  letterSpacing: -1.1,
                  fontFamily: 'Manrope_600SemiBold',
                  color: heroColor,
                }}
              >
                {heroFormatted}
              </AppText>
              <AppText
                color="textSecondary"
                style={{
                  fontSize: symbolFontSize,
                  lineHeight: Math.round(symbolFontSize * 1.15),
                  marginTop: Math.max(3, Math.round(amountFontSize * 0.1)),
                  fontFamily: TAKA_FONT_FAMILY,
                  opacity: symbol === '৳' ? 0.85 : 1,
                  marginLeft: 3,
                }}
              >
                {symbol}
              </AppText>
            </View>
          </PressableScale>

          {noteOpen ? (
            <View style={styles.noteInputWrap}>
              <Field
                inputRef={noteRef}
                testID="note-input"
                placeholder={t('tx.notePlaceholder')}
                leftIcon="pencil"
                value={note}
                onChangeText={setNote}
                maxLength={MAX_NOTE_LENGTH}
                onClear={
                  note.length > 0
                    ? () => setNote('')
                    : () => {
                        setNoteOpen(false);
                        setActiveField(null);
                      }
                }
                onFocus={() => setActiveField('note')}
                onBlur={() => setActiveField((prev) => (prev === 'note' ? null : prev))}
                returnKeyType="done"
                onSubmitEditing={dismissTextInputs}
              />
            </View>
          ) : (
            <PressableScale pressScale={0.98}
              testID="tx-add-note-toggle"
              accessibilityRole="button"
              onPress={() => {
                hapticSelection();
                setNoteOpen(true);
              }}
              hitSlop={8}
              style={styles.addNoteBtn}
            >
              <AppText variant="label" color="accent">
                {t('tx.addNoteCta')}
              </AppText>
            </PressableScale>
          )}
        </View>

        {/* Inline Error Banner (only on submit failure) */}
        {errorMsg ? (
          <View
            testID="tx-form-error"
            style={[
              styles.errorBox,
              {
                backgroundColor: theme.colors.dangerSoft,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          >
            <AppText variant="label" color="danger">
              {errorMsg}
            </AppText>
          </View>
        ) : null}

        {isTransferMode && activeAccounts.length < 2 ? (
          <Surface>
            <EmptyState
              icon="arrow-left-right"
              title={t('transfer.needTwoWalletsTitle')}
              body={t('transfer.needTwoWalletsBody')}
              ctaLabel={onPressSetupWallets ? t('tx.setupWalletCta') : undefined}
              onCtaPress={onPressSetupWallets}
            />
          </Surface>
        ) : isTransferMode ? (
          <Surface padded={false}>
            <PressableScale pressScale={0.98}
              testID="transfer-from-row"
              accessibilityRole="button"
              accessibilityLabel={`${t('transfer.fromLabel')}: ${fromAccount?.name ?? ''}`}
              onPress={() => {
                hapticSelection();
                dismissTextInputs();
                setWalletPickerTarget('from');
              }}
              style={({ pressed }) => [styles.flatRow, { opacity: pressed ? 0.72 : 1 }]}
            >
              <WalletAvatar account={fromAccount} size="xs" />
              <AppText variant="label" color="textSecondary" style={styles.rowLabel}>
                {t('transfer.fromLabel')}
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.rowValue}>
                {fromAccount?.name ?? t('tx.noWallet')}
              </AppText>
              <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
            </PressableScale>

            <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />

            <PressableScale pressScale={0.98}
              testID="transfer-to-row"
              accessibilityRole="button"
              accessibilityLabel={`${t('transfer.toLabel')}: ${toAccount?.name ?? ''}`}
              onPress={() => {
                hapticSelection();
                dismissTextInputs();
                setWalletPickerTarget('to');
              }}
              style={({ pressed }) => [styles.flatRow, { opacity: pressed ? 0.72 : 1 }]}
            >
              <WalletAvatar account={toAccount} size="xs" />
              <AppText variant="label" color="textSecondary" style={styles.rowLabel}>
                {t('transfer.toLabel')}
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.rowValue}>
                {toAccount?.name ?? t('tx.noWallet')}
              </AppText>
              <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
            </PressableScale>

            <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />

            <View testID="transfer-fee-row" style={styles.flatRow}>
              <AppIcon name="receipt" size={18} color={theme.colors.textSecondary} />
              <View style={styles.feeLabelWrap}>
                <AppText
                  variant="label"
                  color="textSecondary"
                  numberOfLines={1}
                  style={{
                    minWidth: estimateSingleLineMinWidth(
                      t('transfer.feeLabel'),
                      theme.typography.label.fontSize
                    ),
                  }}
                >
                  {t('transfer.feeLabel')}
                </AppText>
                {showCashOutFeeHint ? (
                  <View
                    style={[
                      styles.feeHintBadge,
                      {
                        backgroundColor: theme.colors.accentSoft,
                        borderRadius: theme.radius.pill,
                      },
                    ]}
                  >
                    <AppText variant="caption" color="accent">
                      {t('transfer.feeHintMfs')}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.feeInputWrap,
                  {
                    backgroundColor: theme.colors.surfaceSunken,
                    borderRadius: theme.radius.input,
                    borderWidth: 1,
                    borderColor: !feeMinorValid
                      ? theme.colors.danger
                      : activeField === 'fee'
                        ? theme.colors.accent
                        : theme.colors.separator,
                  },
                ]}
              >
                <AppText variant="label" color="textSecondary">
                  {symbol}
                </AppText>
                <TextInput
                  ref={feeRef}
                  testID="transfer-fee-input"
                  value={shownFeeText}
                  onChangeText={(next) => {
                    setFeeText(next);
                    setFeeEdited(next.trim().length > 0);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t('transfer.feePlaceholder')}
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onFocus={() => setActiveField('fee')}
                  onBlur={() => setActiveField((prev) => (prev === 'fee' ? null : prev))}
                  onSubmitEditing={dismissTextInputs}
                  style={[
                    styles.feeInput,
                    {
                      color: feeMinorValid ? theme.colors.text : theme.colors.danger,
                      fontFamily:
                        locale === 'bn' || containsBengali(shownFeeText)
                          ? mapFontToBangla(
                              theme.typography.bodyStrong.fontFamily,
                              undefined,
                              theme.banglaFont
                            )
                          : theme.typography.bodyStrong.fontFamily,
                      fontSize: theme.typography.bodyStrong.fontSize,
                    },
                  ]}
                />
              </View>
            </View>

            {feeIsAuto && autoFeeMinor > 0 && defaultFeeBp !== null ? (
              <AppText
                testID="transfer-fee-source"
                variant="caption"
                color="textSecondary"
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingBottom: theme.spacing.xs,
                }}
              >
                {t('transfer.feeFromDefault', {
                  rate: formatFeeRateBp(defaultFeeBp),
                  wallet: fromAccount?.name ?? '',
                })}
              </AppText>
            ) : null}

            <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />

            <View style={styles.flatRow}>
              <AppIcon name="calendar" size={18} color={theme.colors.textTertiary} />
              <View style={styles.whenControlsRow}>
                <DateField
                  testID="tx-date-field"
                  value={occurredOn}
                  onChange={(next) => {
                    dismissTextInputs();
                    setOccurredOn(next);
                  }}
                  maximumDate={new Date()}
                />
                <TimeField
                  testID="tx-time-field"
                  value={occurredTime}
                  onChange={(next) => {
                    dismissTextInputs();
                    setOccurredTime(next);
                  }}
                />
              </View>
            </View>
          </Surface>
        ) : (
          <>
            <Surface padded={false}>
              <PressableScale pressScale={0.98}
                testID="tx-wallet-row"
                accessibilityRole="button"
                accessibilityLabel={`${
                  txType === 'income' ? t('tx.walletIntoLabel') : t('tx.walletFromLabel')
                }: ${selectedAccount?.name ?? t('tx.noWallet')}`}
                onPress={() => {
                  hapticSelection();
                  dismissTextInputs();
                  setWalletPickerTarget('tx');
                }}
                style={({ pressed }) => [styles.flatRow, { opacity: pressed ? 0.72 : 1 }]}
              >
                <WalletAvatar account={selectedAccount} size="xs" />
                <AppText variant="label" color="textSecondary" style={styles.rowLabel}>
                  {txType === 'income' ? t('tx.walletIntoLabel') : t('tx.walletFromLabel')}
                </AppText>
                <AppText
                  variant="bodyStrong"
                  color={selectedAccount ? 'text' : 'textSecondary'}
                  numberOfLines={1}
                  style={styles.rowValue}
                >
                  {selectedAccount?.name ?? t('tx.noWallet')}
                </AppText>
                <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
              </PressableScale>

              <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />

              <View style={styles.flatRow}>
                <AppIcon name="calendar" size={18} color={theme.colors.textTertiary} />
                <View style={styles.whenControlsRow}>
                  <DateField
                    testID="tx-date-field"
                    value={occurredOn}
                    onChange={(next) => {
                      dismissTextInputs();
                      setOccurredOn(next);
                    }}
                    maximumDate={new Date()}
                  />
                  <TimeField
                    testID="tx-time-field"
                    value={occurredTime}
                    onChange={(next) => {
                      dismissTextInputs();
                      setOccurredTime(next);
                    }}
                  />
                </View>
              </View>
            </Surface>

            {/* Category 4x2 Grid */}
            <View style={styles.catGrid}>
              {gridCategories.map((cat) => {
                const selected = categoryId === cat.id;
                return (
                  <PressableScale pressScale={0.98}
                    key={cat.id}
                    testID={`cat-chip-${cat.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={cat.name}
                    accessibilityState={{ selected }}
                    onPress={() => handleSelectCategory(cat.id)}
                    style={({ pressed }) => [
                      styles.catCell,
                      { opacity: pressed ? 0.78 : 1 },
                    ]}
                  >
                    <IconTile icon={cat.icon} colorKey={cat.colorKey} selected={selected} size="md" />
                    <AppText
                      variant="caption"
                      color={selected ? 'text' : 'textSecondary'}
                      style={[
                        styles.catLabel,
                        selected ? { fontFamily: 'Manrope_600SemiBold' } : null,
                      ]}
                    >
                      {cat.name}
                    </AppText>
                  </PressableScale>
                );
              })}

              {showLendBorrowTile && onPressLendBorrow ? (
                <PressableScale pressScale={0.98}
                  testID="cat-lend-borrow-button"
                  accessibilityRole="button"
                  accessibilityLabel={t('tx.lendBorrowTile')}
                  onPress={() => {
                    hapticSelection();
                    dismissTextInputs();
                    onPressLendBorrow({
                      amountMinor: validAmountMinor,
                      accountId,
                      occurredOn,
                    });
                  }}
                  style={({ pressed }) => [styles.catCell, { opacity: pressed ? 0.78 : 1 }]}
                >
                  <IconTile icon="hand-coins" colorKey="teal" size="md" />
                  <AppText variant="caption" color="textSecondary" style={styles.catLabel}>
                    {t('tx.lendBorrowTile')}
                  </AppText>
                </PressableScale>
              ) : null}

              <PressableScale pressScale={0.98}
                testID="cat-all-button"
                accessibilityRole="button"
                accessibilityLabel={t('tx.allCategories')}
                onPress={() => {
                  hapticSelection();
                  dismissTextInputs();
                  setAllCatsOpen(true);
                }}
                style={({ pressed }) => [styles.catCell, { opacity: pressed ? 0.78 : 1 }]}
              >
                <IconTile icon="layout-grid" neutral size="md" />
                <AppText variant="caption" color="textSecondary" style={styles.catLabel}>
                  {t('tx.allCategories')}
                </AppText>
              </PressableScale>
            </View>

            {/* Description Input + Strict Contextual Suggestions */}
            <View style={{ gap: theme.spacing.sm }}>
              <Field
                inputRef={descriptionRef}
                testID="description-input"
                leftIcon="pencil"
                placeholder={t('tx.descriptionPlaceholder')}
                value={description}
                onChangeText={setDescription}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onClear={description.length > 0 ? () => setDescription('') : undefined}
                onFocus={() => setActiveField('description')}
                onBlur={() => setActiveField((prev) => (prev === 'description' ? null : prev))}
                returnKeyType="done"
                onSubmitEditing={dismissTextInputs}
              />

              {suggestions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ marginHorizontal: -theme.geometry.screenMargin }}
                  contentContainerStyle={[
                    styles.suggestionRow,
                    { paddingHorizontal: theme.geometry.screenMargin, gap: theme.spacing.xs },
                  ]}
                >
                  {suggestions.map((item, idx) => (
                    <Chip
                      key={`${txType}-${categoryId ?? 'none'}-${item}`}
                      testID={`suggestion-chip-${idx}`}
                      variant="sunken"
                      label={item}
                      selected={description.trim().toLowerCase() === item.toLowerCase()}
                      onPress={() => {
                        hapticSelection();
                        setDescription(item);
                        dismissTextInputs();
                      }}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      {/* Pinned Bottom Dock: Keypad (hidden while typing in text inputs) + Primary CTA */}
      <View
        style={[
          styles.bottomDock,
          {
            backgroundColor: theme.colors.bg,
            borderTopColor: theme.colors.separator,
            paddingHorizontal: theme.geometry.screenMargin,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        {!hideKeypad ? (
          <Keypad
            testID="tx-keypad"
            keyHeight={48}
            value={amountText}
            onChange={(next) => {
              setAmountText(next);
              if (errorMsg) setErrorMsg(null);
            }}
          />
        ) : null}

        {isEditing && onDeletePress ? (
          <View style={[styles.dockActionsRow, { gap: theme.spacing.sm }]}>
            <Button
              testID="tx-delete-button"
              title={t('common.delete')}
              leftIcon="trash-2"
              variant="dangerSoft"
              size="md"
              onPress={() => {
                dismissTextInputs();
                onDeletePress();
              }}
              style={styles.dockDeleteButton}
            />
            <Button
              testID="save-tx-button"
              title={saving ? t('common.saving') : primaryLabel}
              variant="primary"
              size="md"
              disabled={!canSave}
              loading={saving}
              onPress={() => {
                void handleSubmit();
              }}
              style={styles.dockSaveButton}
            />
          </View>
        ) : (
          <Button
            testID="save-tx-button"
            title={saving ? t('common.saving') : primaryLabel}
            variant="primary"
            size="md"
            disabled={!canSave}
            loading={saving}
            onPress={() => {
              void handleSubmit();
            }}
          />
        )}
      </View>

      <AllCategoriesSheet
        visible={allCatsOpen}
        onClose={() => setAllCatsOpen(false)}
        type={txType}
        categories={orderedCategories}
        selectedCategoryId={categoryId}
        onSelectCategory={(id) => {
          setCategoryId(id);
          setErrorMsg(null);
        }}
        onCreateCategory={onCreateCategory}
      />

      <WalletPickerSheet
        visible={walletPickerTarget !== null}
        onClose={() => setWalletPickerTarget(null)}
        title={
          walletPickerTarget === 'from'
            ? t('transfer.fromLabel')
            : walletPickerTarget === 'to'
              ? t('transfer.toLabel')
              : t('tx.chooseWalletTitle')
        }
        accounts={activeAccounts}
        selectedAccountId={
          walletPickerTarget === 'from'
            ? fromAccountId
            : walletPickerTarget === 'to'
              ? toAccountId
              : accountId
        }
        allowNone={walletPickerTarget === 'tx'}
        balancesById={balancesById}
        currency={currency}
        onSelect={handleSelectWallet}
        onPressSetupWallets={onPressSetupWallets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topTitle: {
    width: '100%',
    textAlign: 'center',
  },
  topRightSpacer: {
    width: 40,
    height: 40,
  },
  heroAmountTap: {
    paddingVertical: 2,
    paddingHorizontal: 16,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  addNoteBtn: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  noteInputWrap: {
    width: '100%',
  },
  errorBox: {
    alignSelf: 'stretch',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    gap: 10,
  },
  rowLabel: {
    minWidth: 44,
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  whenControlsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  feeLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  feeHintBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  feeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 2,
    justifyContent: 'flex-end',
  },
  feeInput: {
    minWidth: 54,
    textAlign: 'right',
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontVariant: ['tabular-nums'],
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  catCell: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 3,
    gap: 4,
    minHeight: 58,
  },
  catLabel: {
    textAlign: 'center',
    width: '100%',
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  bottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dockActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockDeleteButton: {
    flex: 1.1,
    paddingHorizontal: 14,
  },
  dockSaveButton: {
    flex: 1.5,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
  },
  iconChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  sheetCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
});
