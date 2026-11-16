import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  extractPdfText,
  isNativeCaptureSupported,
  isNotificationListenerEnabled,
  openNotificationListenerSettings,
  recognizeImageText,
} from '@/capture/nativeCapture';
import { parseCaptureDocument } from '@/capture/parser';
import { syncDeviceCaptures } from '@/capture/syncCapture';
import {
  formatFriendlyTime,
  formatShortDate,
  isDevice24HourClock,
  todayLocalDate,
} from '@/domain/dates';
import type { Account, CaptureSource, Category, PendingDraft } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, type AppIconName } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { Money } from '@/ui/Money';
import { PressableScale } from '@/ui/PressableScale';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';
import { WalletAvatar } from '@/ui/WalletAvatar';
import { hapticLight, hapticSelection, hapticSuccess } from '@/ui/haptics';

function sourceLabelKey(source: CaptureSource) {
  switch (source) {
    case 'notification':
      return t('inbox.sourceNotification');
    case 'statement_pdf':
      return t('inbox.sourcePdf');
    case 'statement_csv':
      return t('inbox.sourceCsv');
    case 'ocr_receipt':
      return t('inbox.sourceOcr');
    case 'share_text':
    default:
      return t('inbox.sourceShare');
  }
}

async function readTextUri(uri: string): Promise<string> {
  try {
    return await new File(uri).text();
  } catch {
    return LegacyFileSystem.readAsStringAsync(uri);
  }
}

export default function SmartInboxScreen() {
  useLocale();
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listenerEnabled, setListenerEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [editingDraft, setEditingDraft] = useState<PendingDraft | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const [expandedRawId, setExpandedRawId] = useState<string | null>(null);
  const use24Hour = isDevice24HourClock();

  const loadInbox = useCallback(async () => {
    const [pending, accs, cats, listenerOn] = await Promise.all([
      repo.listPendingDrafts({ status: 'pending' }),
      repo.listAccounts(),
      repo.listCategories({ includeArchived: false }),
      isNotificationListenerEnabled(),
    ]);
    setDrafts(pending);
    setAccounts(accs);
    setCategories(cats);
    setListenerEnabled(listenerOn);
  }, [repo]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [pending, accs, cats, listenerOn] = await Promise.all([
        repo.listPendingDrafts({ status: 'pending' }),
        repo.listAccounts(),
        repo.listCategories({ includeArchived: false }),
        isNotificationListenerEnabled(),
      ]);
      if (!active) return;
      setDrafts(pending);
      setAccounts(accs);
      setCategories(cats);
      setListenerEnabled(listenerOn);
    })();
    return () => {
      active = false;
    };
  }, [repo, dataVersion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          await syncDeviceCaptures(repo);
          await loadInbox();
        })();
      }
    });
    return () => sub.remove();
  }, [repo, loadInbox]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as never);
    }
  };

  const ingestRawText = async (raw: string, source: CaptureSource) => {
    const parsed = parseCaptureDocument(raw, source, {
      accounts,
      defaultDate: todayLocalDate(),
    });
    if (parsed.length === 0) {
      showToast({ message: t('inbox.noNewToast'), icon: 'info' });
      return;
    }
    const inserted = await repo.upsertPendingDrafts(parsed);
    if (inserted > 0) {
      bumpDataVersion();
      hapticSuccess();
      showToast({
        message:
          inserted === 1
            ? t('inbox.addedSingleToast')
            : t('inbox.addedToast', { count: inserted }),
        icon: 'circle-check',
        tone: 'accent',
      });
    } else {
      showToast({ message: t('inbox.noNewToast'), icon: 'info' });
    }
    await loadInbox();
  };

  const handleSyncNotifications = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await syncDeviceCaptures(repo);
      await loadInbox();
      if (res.addedCount > 0) {
        hapticSuccess();
        showToast({
          message: t('inbox.addedToast', { count: res.addedCount }),
          icon: 'circle-check',
          tone: 'accent',
        });
      } else {
        showToast({ message: t('inbox.noNewToast'), icon: 'info' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImportStatement = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const isPdf =
        asset.mimeType?.includes('pdf') || asset.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const pdfText = await extractPdfText(asset.uri);
        await ingestRawText(pdfText, 'statement_pdf');
      } else {
        const isCsv =
          asset.mimeType?.includes('csv') || asset.name?.toLowerCase().endsWith('.csv');
        const textContent = await readTextUri(asset.uri);
        await ingestRawText(textContent, isCsv ? 'statement_csv' : 'share_text');
      }
    } catch {
      showToast({ message: t('error.genericBody'), icon: 'triangle-alert', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleScanReceipt = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const text = await recognizeImageText(picked.assets[0].uri);
      await ingestRawText(text, 'ocr_receipt');
    } catch {
      showToast({ message: t('error.genericBody'), icon: 'triangle-alert', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleApproveDraft = async (draft: PendingDraft) => {
    const fallbackCat =
      categories.find((c) => c.kind === draft.type)?.id ??
      (draft.type === 'income' ? 'other_income' : 'other');
    const resolvedCategoryId = draft.categoryId ?? fallbackCat;
    const resolvedAccountId = draft.accountId ?? accounts[0]?.id ?? null;

    await repo.insertTransaction({
      id: `tx_cap_${Crypto.randomUUID()}`,
      type: draft.type,
      amountMinor: draft.amountMinor,
      currency: settings.currency,
      categoryId: resolvedCategoryId,
      accountId: resolvedAccountId,
      description: draft.description || sourceLabelKey(draft.source),
      note: draft.trxId ? `TrxID: ${draft.trxId}` : '',
      occurredOn: draft.occurredOn,
      occurredTime: draft.occurredTime,
      source: 'capture',
    });

    if (draft.feeMinor > 0 && draft.type === 'expense') {
      await repo.insertTransaction({
        id: `tx_cap_fee_${Crypto.randomUUID()}`,
        type: 'expense',
        amountMinor: draft.feeMinor,
        currency: settings.currency,
        categoryId: 'fees',
        accountId: resolvedAccountId,
        description: `${draft.description || 'MFS'} fee`,
        note: draft.trxId ? `TrxID: ${draft.trxId}` : '',
        occurredOn: draft.occurredOn,
        occurredTime: draft.occurredTime,
        source: 'capture',
      });
    }

    await repo.updatePendingDraftStatus(draft.id, 'approved');
    bumpDataVersion();
    hapticSuccess();
    showToast({ message: t('inbox.approvedToast'), icon: 'circle-check', tone: 'accent' });
    await loadInbox();
  };

  const handleDismissDraft = async (id: string) => {
    hapticLight();
    await repo.updatePendingDraftStatus(id, 'dismissed');
    bumpDataVersion();
    await loadInbox();
  };

  const handleApproveAll = async () => {
    if (busy || drafts.length === 0) return;
    setBusy(true);
    try {
      for (const d of drafts) {
        const resolvedAccountId = d.accountId ?? accounts[0]?.id ?? null;
        await repo.insertTransaction({
          id: `tx_cap_${Crypto.randomUUID()}`,
          type: d.type,
          amountMinor: d.amountMinor,
          currency: settings.currency,
          categoryId: d.categoryId ?? 'other',
          accountId: resolvedAccountId,
          description: d.description,
          note: d.trxId ? `TrxID: ${d.trxId}` : '',
          occurredOn: d.occurredOn,
          occurredTime: d.occurredTime,
          source: 'capture',
        });
        if (d.feeMinor > 0 && d.type === 'expense') {
          await repo.insertTransaction({
            id: `tx_cap_fee_${Crypto.randomUUID()}`,
            type: 'expense',
            amountMinor: d.feeMinor,
            currency: settings.currency,
            categoryId: 'fees',
            accountId: resolvedAccountId,
            description: `${d.description || 'MFS'} fee`,
            note: d.trxId ? `TrxID: ${d.trxId}` : '',
            occurredOn: d.occurredOn,
            occurredTime: d.occurredTime,
            source: 'capture',
          });
        }
        await repo.updatePendingDraftStatus(d.id, 'approved');
      }
      bumpDataVersion();
      hapticSuccess();
      showToast({ message: t('inbox.approvedToast'), icon: 'circle-check', tone: 'accent' });
      await loadInbox();
    } finally {
      setBusy(false);
    }
  };

  const handleDismissAll = async () => {
    if (busy || drafts.length === 0) return;
    setBusy(true);
    try {
      hapticLight();
      await repo.clearPendingDrafts('pending');
      bumpDataVersion();
      await loadInbox();
    } finally {
      setBusy(false);
    }
  };

  const updateEditingCategory = async (categoryId: string) => {
    if (!editingDraft) return;
    hapticSelection();
    const updated = { ...editingDraft, categoryId };
    setEditingDraft(updated);
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const updateEditingAccount = async (accountId: string) => {
    if (!editingDraft) return;
    hapticSelection();
    const updated = { ...editingDraft, accountId };
    setEditingDraft(updated);
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const nativeCapable = isNativeCaptureSupported();

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} bottomSpacer>
      <View style={styles.headerRow}>
        <IconButton
          testID="inbox-back-btn"
          icon="arrow-left"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="title">{t('inbox.title')}</AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {t('inbox.subtitle')}
          </AppText>
        </View>
      </View>

      {/* Auto-Capture & Offline Ingestion Bar */}
      <Surface style={{ gap: theme.spacing.md }}>
        <View style={styles.listenerRow}>
          <IconTile
            icon="bell"
            colorKey={listenerEnabled ? 'green' : 'blue'}
            size="md"
          />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t('inbox.autoCaptureTitle')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {listenerEnabled ? t('inbox.autoCaptureOn') : t('inbox.autoCaptureOff')}
            </AppText>
          </View>
          {nativeCapable ? (
            <Button
              testID="inbox-listener-btn"
              title={listenerEnabled ? t('inbox.syncNowCta') : t('inbox.enableAccessCta')}
              size="sm"
              variant={listenerEnabled ? 'secondary' : 'primary'}
              onPress={() => {
                if (listenerEnabled) {
                  void handleSyncNotifications();
                } else {
                  void openNotificationListenerSettings();
                }
              }}
            />
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <PressableScale
            testID="inbox-import-statement"
            accessibilityRole="button"
            onPress={() => void handleImportStatement()}
            style={[
              styles.toolPill,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <AppIcon name="file-text" size={16} color={theme.colors.accent} />
            <AppText variant="caption" color="text" numberOfLines={1} style={{ fontWeight: '600' }}>
              {t('inbox.importStatementCta')}
            </AppText>
          </PressableScale>

          <PressableScale
            testID="inbox-scan-receipt"
            accessibilityRole="button"
            onPress={() => void handleScanReceipt()}
            style={[
              styles.toolPill,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <AppIcon name="scan-line" size={16} color={theme.colors.accent} />
            <AppText variant="caption" color="text" numberOfLines={1} style={{ fontWeight: '600' }}>
              {t('inbox.scanReceiptCta')}
            </AppText>
          </PressableScale>

          <PressableScale
            testID="inbox-paste-text"
            accessibilityRole="button"
            onPress={() => {
              hapticLight();
              setPasteText('');
              setPasteOpen(true);
            }}
            style={[
              styles.toolPill,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <AppIcon name="copy" size={16} color={theme.colors.accent} />
            <AppText variant="caption" color="text" numberOfLines={1} style={{ fontWeight: '600' }}>
              {t('inbox.pasteTextCta')}
            </AppText>
          </PressableScale>
        </View>
      </Surface>

      {/* Pending Drafts Queue */}
      {drafts.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={styles.queueHeader}>
            <AppText variant="headline">{t('inbox.title')}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Button
                testID="inbox-dismiss-all"
                title={t('inbox.dismissAllCta')}
                size="sm"
                variant="ghost"
                disabled={busy}
                onPress={() => void handleDismissAll()}
              />
              <Button
                testID="inbox-approve-all"
                title={t('inbox.approveAllCta', { count: drafts.length })}
                size="sm"
                loading={busy}
                onPress={() => void handleApproveAll()}
              />
            </View>
          </View>

          {drafts.slice(0, visibleCount).map((draft) => {
            const cat = draft.categoryId ? categoriesById.get(draft.categoryId) : undefined;
            const acc = draft.accountId ? accountsById.get(draft.accountId) : accounts[0];
            const isIncome = draft.type === 'income';
            const dateLabel =
              draft.occurredOn === todayLocalDate()
                ? t('common.today')
                : formatShortDate(draft.occurredOn);
            const timeLabel = draft.occurredTime
              ? formatFriendlyTime(draft.occurredTime, use24Hour)
              : null;
            const subParts = [timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel];
            if (cat?.name) subParts.push(cat.name);
            const isRawExpanded = expandedRawId === draft.id;
            const refLabel = draft.trxId
              ? /^(?:Ref|Card|A\/C)\b/i.test(draft.trxId)
                ? draft.trxId
                : `TrxID: ${draft.trxId}`
              : null;

            return (
              <Surface key={draft.id} testID={`inbox-draft-${draft.id}`} style={{ gap: theme.spacing.sm }}>
                <View style={styles.draftTop}>
                  <IconTile
                    icon={(cat?.icon ?? 'receipt-text') as AppIconName}
                    colorKey={cat?.colorKey ?? 'gray'}
                    size="md"
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {draft.description || cat?.name || sourceLabelKey(draft.source)}
                    </AppText>
                    <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                      {subParts.join(' · ')}
                    </AppText>
                  </View>
                  <Money
                    variant="headline"
                    amountMinor={draft.amountMinor}
                    currency={settings.currency}
                    prefix={isIncome ? '+' : '−'}
                    color={isIncome ? 'income' : 'expense'}
                  />
                </View>

                <View style={styles.badgeStrip}>
                  {acc ? (
                    <View
                      style={[
                        styles.infoChip,
                        { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill },
                      ]}
                    >
                      <WalletAvatar account={acc} size="xs" />
                      <AppText variant="caption" color="text" style={{ fontWeight: '600' }} numberOfLines={1}>
                        {acc.name}
                      </AppText>
                    </View>
                  ) : null}

                  {refLabel ? (
                    <View
                      style={[
                        styles.infoChip,
                        { backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radius.pill },
                      ]}
                    >
                      <AppText variant="caption" color="textSecondary" tabularNums numberOfLines={1}>
                        {refLabel}
                      </AppText>
                    </View>
                  ) : null}

                  {draft.feeMinor > 0 ? (
                    <View
                      style={[
                        styles.infoChip,
                        { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.pill },
                      ]}
                    >
                      <Money
                        variant="caption"
                        prefix={`${t('overview.mfsFeesLabel')}: `}
                        amountMinor={draft.feeMinor}
                        currency={settings.currency}
                        color="expense"
                      />
                    </View>
                  ) : null}

                  <PressableScale
                    pressScale={0.96}
                    accessibilityRole="button"
                    onPress={() => setExpandedRawId((prev) => (prev === draft.id ? null : draft.id))}
                    style={[
                      styles.infoChip,
                      {
                        backgroundColor: theme.colors.surfaceSunken,
                        borderRadius: theme.radius.pill,
                        marginLeft: 'auto',
                      },
                    ]}
                  >
                    <AppText variant="caption" color="textTertiary">
                      {t('inbox.viewSmsCta')}
                    </AppText>
                    <AppIcon
                      name={isRawExpanded ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={theme.colors.textTertiary}
                    />
                  </PressableScale>
                </View>

                {isRawExpanded ? (
                  <View
                    style={[
                      styles.rawSmsBox,
                      {
                        backgroundColor: theme.colors.surfaceSunken,
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    <AppText variant="caption" color="textSecondary">
                      {draft.rawText}
                    </AppText>
                  </View>
                ) : null}

                <View style={styles.draftActions}>
                  <Button
                    testID={`inbox-dismiss-${draft.id}`}
                    title={t('inbox.dismissCta')}
                    variant="ghost"
                    size="sm"
                    onPress={() => void handleDismissDraft(draft.id)}
                  />
                  <Button
                    testID={`inbox-edit-${draft.id}`}
                    title={t('inbox.editCta')}
                    variant="secondary"
                    size="sm"
                    onPress={() => setEditingDraft(draft)}
                  />
                  <Button
                    testID={`inbox-approve-${draft.id}`}
                    title={t('inbox.approveCta')}
                    size="sm"
                    onPress={() => void handleApproveDraft(draft)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Surface>
            );
          })}

          {drafts.length > visibleCount ? (
            <Button
              testID="inbox-show-more"
              title={t('inbox.showMoreCta', { count: drafts.length - visibleCount })}
              variant="secondary"
              onPress={() => setVisibleCount((prev) => prev + 50)}
            />
          ) : null}
        </View>
      ) : (
        <Surface>
          <EmptyState
            icon="inbox"
            title={t('inbox.emptyTitle')}
            body={t('inbox.emptyBody')}
            ctaLabel={t('inbox.pasteTextCta')}
            onCtaPress={() => setPasteOpen(true)}
          />
        </Surface>
      )}

      {/* Paste SMS / Statement Sheet */}
      <Sheet
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title={t('inbox.pasteSheetTitle')}
      >
        <Field
          testID="inbox-paste-input"
          label={t('inbox.pasteTextCta')}
          value={pasteText}
          onChangeText={setPasteText}
          placeholder={t('inbox.pastePlaceholder')}
          multiline
          numberOfLines={4}
        />
        <Button
          testID="inbox-parse-btn"
          title={t('inbox.parseCta')}
          disabled={!pasteText.trim()}
          onPress={() => {
            const txt = pasteText;
            setPasteOpen(false);
            void ingestRawText(txt, 'share_text');
          }}
        />
      </Sheet>

      {/* Quick Category/Wallet Reassignment Sheet */}
      <Sheet
        visible={editingDraft !== null}
        onClose={() => setEditingDraft(null)}
        title={editingDraft?.description || t('inbox.editCta')}
      >
        {editingDraft ? (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textSecondary">
                {t('common.category')}
              </AppText>
              <View style={styles.chipWrap}>
                {categories
                  .filter((c) => c.kind === editingDraft.type)
                  .slice(0, 12)
                  .map((cat) => (
                    <Chip
                      key={cat.id}
                      label={cat.name}
                      selected={editingDraft.categoryId === cat.id}
                      onPress={() => void updateEditingCategory(cat.id)}
                    />
                  ))}
              </View>
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textSecondary">
                {t('tx.walletLabel')}
              </AppText>
              <View style={styles.chipWrap}>
                {accounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    selected={editingDraft.accountId === acc.id}
                    onPress={() => void updateEditingAccount(acc.id)}
                  />
                ))}
              </View>
            </View>
            <Button
              title={t('inbox.approveCta')}
              onPress={() => {
                const target = editingDraft;
                setEditingDraft(null);
                void handleApproveDraft(target);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listenerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolPill: {
    flexGrow: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rawSmsBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  draftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
