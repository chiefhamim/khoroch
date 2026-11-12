import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDays, isValidLocalDate, todayLocalDate } from '@/domain/dates';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import type { Category, LocalDate, TransactionType } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { resolveIoniconName } from '@/ui/CategoryIcon';
import { Chip } from '@/ui/Chip';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { parse, type ParsedTransactionDraft } from '@/voice/parser';
import {
  getSpeechPermissionStatus,
  isAvailable as isSpeechAvailable,
  requestSpeechPermission,
  startListening,
  type SpeechSessionHandle,
} from '@/voice/speech';

interface EditableDraft extends ParsedTransactionDraft {
  amountText: string;
}

function formatAmountDraft(amountMinor: number | null): string {
  if (amountMinor === null) return '';
  const whole = amountMinor / 100;
  return Number.isInteger(whole) ? String(whole) : whole.toFixed(2);
}

function toEditableDrafts(drafts: ParsedTransactionDraft[]): EditableDraft[] {
  return drafts.map((d) => ({
    ...d,
    amountText: formatAmountDraft(d.amountMinor),
  }));
}

export default function QuickEntryScreen() {
  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [inputText, setInputText] = useState('');
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [speechSupported] = useState(() => isSpeechAvailable());
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [voiceExplainOpen, setVoiceExplainOpen] = useState(false);
  const speechSessionRef = useRef<SpeechSessionHandle | null>(null);

  const today = todayLocalDate();
  const yesterday = addDays(today, -1);

  useEffect(() => {
    let active = true;
    repo
      .listCategories({ includeArchived: false })
      .then((cats) => {
        if (active) setCategories(cats);
      })
      .catch(() => {});

    return () => {
      active = false;
      speechSessionRef.current?.abort();
    };
  }, [repo]);

  const runParse = (raw: string, fromVoice: boolean) => {
    setSaveError(null);
    const parsed = parse(raw, today, categories);
    setHasParsed(true);
    if (parsed.length === 0) {
      setDrafts([]);
      setParseNotice(t('quickEntry.noResult'));
      return;
    }
    setParseNotice(null);
    if (fromVoice) {
      setUsedVoice(true);
    }
    setDrafts(toEditableDrafts(parsed));
  };

  const handleBeginListening = () => {
    setSpeechError(null);
    setParseNotice(null);
    setListening(true);
    let latestTranscript = '';

    const handle = startListening({
      lang: 'en-US',
      onResult: (transcript, isFinal) => {
        latestTranscript = transcript;
        setInputText(transcript);
        if (isFinal && transcript.trim().length > 0) {
          setUsedVoice(true);
          runParse(transcript, true);
        }
      },
      onError: (msg) => {
        setListening(false);
        setSpeechError(msg);
        speechSessionRef.current = null;
      },
      onEnd: () => {
        setListening(false);
        speechSessionRef.current = null;
        if (latestTranscript.trim().length > 0) {
          runParse(latestTranscript, true);
        }
      },
    });

    if (!handle) {
      setListening(false);
    } else {
      speechSessionRef.current = handle;
    }
  };

  const handleMicPress = async () => {
    if (listening) {
      speechSessionRef.current?.stop();
      setListening(false);
      return;
    }

    const perm = await getSpeechPermissionStatus();
    if (perm === 'granted') {
      handleBeginListening();
      return;
    }
    if (perm === 'denied' || perm === 'unavailable') {
      setSpeechError(t('quickEntry.voiceDenied'));
      return;
    }
    setVoiceExplainOpen(true);
  };

  const handleVoiceExplainConfirm = async () => {
    setVoiceExplainOpen(false);
    const result = await requestSpeechPermission();
    if (result === 'granted') {
      handleBeginListening();
    } else {
      setSpeechError(t('quickEntry.voiceDenied'));
    }
  };

  const updateDraft = (id: string, patch: Partial<EditableDraft>) => {
    setSaveError(null);
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        next.needsAmount = next.amountMinor === null || next.amountMinor <= 0;
        next.needsCategory = !next.categoryId;
        return next;
      })
    );
  };

  const handleTypeChange = (id: string, nextType: TransactionType) => {
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const currentCat = categories.find((c) => c.id === item.categoryId);
        const keepCat = currentCat && currentCat.kind === nextType ? item.categoryId : null;
        return {
          ...item,
          type: nextType,
          categoryId: keepCat,
          needsCategory: !keepCat,
        };
      })
    );
  };

  const handleAmountChange = (id: string, rawText: string) => {
    const res = parseMoneyInput(rawText);
    updateDraft(id, {
      amountText: rawText,
      amountMinor: res.ok && res.minor ? res.minor : null,
    });
  };

  const handleRemoveDraft = (id: string) => {
    setSaveError(null);
    setDrafts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmAll = async () => {
    if (saving || drafts.length === 0) return;

    for (const d of drafts) {
      if (d.amountMinor === null || d.amountMinor <= 0 || !d.categoryId || !isValidLocalDate(d.occurredOn)) {
        setSaveError(t('quickEntry.fixErrorsBeforeSave'));
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const source = usedVoice ? 'voice' : 'quick';
      for (const d of drafts) {
        if (d.amountMinor === null || !d.categoryId) continue;
        await repo.insertTransaction({
          id: Crypto.randomUUID(),
          type: d.type,
          amountMinor: d.amountMinor,
          currency: settings.currency,
          categoryId: d.categoryId,
          description: d.description.trim(),
          occurredOn: d.occurredOn as LocalDate,
          occurredTime: null,
          note: '',
          source,
        });
      }
      bumpDataVersion();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setSaveError(t('error.genericBody'));
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding>
      <View style={[styles.header, { minHeight: theme.touch.min }]}>
        <AppText variant="title">{t('quickEntry.title')}</AppText>
        <Pressable
          testID="quick-entry-close"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={[
            styles.closeBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            },
          ]}
        >
          <Ionicons name="close" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <AppText variant="body" color="textMuted">
        {t('quickEntry.subtitle')}
      </AppText>

      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="label" color="textMuted">
          {t('quickEntry.inputLabel')}
        </AppText>
        <TextInput
          testID="quick-entry-input"
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            setUsedVoice(false);
            if (parseNotice) setParseNotice(null);
          }}
          placeholder={t('quickEntry.inputPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={[
            styles.textArea,
            {
              minHeight: 88,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceAlt,
              padding: theme.spacing.md,
              color: theme.colors.text,
              fontFamily: theme.typography.body.fontFamily,
              fontSize: theme.typography.body.fontSize,
            },
          ]}
        />

        {listening ? (
          <View
            style={[
              styles.listeningBanner,
              {
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.primarySoft,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <Ionicons name="mic" size={18} color={theme.colors.primary} />
            <AppText variant="label" color="primary">
              {t('quickEntry.voiceListening')}
            </AppText>
          </View>
        ) : null}

        {speechError ? (
          <AppText variant="caption" color="warning">
            {speechError}
          </AppText>
        ) : null}

        <View style={[styles.actionRow, { gap: theme.spacing.sm }]}>
          <Button
            testID="quick-entry-parse-btn"
            title={t('quickEntry.parseCta')}
            variant="primary"
            onPress={() => runParse(inputText, usedVoice)}
            style={{ flex: 1 }}
          />
          {speechSupported ? (
            <Button
              testID="quick-entry-mic-btn"
              title={listening ? t('quickEntry.voiceStop') : t('quickEntry.voiceBtn')}
              variant={listening ? 'danger' : 'secondary'}
              onPress={() => void handleMicPress()}
              style={{ minWidth: theme.touch.min + theme.spacing.xxxl }}
            />
          ) : null}
        </View>
      </Card>

      {parseNotice ? (
        <Card testID="quick-entry-no-result" tone="alt">
          <AppText variant="body" color="textMuted">
            {parseNotice}
          </AppText>
        </Card>
      ) : null}

      {hasParsed && drafts.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="heading">
              {t('quickEntry.reviewTitle', { count: drafts.length })}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('quickEntry.nothingSavedNote')}
            </AppText>
          </View>

          {drafts.map((draft, idx) => {
            const matchingCategories = categories.filter((c) => c.kind === draft.type);
            const dateInvalid = !isValidLocalDate(draft.occurredOn);

            return (
              <Card key={draft.id} testID={`quick-draft-${idx}`} style={{ gap: theme.spacing.md }}>
                <View style={styles.draftHeader}>
                  <AppText variant="label" color="textMuted">
                    {`#${idx + 1} · ${
                      draft.amountMinor !== null
                        ? formatMoney(draft.amountMinor, settings.currency)
                        : t('common.amount')
                    }`}
                  </AppText>
                  <Pressable
                    testID={`quick-draft-remove-${idx}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('quickEntry.removeDraft')}
                    onPress={() => handleRemoveDraft(draft.id)}
                    style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: theme.spacing.xs }}
                  >
                    <AppText variant="label" color="danger">
                      {t('quickEntry.removeDraft')}
                    </AppText>
                  </Pressable>
                </View>

                <SegmentedControl<TransactionType>
                  value={draft.type}
                  onChange={(val) => handleTypeChange(draft.id, val)}
                  options={[
                    { value: 'expense', label: t('common.expense') },
                    { value: 'income', label: t('common.income') },
                  ]}
                />

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText
                    variant="label"
                    color={draft.needsAmount ? 'danger' : 'textMuted'}
                  >
                    {t('common.amount')}
                  </AppText>
                  <TextInput
                    testID={`quick-draft-amount-${idx}`}
                    value={draft.amountText}
                    onChangeText={(txt) => handleAmountChange(draft.id, txt)}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.fieldInput,
                      {
                        minHeight: theme.touch.min,
                        borderRadius: theme.radius.md,
                        borderColor: draft.needsAmount ? theme.colors.danger : theme.colors.border,
                        backgroundColor: theme.colors.surfaceAlt,
                        paddingHorizontal: theme.spacing.md,
                        color: theme.colors.text,
                        fontFamily: theme.typography.heading.fontFamily,
                        fontSize: theme.typography.heading.fontSize,
                      },
                    ]}
                  />
                  {draft.needsAmount ? (
                    <AppText testID={`quick-draft-needs-amount-${idx}`} variant="caption" color="danger">
                      {t('quickEntry.needsAmount')}
                    </AppText>
                  ) : null}
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText
                    variant="label"
                    color={draft.needsCategory ? 'danger' : 'textMuted'}
                  >
                    {t('common.category')}
                  </AppText>
                  <View style={[styles.chipsRow, { gap: theme.spacing.sm }]}>
                    {matchingCategories.map((cat) => (
                      <Chip
                        key={cat.id}
                        testID={`quick-draft-${idx}-cat-${cat.id}`}
                        label={cat.name}
                        selected={draft.categoryId === cat.id}
                        icon={resolveIoniconName(cat.icon)}
                        onPress={() => updateDraft(draft.id, { categoryId: cat.id })}
                      />
                    ))}
                  </View>
                  {draft.needsCategory ? (
                    <AppText testID={`quick-draft-needs-category-${idx}`} variant="caption" color="danger">
                      {t('quickEntry.needsCategory')}
                    </AppText>
                  ) : null}
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color="textMuted">
                    {t('common.description')}
                  </AppText>
                  <TextInput
                    testID={`quick-draft-desc-${idx}`}
                    value={draft.description}
                    onChangeText={(txt) => updateDraft(draft.id, { description: txt })}
                    placeholder={t('tx.descriptionPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    style={[
                      styles.fieldInput,
                      {
                        minHeight: theme.touch.min,
                        borderRadius: theme.radius.md,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surfaceAlt,
                        paddingHorizontal: theme.spacing.md,
                        color: theme.colors.text,
                        fontFamily: theme.typography.body.fontFamily,
                        fontSize: theme.typography.body.fontSize,
                      },
                    ]}
                  />
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <AppText variant="label" color={dateInvalid ? 'danger' : 'textMuted'}>
                    {t('common.date')}
                  </AppText>
                  <View style={[styles.dateRow, { gap: theme.spacing.sm }]}>
                    <Chip
                      label={t('common.today')}
                      selected={draft.occurredOn === today}
                      onPress={() => updateDraft(draft.id, { occurredOn: today })}
                    />
                    <Chip
                      label={t('common.yesterday')}
                      selected={draft.occurredOn === yesterday}
                      onPress={() => updateDraft(draft.id, { occurredOn: yesterday })}
                    />
                    <TextInput
                      testID={`quick-draft-date-${idx}`}
                      value={draft.occurredOn}
                      onChangeText={(txt) => updateDraft(draft.id, { occurredOn: txt as LocalDate })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.colors.textMuted}
                      style={[
                        styles.fieldInput,
                        {
                          flex: 1,
                          minWidth: 110,
                          minHeight: theme.touch.min,
                          borderRadius: theme.radius.md,
                          borderColor: dateInvalid ? theme.colors.danger : theme.colors.border,
                          backgroundColor: theme.colors.surfaceAlt,
                          paddingHorizontal: theme.spacing.md,
                          color: theme.colors.text,
                          fontFamily: theme.typography.body.fontFamily,
                          fontSize: theme.typography.body.fontSize,
                        },
                      ]}
                    />
                  </View>
                  {dateInvalid ? (
                    <AppText variant="caption" color="danger">
                      {t('quickEntry.invalidDate')}
                    </AppText>
                  ) : null}
                </View>
              </Card>
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
            loading={saving}
            disabled={saving}
            onPress={() => void handleConfirmAll()}
          />
        </View>
      ) : null}

      <ConfirmModal
        visible={voiceExplainOpen}
        title={t('quickEntry.voiceExplainTitle')}
        body={t('quickEntry.voiceExplainBody')}
        confirmLabel={t('quickEntry.voiceExplainContinue')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void handleVoiceExplainConfirm()}
        onCancel={() => setVoiceExplainOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    borderWidth: 1,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInput: {
    borderWidth: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
