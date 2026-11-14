import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Account, Category, Transfer } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { TransactionForm, type TransferFormValues } from '@/ui/TransactionForm';
import { hapticSuccess } from '@/ui/haptics';

export default function EditTransferScreen() {
  useLocale();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const transferId = Array.isArray(id) ? id[0] : id;
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      transferId ? repo.getTransfer(transferId) : Promise.resolve(null),
      repo.listAccounts({ includeArchived: true }),
      repo.listCategories({ includeArchived: true }),
    ])
      .then(([tr, accs, cats]) => {
        if (!active) return;
        setTransfer(tr);
        setAccounts(accs);
        setCategories(cats);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, transferId]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/ledger');
    }
  }, []);

  const handleUpdateTransfer = useCallback(
    async (values: TransferFormValues) => {
      if (!transfer) return;
      await repo.updateTransfer(transfer.id, {
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        amountMinor: values.amountMinor,
        feeMinor: values.feeMinor,
        occurredOn: values.occurredOn,
        occurredTime: values.occurredTime,
        note: values.note,
      });
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('transfer.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      handleClose();
    },
    [handleClose, repo, showToast, transfer]
  );

  const handleDelete = useCallback(async () => {
    if (!transfer || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await repo.softDeleteTransfer(transfer.id);
      hapticSuccess();
      bumpDataVersion();
      setDeleteConfirmOpen(false);
      showToast({
        message: t('transfer.deletedToast'),
        icon: 'trash-2',
        tone: 'danger',
      });
      handleClose();
    } catch {
      setDeleteError(t('tx.errorDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [deleting, handleClose, repo, showToast, transfer]);

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

  if (!transfer) {
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
            icon="x"
            accessibilityLabel={t('common.close')}
            onPress={handleClose}
          />
          <AppText variant="headline">{t('transfer.editTitle')}</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerWrap}>
          <ErrorState
            title={t('transfer.notFound')}
            body={t('error.genericBody')}
            retryLabel={t('common.back')}
            onRetry={handleClose}
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
          mode="edit"
          initialMode="transfer"
          currency={settings.currency}
          categories={categories}
          accounts={accounts}
          initialTransferValues={{
            fromAccountId: transfer.fromAccountId,
            toAccountId: transfer.toAccountId,
            amountMinor: transfer.amountMinor,
            feeMinor: transfer.feeMinor,
            occurredOn: transfer.occurredOn,
            occurredTime: transfer.occurredTime,
            note: transfer.note,
          }}
          submitLabel={t('transfer.updateCta')}
          onClose={handleClose}
          onDeletePress={() => {
            setDeleteError(null);
            setDeleteConfirmOpen(true);
          }}
          onSubmit={async () => {}}
          onSubmitTransfer={handleUpdateTransfer}
        />
      </KeyboardAvoidingView>

      <Sheet
        visible={deleteConfirmOpen}
        onClose={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
        title={t('transfer.deleteConfirmTitle')}
        testID="transfer-delete-confirm-sheet"
      >
        <AppText variant="body" color="textSecondary">
          {t('transfer.deleteConfirmBody')}
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
            testID="transfer-confirm-delete-button"
            title={t('common.delete')}
            variant="danger"
            loading={deleting}
            onPress={() => void handleDelete()}
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
    width: 48,
    height: 48,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
