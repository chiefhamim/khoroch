import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildCustomCategory } from '@/domain/categories';
import type { Account, Category, LocalDate, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { DailyWageSheet } from '@/ui/DailyWageSheet';
import { DueEntrySheet } from '@/ui/DueEntrySheet';
import { ErrorState } from '@/ui/ErrorState';
import { hapticSuccess } from '@/ui/haptics';
import { useToast } from '@/ui/Toast';
import {
  TransactionForm,
  type CreateCategoryInput,
  type TransactionFormValues,
  type TransferFormValues,
} from '@/ui/TransactionForm';

export default function NewTransactionScreen() {
  const { repo, settings, updateSetting } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const txIdRef = useRef<string>(Crypto.randomUUID());

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [wageSheetOpen, setWageSheetOpen] = useState(false);
  const [duePrefill, setDuePrefill] = useState<{
    amountMinor: number | null;
    accountId: string | null;
    occurredOn: LocalDate;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      repo.listCategories({ includeArchived: false }),
      repo.listAccounts({ includeArchived: false }),
      repo.searchTransactions({}, { limit: 150 }),
    ])
      .then(([cats, accs, txPage]) => {
        if (!active) return;
        setCategories(cats);
        setAccounts(accs);
        setRecentTransactions(txPage.rows);
        setLoadError(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(t('common.retry'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, retryTick]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setRetryTick((prev) => prev + 1);
  }, []);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  const handleCreateCategory = useCallback(
    async (input: CreateCategoryInput): Promise<Category> => {
      const created = buildCustomCategory(
        { id: `custom_${Crypto.randomUUID().slice(0, 8)}`, ...input },
        categories
      );
      await repo.upsertCategory(created);
      bumpDataVersion();
      setCategories((prev) => [...prev, created]);
      return created;
    },
    [categories, repo]
  );

  const handleSubmit = useCallback(
    async (values: TransactionFormValues) => {
      await repo.insertTransaction({
        id: txIdRef.current,
        type: values.type,
        amountMinor: values.amountMinor,
        currency: settings.currency,
        categoryId: values.categoryId,
        accountId: values.accountId,
        description: values.description,
        note: values.note,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
        source: 'manual',
      });
      if (values.accountId !== settings.lastUsedAccountId) {
        await updateSetting('lastUsedAccountId', values.accountId);
      }
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('tx.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      handleClose();
    },
    [handleClose, repo, settings.currency, settings.lastUsedAccountId, showToast, updateSetting]
  );

  const handleSubmitAndAddAnother = useCallback(
    async (values: TransactionFormValues) => {
      await repo.insertTransaction({
        id: txIdRef.current,
        type: values.type,
        amountMinor: values.amountMinor,
        currency: settings.currency,
        categoryId: values.categoryId,
        accountId: values.accountId,
        description: values.description,
        note: values.note,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
        source: 'manual',
      });
      txIdRef.current = Crypto.randomUUID();
      if (values.accountId !== settings.lastUsedAccountId) {
        await updateSetting('lastUsedAccountId', values.accountId);
      }
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('tx.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
    },
    [repo, settings.currency, settings.lastUsedAccountId, showToast, updateSetting]
  );

  const handleSubmitTransfer = useCallback(
    async (values: TransferFormValues) => {
      await repo.createTransfer({
        id: txIdRef.current,
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        amountMinor: values.amountMinor,
        feeMinor: values.feeMinor,
        currency: settings.currency,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
        note: values.note,
      });
      if (values.fromAccountId !== settings.lastUsedAccountId) {
        await updateSetting('lastUsedAccountId', values.fromAccountId);
      }
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('transfer.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      handleClose();
    },
    [handleClose, repo, settings.currency, settings.lastUsedAccountId, showToast, updateSetting]
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.centerWrap, { backgroundColor: theme.colors.bg }]}
      >
        <ActivityIndicator color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[
          styles.centerWrap,
          {
            backgroundColor: theme.colors.bg,
            paddingHorizontal: theme.geometry.screenMargin,
          },
        ]}
      >
        <View style={styles.errorCardWrap}>
          <ErrorState
            title={t('tx.newTitle')}
            body={loadError}
            retryLabel={t('common.retry')}
            onRetry={handleRetry}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.flex1, { backgroundColor: theme.colors.bg }]}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex1}
      >
        <TransactionForm
          mode="new"
          fastEntry
          currency={settings.currency}
          categories={categories}
          accounts={accounts}
          defaultAccountId={settings.lastUsedAccountId}
          onPressSetupWallets={() => router.push('/wallets?setup=1' as never)}
          onPressLendBorrow={(prefill) => setDuePrefill(prefill)}
          recentTransactions={recentTransactions}
          pinnedAmounts={settings.pinnedAmounts}
          onPinnedAmountsChange={(next) => void updateSetting('pinnedAmounts', next)}
          onSetDailyWage={settings.dailyWage ? undefined : () => setWageSheetOpen(true)}
          onClose={handleClose}
          onCreateCategory={handleCreateCategory}
          onSubmit={handleSubmit}
          onSubmitAndAddAnother={handleSubmitAndAddAnother}
          onSubmitTransfer={handleSubmitTransfer}
        />
        <DailyWageSheet visible={wageSheetOpen} onClose={() => setWageSheetOpen(false)} />
        <DueEntrySheet
          visible={duePrefill !== null}
          onClose={() => setDuePrefill(null)}
          initialKind="lent"
          initialAmountMinor={duePrefill?.amountMinor ?? null}
          initialAccountId={duePrefill?.accountId ?? null}
          initialOccurredOn={duePrefill?.occurredOn}
          onSaved={() => {
            setDuePrefill(null);
            handleClose();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCardWrap: {
    width: '100%',
  },
});
