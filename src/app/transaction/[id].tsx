import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { hapticSuccess } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import {
  TransactionForm,
  type CreateCategoryInput,
  type TransactionFormValues,
} from '@/ui/TransactionForm';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const txId = Array.isArray(id) ? id[0] : id;
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      txId ? repo.getTransaction(txId) : Promise.resolve(null),
      repo.listCategories({ includeArchived: true }),
      repo.searchTransactions({}, { limit: 150 }),
    ])
      .then(([loadedTx, allCats, txPage]) => {
        if (!active) return;
        setTx(loadedTx);
        setCategories(allCats);
        setRecentTransactions(txPage.rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, txId]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/ledger');
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

  const handleUpdate = useCallback(
    async (values: TransactionFormValues) => {
      if (!tx) return;
      await repo.updateTransaction(tx.id, {
        type: values.type,
        amountMinor: values.amountMinor,
        categoryId: values.categoryId,
        description: values.description,
        note: values.note,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
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
    [handleClose, repo, showToast, tx]
  );

  const handleDelete = useCallback(async () => {
    if (!tx || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await repo.softDeleteTransaction(tx.id);
      hapticSuccess();
      bumpDataVersion();
      setDeleteConfirmOpen(false);
      showToast({
        message: t('tx.deletedToast'),
        icon: 'trash-2',
        tone: 'danger',
      });
      handleClose();
    } catch {
      setDeleteError(t('tx.errorDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [deleting, handleClose, repo, showToast, tx]);

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

  if (!tx) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[
          styles.flex1,
          {
            backgroundColor: theme.colors.bg,
            paddingHorizontal: theme.geometry.screenMargin,
            paddingTop: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.missingHeader}>
          <IconButton
            testID="tx-detail-close"
            icon="x"
            accessibilityLabel={t('common.close')}
            onPress={handleClose}
          />
          <AppText variant="headline">{t('tx.detailTitle')}</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerWrap}>
          <View style={styles.fullWidth}>
            <ErrorState
              title={t('tx.notFound')}
              body={t('tx.deleteConfirmBody')}
              retryLabel={t('common.back')}
              onRetry={handleClose}
            />
          </View>
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
          mode="edit"
          currency={settings.currency}
          categories={categories}
          recentTransactions={recentTransactions}
          initialValues={{
            type: tx.type,
            amountMinor: tx.amountMinor,
            categoryId: tx.categoryId,
            description: tx.description,
            note: tx.note,
            occurredOn: tx.occurredOn,
            occurredTime: tx.occurredTime,
          }}
          submitLabel={t('common.save')}
          onClose={handleClose}
          onMorePress={() => setMoreSheetOpen(true)}
          onCreateCategory={handleCreateCategory}
          onSubmit={handleUpdate}
        />
      </KeyboardAvoidingView>

      <Sheet
        visible={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        title={t('tx.moreActions')}
        testID="tx-more-sheet"
      >
        <Button
          testID="tx-action-delete"
          title={t('tx.deleteButton')}
          leftIcon="trash-2"
          variant="dangerSoft"
          onPress={() => {
            setMoreSheetOpen(false);
            setDeleteError(null);
            setDeleteConfirmOpen(true);
          }}
        />
        <Button
          title={t('common.cancel')}
          variant="secondary"
          onPress={() => setMoreSheetOpen(false)}
        />
      </Sheet>

      <Sheet
        visible={deleteConfirmOpen}
        onClose={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
        title={t('tx.deleteConfirmTitle')}
        testID="tx-delete-confirm-sheet"
      >
        <AppText variant="body" color="textSecondary">
          {t('tx.deleteConfirmBody')}
        </AppText>
        {deleteError ? (
          <AppText variant="label" color="danger">
            {deleteError}
          </AppText>
        ) : null}
        <View style={styles.confirmRow}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            disabled={deleting}
            onPress={() => setDeleteConfirmOpen(false)}
            style={styles.flex1}
          />
          <Button
            testID="tx-confirm-delete-button"
            title={t('common.delete')}
            variant="danger"
            loading={deleting}
            onPress={() => {
              void handleDelete();
            }}
            style={styles.flex1}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
