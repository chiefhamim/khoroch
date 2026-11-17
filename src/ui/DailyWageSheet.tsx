import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { defaultWageChoices, dailyWageProblem } from '@/domain/dailyWage';
import { formatMinorToDraft, getCurrencySymbol, parseMoneyInput } from '@/domain/money';
import type { Account, Category, CurrencyCode, DailyWage, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field } from './Field';
import { hapticSelection, hapticSuccess } from './haptics';
import { ListRow } from './ListRow';
import { Sheet } from './Sheet';
import { Surface } from './Surface';
import { useToast } from './Toast';
import { WalletAvatar } from './WalletAvatar';
import { WalletPickerSheet } from './WalletPickerSheet';

export interface DailyWageSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface BodyProps {
  currency: CurrencyCode;
  wage: DailyWage | null;
  onClose: () => void;
  onSave: (wage: DailyWage | null) => Promise<void>;
}

function DailyWageBody({ currency, wage, onClose, onSave }: BodyProps) {
  const { theme } = useTheme();
  const { repo } = useAppContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [amountText, setAmountText] = useState(wage ? formatMinorToDraft(wage.amountMinor) : '');
  // What the person picked; until they pick, the saved wage or the history-based default shows.
  const [pickedCategory, setCategoryId] = useState<string | null>(null);
  const [pickedAccount, setAccountId] = useState<string | null | undefined>(undefined);
  const [walletOpen, setWalletOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      repo.listCategories({ includeArchived: false }),
      repo.listAccounts({ includeArchived: false }),
      repo.searchTransactions({ type: 'income' }, { limit: 150 }),
    ])
      .then(([cats, accs, page]) => {
        if (!active) return;
        setCategories(cats);
        setAccounts(accs);
        setHistory(page.rows);
        setLoaded(true);
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [repo]);

  const incomeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'income' && c.archivedAt === null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  // A new wage starts from the most used income category and wallet; a saved one keeps its own.
  const defaults = useMemo(
    () => defaultWageChoices(loaded ? history : [], categories, accounts),
    [loaded, history, categories, accounts]
  );
  // A saved category or wallet that has since been archived (or removed) is not offered here, so
  // the defaults show instead and a note says so. Nothing stale is kept silently.
  const listsReady = loaded && !loadFailed;
  const savedCategoryGone =
    listsReady && wage !== null && !incomeCategories.some((c) => c.id === wage.categoryId);
  const savedWalletGone =
    listsReady &&
    wage !== null &&
    wage.accountId !== null &&
    !accounts.some((a) => a.id === wage.accountId);
  const categoryId =
    pickedCategory ?? (wage && !savedCategoryGone ? wage.categoryId : defaults.categoryId);
  const accountId =
    pickedAccount !== undefined
      ? pickedAccount
      : wage && !savedWalletGone
        ? wage.accountId
        : defaults.accountId;
  const showFallbackNote =
    (savedCategoryGone && pickedCategory === null) ||
    (savedWalletGone && pickedAccount === undefined);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const handleSave = async () => {
    if (!listsReady) return;
    const parsed = parseMoneyInput(amountText);
    const amountMinor = parsed.ok ? parsed.minor : null;
    const problem = dailyWageProblem({ amountMinor, categoryId });
    if (problem === 'amount') {
      setError(t('dailyWage.invalidAmount'));
      return;
    }
    if (problem === 'category' || amountMinor === null || categoryId === null) {
      setError(t('dailyWage.noCategory'));
      return;
    }
    setSaving(true);
    try {
      await onSave({ amountMinor, categoryId, accountId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText variant="body" color="textSecondary">
        {t('dailyWage.intro')}
      </AppText>

      <Field
        testID="daily-wage-amount"
        label={`${t('dailyWage.amountLabel')} (${getCurrencySymbol(currency)})`}
        placeholder="0"
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={(txt) => {
          setAmountText(txt);
          setError(null);
        }}
      />

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textSecondary">
          {t('dailyWage.categoryLabel')}
        </AppText>
        <View style={[styles.chipWrap, { gap: theme.spacing.sm }]}>
          {incomeCategories.map((category) => (
            <Chip
              key={category.id}
              testID={`daily-wage-category-${category.id}`}
              label={category.name}
              selected={category.id === categoryId}
              onPress={() => {
                hapticSelection();
                setCategoryId(category.id);
                setError(null);
              }}
            />
          ))}
        </View>
      </View>

      <Surface padded={false}>
        <ListRow
          testID="daily-wage-wallet"
          compact
          title={selectedAccount?.name ?? t('tx.noWallet')}
          subtitle={t('fast.into')}
          left={
            selectedAccount ? (
              <WalletAvatar account={selectedAccount} size="sm" />
            ) : (
              <WalletAvatar account={null} size="sm" />
            )
          }
          right={<AppIcon name="chevron-down" size={16} color={theme.colors.textTertiary} />}
          onPress={() => setWalletOpen(true)}
        />
      </Surface>

      {showFallbackNote ? (
        <AppText testID="daily-wage-fallback-note" variant="caption" color="textSecondary">
          {t('dailyWage.fallbackNote')}
        </AppText>
      ) : null}

      {error || loadFailed ? (
        <AppText testID="daily-wage-error" variant="label" color="danger">
          {error ?? t('dailyWage.loadFailed')}
        </AppText>
      ) : null}

      <Button
        testID="daily-wage-save"
        title={t('common.save')}
        loading={saving}
        disabled={!listsReady}
        onPress={() => void handleSave()}
      />
      {wage ? (
        <Button
          testID="daily-wage-remove"
          title={t('dailyWage.remove')}
          variant="dangerSoft"
          onPress={() => {
            void onSave(null).then(onClose);
          }}
        />
      ) : null}

      <WalletPickerSheet
        visible={walletOpen}
        onClose={() => setWalletOpen(false)}
        title={t('tx.chooseWalletTitle')}
        accounts={accounts}
        selectedAccountId={accountId}
        allowNone
        currency={currency}
        onSelect={(chosen) => setAccountId(chosen)}
      />
    </View>
  );
}

/**
 * One sheet to set or change the daily wage: amount, income category and wallet. Used from
 * Settings and from the Received side of the add-entry screen. Saves straight to the settings
 * store (the same key-value store as the pinned amounts).
 */
export function DailyWageSheet({ visible, onClose }: DailyWageSheetProps) {
  const { settings, updateSetting } = useAppContext();
  const { showToast } = useToast();

  return (
    <Sheet
      testID="daily-wage-sheet"
      visible={visible}
      onClose={onClose}
      title={t('dailyWage.sheetTitle')}
    >
      {visible ? (
        <DailyWageBody
          currency={settings.currency}
          wage={settings.dailyWage}
          onClose={onClose}
          onSave={async (next) => {
            await updateSetting('dailyWage', next);
            if (next) {
              hapticSuccess();
              showToast({ message: t('dailyWage.setToast'), icon: 'circle-check', tone: 'accent' });
            }
          }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
