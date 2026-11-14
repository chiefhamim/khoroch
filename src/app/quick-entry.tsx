import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  currentLocalTime,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import { formatMinorToDraft, getCurrencySymbol, parseMoneyInput } from '@/domain/money';
import type { Category, DueKind, LocalDate, TransactionType } from '@/domain/types';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_QUICK_ENTRY_LENGTH,
  isValidLocalTime,
} from '@/domain/validation';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { Field } from '@/ui/Field';
import { hapticSelection, hapticSuccess } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { TimeField } from '@/ui/TimeField';
import { useToast } from '@/ui/Toast';
import { parse as parseEntry, type ParsedDraftKind } from '@/voice/parser';
import { pickPersonColorKey } from '@/domain/dues';
import { useAccounts } from '@/state/useAccounts';
import { usePeople } from '@/state/usePeople';
import { WalletAvatar } from '@/ui/WalletAvatar';
import {
  getSpeechPermissionStatus,
  isAvailable as isSpeechAvailable,
  requestSpeechPermission,
  startListening,
  supportsOnDeviceRecognition,
  type SpeechSessionHandle,
} from '@/voice/speech';
import { PressableScale } from '@/ui/PressableScale';

interface EditableDraft {
  id: string;
  draftKind: ParsedDraftKind;
  type: TransactionType;
  amountText: string;
  categoryId: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  feeText: string;
  asksFee: boolean;
  dueKind: DueKind;
  personId: string | null;
  personName: string;
  missingWalletName: string | null;
  missingWalletHint: string | null;
  description: string;
  occurredOn: LocalDate;
  occurredTime: string;
  needsAmount: boolean;
  needsCategory: boolean;
}

export default function QuickEntryScreen() {
  const { repo, settings, updateSetting } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { accounts } = useAccounts();
  const { people, allPeople } = usePeople();

  const [categories, setCategories] = useState<Category[]>([]);
  const [inputText, setInputText] = useState('');
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [parseAttempted, setParseAttempted] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [speechSupported] = useState(() => isSpeechAvailable());
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [voiceExplainOpen, setVoiceExplainOpen] = useState(false);
  const [speechDisclosureOpen, setSpeechDisclosureOpen] = useState(false);
  const usedVoiceRef = useRef(false);
  const speechSessionRef = useRef<SpeechSessionHandle | null>(null);

  useEffect(() => {
    let active = true;
    repo.listCategories({ includeArchived: false }).then((cats) => {
      if (active) setCategories(cats);
    });
    return () => {
      active = false;
      speechSessionRef.current?.abort();
      speechSessionRef.current = null;
    };
  }, [repo]);

  const handleClose = useCallback(() => {
    speechSessionRef.current?.abort();
    speechSessionRef.current = null;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  const runParse = useCallback(
    (sourceText: string) => {
      const today = todayLocalDate();
      const defaultTime = currentLocalTime();
      const parsed = parseEntry(sourceText, today, categories, { accounts, people });
      setParseAttempted(true);
      setSaveAttempted(false);
      setSaveError(null);

      setDrafts(
        parsed.map((item) => ({
          id: `${item.id}_${Crypto.randomUUID().slice(0, 6)}`,
          draftKind: item.draftKind ?? 'transaction',
          type: item.type,
          amountText: item.amountMinor !== null ? formatMinorToDraft(item.amountMinor) : '',
          categoryId: item.categoryId,
          accountId: item.accountId ?? null,
          fromAccountId: item.fromAccountId ?? accounts[0]?.id ?? null,
          toAccountId: item.toAccountId ?? accounts[1]?.id ?? null,
          feeText: item.asksFee ? '0' : '',
          asksFee: Boolean(item.asksFee),
          dueKind: item.dueKind ?? 'lent',
          personId: item.personId ?? null,
          personName: item.personName ?? '',
          missingWalletName: item.missingWalletName ?? null,
          missingWalletHint: item.missingWalletHint ?? null,
          description: item.description,
          occurredOn: item.occurredOn,
          occurredTime: defaultTime,
          needsAmount: item.needsAmount,
          needsCategory: item.needsCategory,
        }))
      );
    },
    [accounts, categories, people]
  );

  const beginListening = useCallback(() => {
    setVoiceMessage(null);
    usedVoiceRef.current = true;
    setIsListening(true);

    const handle = startListening({
      onResult: (transcript, isFinal) => {
        setInputText(transcript);
        if (isFinal && transcript.trim().length > 0) {
          runParse(transcript);
        }
      },
      onError: (msg) => {
        setVoiceMessage(msg);
        setIsListening(false);
        speechSessionRef.current = null;
      },
      onEnd: () => {
        setIsListening(false);
        speechSessionRef.current = null;
      },
    });

    if (!handle) {
      setIsListening(false);
    } else {
      speechSessionRef.current = handle;
    }
  }, [runParse]);

  const continueMicFlow = async () => {
    const status = await getSpeechPermissionStatus();
    if (status === 'granted') {
      beginListening();
    } else if (status === 'undetermined') {
      setVoiceExplainOpen(true);
    } else {
      setVoiceMessage(t('quickEntry.voiceDenied'));
    }
  };

  const handleMicPress = async () => {
    if (isListening) {
      speechSessionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceMessage(null);
    if (!supportsOnDeviceRecognition() && !settings.speechDisclosureAccepted) {
      setSpeechDisclosureOpen(true);
      return;
    }
    await continueMicFlow();
  };

  const handleConfirmSpeechDisclosure = async () => {
    setSpeechDisclosureOpen(false);
    await updateSetting('speechDisclosureAccepted', true);
    await continueMicFlow();
  };

  const handleConfirmPermissionExplain = async () => {
    setVoiceExplainOpen(false);
    const result = await requestSpeechPermission();
    if (result === 'granted') {
      beginListening();
    } else {
      setVoiceMessage(t('quickEntry.voiceDenied'));
    }
  };

  const updateDraft = (id: string, updater: (prev: EditableDraft) => EditableDraft) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));
  };

  const removeDraft = (id: string) => {
    hapticSelection();
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleConfirmSave = async () => {
    setSaveAttempted(true);
    setSaveError(null);
    if (drafts.length === 0 || saving) return;

    const validated: {
      draft: EditableDraft;
      amountMinor: number;
      feeMinor: number;
    }[] = [];

    for (const d of drafts) {
      const money = parseMoneyInput(d.amountText);
      const validAmt = money.ok && money.minor !== null && money.minor > 0 ? money.minor : null;
      const validDate = isValidLocalDate(d.occurredOn);
      const trimmedTime = d.occurredTime.trim();
      const validTime = trimmedTime.length === 0 || isValidLocalTime(trimmedTime);

      if (validAmt === null || !validDate || !validTime) {
        setSaveError(t('quickEntry.fixErrorsBeforeSave'));
        return;
      }

      if (d.draftKind === 'transaction' && !d.categoryId) {
        setSaveError(t('quickEntry.fixErrorsBeforeSave'));
        return;
      }

      let feeMinor = 0;
      if (d.draftKind === 'transfer') {
        if (!d.fromAccountId || !d.toAccountId || d.fromAccountId === d.toAccountId) {
          setSaveError(t('quickEntry.fixErrorsBeforeSave'));
          return;
        }
        const cleanFee = d.feeText.trim();
        if (cleanFee.length > 0) {
          const parsedFee = parseMoneyInput(cleanFee);
          if (!parsedFee.ok || parsedFee.minor === null || parsedFee.minor < 0) {
            setSaveError(t('quickEntry.fixErrorsBeforeSave'));
            return;
          }
          feeMinor = parsedFee.minor;
        }
      }

      if (d.draftKind === 'due' && !d.personId && !d.personName.trim()) {
        setSaveError(t('quickEntry.fixErrorsBeforeSave'));
        return;
      }

      validated.push({
        draft: d,
        amountMinor: validAmt,
        feeMinor,
      });
    }

    setSaving(true);
    try {
      const source = usedVoiceRef.current ? 'voice' : 'quick';
      const createdPeopleByName = new Map<string, string>();
      let createdPeopleCount = allPeople.length;

      for (const item of validated) {
        const d = item.draft;
        const cleanTime = d.occurredTime.trim() || null;

        if (d.draftKind === 'transfer') {
          if (!d.fromAccountId || !d.toAccountId) continue;
          await repo.createTransfer({
            id: Crypto.randomUUID(),
            fromAccountId: d.fromAccountId,
            toAccountId: d.toAccountId,
            amountMinor: item.amountMinor,
            feeMinor: item.feeMinor,
            currency: settings.currency,
            occurredOn: d.occurredOn,
            occurredTime: cleanTime,
            note: d.description.trim(),
          });
        } else if (d.draftKind === 'due') {
          const cleanPersonName = d.personName.trim();
          const lowerKey = cleanPersonName.toLowerCase();
          let resolvedPersonId =
            d.personId ??
            people.find((p) => p.name.trim().toLowerCase() === lowerKey)?.id ??
            createdPeopleByName.get(lowerKey) ??
            null;

          if (!resolvedPersonId) {
            resolvedPersonId = `person_${Crypto.randomUUID().slice(0, 12)}`;
            await repo.insertPerson({
              id: resolvedPersonId,
              name: cleanPersonName,
              colorKey: pickPersonColorKey(createdPeopleCount),
              honorific: 'none',
            });
            createdPeopleCount += 1;
            createdPeopleByName.set(lowerKey, resolvedPersonId);
          }

          await repo.insertDueEntry({
            id: `due_${Crypto.randomUUID().slice(0, 12)}`,
            personId: resolvedPersonId,
            kind: d.dueKind,
            amountMinor: item.amountMinor,
            accountId: d.accountId,
            occurredOn: d.occurredOn,
            occurredTime: cleanTime,
            note: d.description.trim(),
          });
        } else {
          await repo.insertTransaction({
            id: Crypto.randomUUID(),
            type: d.type,
            amountMinor: item.amountMinor,
            currency: settings.currency,
            categoryId: d.categoryId,
            accountId: d.accountId,
            description: d.description.trim(),
            note: '',
            occurredOn: d.occurredOn,
            occurredTime: cleanTime,
            source,
          });
        }
      }
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('tx.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      handleClose();
    } catch {
      setSaveError(t('tx.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = getCurrencySymbol(settings.currency);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.flex1, { backgroundColor: theme.colors.bg }]}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex1}
      >
        {/* Top Bar */}
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: theme.geometry.screenMargin,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.sm,
            },
          ]}
        >
          <IconButton
            testID="quick-entry-close"
            icon="x"
            variant="sunken"
            size={40}
            accessibilityLabel={t('common.close')}
            onPress={handleClose}
          />
          <AppText variant="headline">{t('quickEntry.title')}</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex1}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.geometry.screenMargin,
            paddingBottom: theme.spacing.xxxl,
            gap: theme.spacing.md,
          }}
        >
          <AppText variant="body" color="textSecondary">
            {t('quickEntry.subtitle')}
          </AppText>

          {/* Natural-language composer card */}
          <Surface style={{ gap: theme.spacing.md }}>
            <Field
              testID="quick-entry-input"
              label={t('quickEntry.inputLabel')}
              placeholder={t('quickEntry.inputPlaceholder')}
              maxLength={MAX_QUICK_ENTRY_LENGTH}
              value={inputText}
              onChangeText={(txt) => {
                usedVoiceRef.current = false;
                setInputText(txt);
              }}
              onClear={
                inputText.length > 0
                  ? () => {
                      usedVoiceRef.current = false;
                      setInputText('');
                    }
                  : undefined
              }
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />

            {voiceMessage ? (
              <Banner tone="danger" icon="circle-alert" message={voiceMessage} />
            ) : null}

            <View style={[styles.composerActions, { gap: theme.spacing.sm }]}>
              <Button
                testID="quick-entry-parse-btn"
                title={t('quickEntry.parseCta')}
                variant="primary"
                leftIcon="sparkle"
                disabled={inputText.trim().length === 0}
                onPress={() => runParse(inputText)}
                style={styles.flex1}
              />

              {speechSupported ? (
                <IconButton
                  testID="quick-entry-mic-btn"
                  icon={isListening ? 'circle-alert' : 'mic'}
                  variant={isListening ? 'accent' : 'accentSoft'}
                  size={52}
                  iconSize={22}
                  accessibilityLabel={
                    isListening ? t('quickEntry.voiceStop') : t('quickEntry.voiceBtn')
                  }
                  onPress={() => {
                    void handleMicPress();
                  }}
                />
              ) : null}
            </View>

            {isListening ? (
              <AppText variant="caption" color="accent">
                {t('quickEntry.voiceListening')}
              </AppText>
            ) : null}
          </Surface>

          {/* Empty Parse Feedback */}
          {parseAttempted && drafts.length === 0 ? (
            <Surface testID="quick-entry-no-result" variant="sunken">
              <AppText variant="body" color="textSecondary">
                {t('quickEntry.noResult')}
              </AppText>
            </Surface>
          ) : null}

          {/* Parsed Draft Review Cards */}
          {drafts.length > 0 ? (
            <View style={{ gap: theme.spacing.md }}>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="headline">
                  {t('quickEntry.reviewTitle', { count: drafts.length })}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('quickEntry.nothingSavedNote')}
                </AppText>
              </View>

              {drafts.map((draft, idx) => {
                const catsForType = categories.filter((c) => c.kind === draft.type);
                const parsedMoney = parseMoneyInput(draft.amountText);
                const invalidAmount =
                  !parsedMoney.ok || parsedMoney.minor === null || parsedMoney.minor <= 0;
                const invalidCategory = draft.draftKind === 'transaction' && !draft.categoryId;
                const invalidTransferAccounts =
                  draft.draftKind === 'transfer' &&
                  (!draft.fromAccountId ||
                    !draft.toAccountId ||
                    draft.fromAccountId === draft.toAccountId);
                const invalidPerson =
                  draft.draftKind === 'due' && !draft.personId && !draft.personName.trim();
                const selectedCategory = catsForType.find((c) => c.id === draft.categoryId);

                return (
                  <Surface
                    key={draft.id}
                    testID={`quick-draft-${idx}`}
                    style={{ gap: theme.spacing.md }}
                  >
                    {/* Card Header: Tile + Kind/Type Switcher + Trash */}
                    <View style={[styles.draftHeader, { gap: theme.spacing.sm }]}>
                      <IconTile
                        icon={
                          draft.draftKind === 'transfer'
                            ? 'arrow-left-right'
                            : draft.draftKind === 'due'
                              ? 'hand-coins'
                              : selectedCategory?.icon ?? 'shapes'
                        }
                        colorKey={
                          draft.draftKind === 'transfer'
                            ? 'blue'
                            : draft.draftKind === 'due'
                              ? 'teal'
                              : selectedCategory?.colorKey ?? 'gray'
                        }
                        neutral={draft.draftKind === 'transaction' && !selectedCategory}
                        size="sm"
                      />
                      <View style={styles.flex1}>
                        {draft.draftKind === 'transaction' ? (
                          <SegmentedControl
                            size="sm"
                            value={draft.type}
                            options={[
                              { value: 'expense', label: t('common.expense') },
                              { value: 'income', label: t('common.income') },
                            ]}
                            onChange={(nextType) => {
                              if (nextType === draft.type) return;
                              updateDraft(draft.id, (prev) => ({
                                ...prev,
                                type: nextType,
                                categoryId: null,
                                needsCategory: true,
                              }));
                            }}
                          />
                        ) : (
                          <View
                            style={[
                              styles.kindPillTag,
                              {
                                backgroundColor: theme.colors.surfaceSunken,
                                borderRadius: theme.radius.pill,
                              },
                            ]}
                          >
                            <AppText variant="label" color="text">
                              {draft.draftKind === 'transfer'
                                ? t('quickEntry.draftTransfer')
                                : t('quickEntry.draftDue')}
                            </AppText>
                          </View>
                        )}
                      </View>
                      <IconButton
                        testID={`quick-draft-remove-${idx}`}
                        icon="trash-2"
                        variant="sunken"
                        size={36}
                        iconSize={16}
                        accessibilityLabel={t('quickEntry.removeDraft')}
                        onPress={() => removeDraft(draft.id)}
                      />
                    </View>

                    {/* Missing wallet helpful hint */}
                    {draft.missingWalletHint ? (
                      <Banner
                        testID={`quick-draft-wallet-hint-${idx}`}
                        tone="accent"
                        icon="wallet"
                        message={`${draft.missingWalletHint} · ${t('quickEntry.addWalletCta')}`}
                        showChevron
                        onPress={() => {
                          handleClose();
                          router.push('/wallets?setup=1' as never);
                        }}
                      />
                    ) : null}

                    {/* Amount Input */}
                    <Field
                      testID={`quick-draft-amount-${idx}`}
                      label={`${t('common.amount')} (${currencySymbol})`}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={draft.amountText}
                      error={
                        (saveAttempted || draft.needsAmount) && invalidAmount
                          ? t('quickEntry.needsAmount')
                          : null
                      }
                      errorTestID={`quick-draft-needs-amount-${idx}`}
                      onChangeText={(txt) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          amountText: txt,
                          needsAmount: false,
                        }))
                      }
                    />

                    {/* Transaction Category & Wallet */}
                    {draft.draftKind === 'transaction' ? (
                      <>
                        <View style={{ gap: theme.spacing.xs }}>
                          <AppText variant="label" color="textSecondary">
                            {t('common.category')}
                          </AppText>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
                          >
                            {catsForType.map((cat) => {
                              const selected = draft.categoryId === cat.id;
                              return (
                                <PressableScale pressScale={0.98}
                                  key={cat.id}
                                  testID={`quick-draft-${idx}-cat-${cat.id}`}
                                  accessibilityRole="button"
                                  accessibilityLabel={cat.name}
                                  accessibilityState={{ selected }}
                                  onPress={() => {
                                    hapticSelection();
                                    updateDraft(draft.id, (prev) => ({
                                      ...prev,
                                      categoryId: cat.id,
                                      needsCategory: false,
                                    }));
                                  }}
                                  style={[
                                    styles.draftCatChip,
                                    {
                                      backgroundColor: selected
                                        ? theme.colors.accentSoft
                                        : theme.colors.surfaceSunken,
                                      borderColor: selected
                                        ? theme.colors.accent
                                        : 'transparent',
                                      borderRadius: theme.radius.chip,
                                      minHeight: theme.touch.min,
                                    },
                                  ]}
                                >
                                  <IconTile
                                    icon={cat.icon}
                                    colorKey={cat.colorKey}
                                    selected={selected}
                                    size={26}
                                  />
                                  <AppText
                                    variant="label"
                                    color={selected ? 'accent' : 'text'}
                                    numberOfLines={1}
                                  >
                                    {cat.name}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </ScrollView>
                          {(saveAttempted || draft.needsCategory) && invalidCategory ? (
                            <AppText
                              testID={`quick-draft-needs-category-${idx}`}
                              variant="caption"
                              color="danger"
                            >
                              {t('quickEntry.needsCategory')}
                            </AppText>
                          ) : null}
                        </View>

                        {accounts.length > 0 ? (
                          <View style={{ gap: theme.spacing.xs }}>
                            <AppText variant="label" color="textSecondary">
                              {t('quickEntry.walletLabel')}
                            </AppText>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              keyboardShouldPersistTaps="handled"
                              contentContainerStyle={{ gap: theme.spacing.xs }}
                            >
                              <Chip
                                testID={`quick-draft-${idx}-wallet-none`}
                                label={t('tx.noWallet')}
                                selected={draft.accountId === null}
                                onPress={() =>
                                  updateDraft(draft.id, (prev) => ({ ...prev, accountId: null }))
                                }
                              />
                              {accounts.map((acc) => (
                                <PressableScale pressScale={0.98}
                                  key={acc.id}
                                  testID={`quick-draft-${idx}-wallet-${acc.id}`}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: draft.accountId === acc.id }}
                                  onPress={() => {
                                    hapticSelection();
                                    updateDraft(draft.id, (prev) => ({
                                      ...prev,
                                      accountId: acc.id,
                                    }));
                                  }}
                                  style={[
                                    styles.walletChip,
                                    {
                                      backgroundColor:
                                        draft.accountId === acc.id
                                          ? theme.colors.accentSoft
                                          : theme.colors.surfaceSunken,
                                      borderColor:
                                        draft.accountId === acc.id
                                          ? theme.colors.accent
                                          : 'transparent',
                                      borderRadius: theme.radius.pill,
                                    },
                                  ]}
                                >
                                  <WalletAvatar account={acc} size="xs" />
                                  <AppText
                                    variant="caption"
                                    color={draft.accountId === acc.id ? 'accent' : 'text'}
                                  >
                                    {acc.name}
                                  </AppText>
                                </PressableScale>
                              ))}
                            </ScrollView>
                          </View>
                        ) : null}
                      </>
                    ) : null}

                    {/* Transfer Pickers & Cash-out Fee */}
                    {draft.draftKind === 'transfer' ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <View style={{ gap: theme.spacing.xs }}>
                          <AppText variant="label" color="textSecondary">
                            {t('quickEntry.fromWallet')}
                          </AppText>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: theme.spacing.xs }}
                          >
                            {accounts.map((acc) => {
                              const selected = draft.fromAccountId === acc.id;
                              return (
                                <PressableScale pressScale={0.98}
                                  key={acc.id}
                                  accessibilityRole="button"
                                  onPress={() =>
                                    updateDraft(draft.id, (prev) => ({
                                      ...prev,
                                      fromAccountId: acc.id,
                                    }))
                                  }
                                  style={[
                                    styles.walletChip,
                                    {
                                      backgroundColor: selected
                                        ? theme.colors.accentSoft
                                        : theme.colors.surfaceSunken,
                                      borderColor: selected ? theme.colors.accent : 'transparent',
                                      borderRadius: theme.radius.pill,
                                    },
                                  ]}
                                >
                                  <WalletAvatar account={acc} size="xs" />
                                  <AppText variant="caption" color={selected ? 'accent' : 'text'}>
                                    {acc.name}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </ScrollView>
                        </View>

                        <View style={{ gap: theme.spacing.xs }}>
                          <AppText variant="label" color="textSecondary">
                            {t('quickEntry.toWallet')}
                          </AppText>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: theme.spacing.xs }}
                          >
                            {accounts.map((acc) => {
                              const selected = draft.toAccountId === acc.id;
                              return (
                                <PressableScale pressScale={0.98}
                                  key={acc.id}
                                  accessibilityRole="button"
                                  onPress={() =>
                                    updateDraft(draft.id, (prev) => ({
                                      ...prev,
                                      toAccountId: acc.id,
                                    }))
                                  }
                                  style={[
                                    styles.walletChip,
                                    {
                                      backgroundColor: selected
                                        ? theme.colors.accentSoft
                                        : theme.colors.surfaceSunken,
                                      borderColor: selected ? theme.colors.accent : 'transparent',
                                      borderRadius: theme.radius.pill,
                                    },
                                  ]}
                                >
                                  <WalletAvatar account={acc} size="xs" />
                                  <AppText variant="caption" color={selected ? 'accent' : 'text'}>
                                    {acc.name}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </ScrollView>
                        </View>

                        {saveAttempted && invalidTransferAccounts ? (
                          <AppText variant="caption" color="danger">
                            {t('quickEntry.needsAccounts')}
                          </AppText>
                        ) : null}

                        <Field
                          testID={`quick-draft-fee-${idx}`}
                          label={`${t('quickEntry.feeLabel')} (${currencySymbol})`}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          value={draft.feeText}
                          onChangeText={(txt) =>
                            updateDraft(draft.id, (prev) => ({ ...prev, feeText: txt }))
                          }
                        />
                      </View>
                    ) : null}

                    {/* Due Direction, Person & Optional Wallet */}
                    {draft.draftKind === 'due' ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          contentContainerStyle={{ gap: theme.spacing.xs }}
                        >
                          {(
                            [
                              { kind: 'lent', label: t('people.kindLent') },
                              { kind: 'received_back', label: t('people.kindReceivedBack') },
                              { kind: 'borrowed', label: t('people.kindBorrowed') },
                              { kind: 'paid_back', label: t('people.kindPaidBack') },
                            ] as const
                          ).map((opt) => (
                            <Chip
                              key={opt.kind}
                              label={opt.label}
                              selected={draft.dueKind === opt.kind}
                              onPress={() =>
                                updateDraft(draft.id, (prev) => ({ ...prev, dueKind: opt.kind }))
                              }
                            />
                          ))}
                        </ScrollView>

                        <Field
                          testID={`quick-draft-person-${idx}`}
                          label={t('quickEntry.personLabel')}
                          placeholder={t('quickEntry.personPlaceholder')}
                          value={draft.personName}
                          error={saveAttempted && invalidPerson ? t('quickEntry.needsPerson') : null}
                          onChangeText={(txt) =>
                            updateDraft(draft.id, (prev) => ({
                              ...prev,
                              personName: txt,
                              personId:
                                people.find(
                                  (p) => p.name.trim().toLowerCase() === txt.trim().toLowerCase()
                                )?.id ?? null,
                            }))
                          }
                        />

                        {accounts.length > 0 ? (
                          <View style={{ gap: theme.spacing.xs }}>
                            <AppText variant="label" color="textSecondary">
                              {t('due.walletLabel')}
                            </AppText>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              keyboardShouldPersistTaps="handled"
                              contentContainerStyle={{ gap: theme.spacing.xs }}
                            >
                              <Chip
                                label={t('due.noWallet')}
                                selected={draft.accountId === null}
                                onPress={() =>
                                  updateDraft(draft.id, (prev) => ({ ...prev, accountId: null }))
                                }
                              />
                              {accounts.map((acc) => (
                                <PressableScale pressScale={0.98}
                                  key={acc.id}
                                  accessibilityRole="button"
                                  onPress={() =>
                                    updateDraft(draft.id, (prev) => ({
                                      ...prev,
                                      accountId: acc.id,
                                    }))
                                  }
                                  style={[
                                    styles.walletChip,
                                    {
                                      backgroundColor:
                                        draft.accountId === acc.id
                                          ? theme.colors.accentSoft
                                          : theme.colors.surfaceSunken,
                                      borderColor:
                                        draft.accountId === acc.id
                                          ? theme.colors.accent
                                          : 'transparent',
                                      borderRadius: theme.radius.pill,
                                    },
                                  ]}
                                >
                                  <WalletAvatar account={acc} size="xs" />
                                  <AppText
                                    variant="caption"
                                    color={draft.accountId === acc.id ? 'accent' : 'text'}
                                  >
                                    {acc.name}
                                  </AppText>
                                </PressableScale>
                              ))}
                            </ScrollView>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Description Input */}
                    <Field
                      testID={`quick-draft-desc-${idx}`}
                      label={t('common.description')}
                      leftIcon="pencil"
                      placeholder={t('tx.descriptionPlaceholder')}
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      value={draft.description}
                      onChangeText={(txt) =>
                        updateDraft(draft.id, (prev) => ({ ...prev, description: txt }))
                      }
                    />

                    {/* Native Date & Time Chips */}
                    <View style={[styles.dateTimeRow, { gap: theme.spacing.sm }]}>
                      <DateField
                        testID={`quick-draft-date-${idx}`}
                        value={draft.occurredOn}
                        onChange={(nextDate) =>
                          updateDraft(draft.id, (prev) => ({ ...prev, occurredOn: nextDate }))
                        }
                        maximumDate={new Date()}
                      />
                      <TimeField
                        testID={`quick-draft-time-${idx}`}
                        value={draft.occurredTime}
                        onChange={(nextTime) =>
                          updateDraft(draft.id, (prev) => ({ ...prev, occurredTime: nextTime }))
                        }
                      />
                    </View>
                  </Surface>
                );
              })}

              {saveError ? (
                <AppText testID="quick-entry-save-error" variant="body" color="danger">
                  {saveError}
                </AppText>
              ) : null}

              <Button
                testID="quick-entry-confirm-btn"
                title={t('quickEntry.confirmSave', { count: drafts.length })}
                variant="primary"
                leftIcon="check"
                loading={saving}
                disabled={saving}
                onPress={() => {
                  void handleConfirmSave();
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Voice Permission Rationale Bottom Sheet */}
      <Sheet
        visible={voiceExplainOpen}
        onClose={() => setVoiceExplainOpen(false)}
        title={t('quickEntry.voiceExplainTitle')}
      >
        <View style={styles.voiceModalInfo}>
          <View
            style={[
              styles.voiceModalIcon,
              {
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppIcon name="mic" size={24} color={theme.colors.accent} />
          </View>
          <AppText variant="body" color="textSecondary" style={styles.flex1}>
            {t('quickEntry.voiceExplainBody')}
          </AppText>
        </View>
        <View style={styles.sheetActionsRow}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            onPress={() => setVoiceExplainOpen(false)}
            style={styles.flex1}
          />
          <Button
            title={t('quickEntry.voiceExplainContinue')}
            variant="primary"
            onPress={() => {
              void handleConfirmPermissionExplain();
            }}
            style={styles.flex1}
          />
        </View>
      </Sheet>

      {/* One-time Online Speech Disclosure Bottom Sheet */}
      <Sheet
        testID="quick-entry-speech-disclosure-sheet"
        visible={speechDisclosureOpen}
        onClose={() => setSpeechDisclosureOpen(false)}
        title={t('quickEntry.speechDisclosureTitle')}
      >
        <View style={styles.voiceModalInfo}>
          <View
            style={[
              styles.voiceModalIcon,
              {
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppIcon name="mic" size={24} color={theme.colors.accent} />
          </View>
          <AppText variant="body" color="textSecondary" style={styles.flex1}>
            {t('quickEntry.speechDisclosureBody')}
          </AppText>
        </View>
        <View style={styles.sheetActionsRow}>
          <Button
            title={t('common.cancel')}
            variant="secondary"
            onPress={() => setSpeechDisclosureOpen(false)}
            style={styles.flex1}
          />
          <Button
            testID="quick-entry-speech-disclosure-confirm"
            title={t('quickEntry.speechDisclosureConfirm')}
            variant="primary"
            onPress={() => {
              void handleConfirmSpeechDisclosure();
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kindPillTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  draftCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  voiceModalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceModalIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
