import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildCustomCategory } from '@/domain/categories';
import type { Category, Transaction } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { ErrorState } from '@/ui/ErrorState';
import { hapticSuccess } from '@/ui/haptics';
import { useToast } from '@/ui/Toast';
import {
  TransactionForm,
  type CreateCategoryInput,
  type TransactionFormValues,
} from '@/ui/TransactionForm';

export default function NewTransactionScreen() {
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const txIdRef = useRef<string>(Crypto.randomUUID());

  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      repo.listCategories({ includeArchived: false }),
      repo.searchTransactions({}, { limit: 150 }),
    ])
      .then(([cats, txPage]) => {
        if (!active) return;
        setCategories(cats);
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
        description: values.description,
        note: values.note,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
        source: 'manual',
      });
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('tx.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      handleClose();
    },
    [handleClose, repo, settings.currency, showToast]
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
      >
        <TransactionForm
          mode="new"
          currency={settings.currency}
          categories={categories}
          recentTransactions={recentTransactions}
          onClose={handleClose}
          onCreateCategory={handleCreateCategory}
          onSubmit={handleSubmit}
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
