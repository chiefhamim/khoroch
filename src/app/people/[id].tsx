import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, TextInput, View } from 'react-native';
import { formatFriendlyDate, formatFriendlyTime, todayLocalDate } from '@/domain/dates';
import {
  buildReminderMessage,
  computePersonNetMinor,
  dueKindForAction,
  findOpenCycleStartDate,
  suggestSettleKindAndAmount,
  type ReminderLanguage,
} from '@/domain/dues';
import type { DueEntry, DueKind, PersonHonorific } from '@/domain/types';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useAccounts } from '@/state/useAccounts';
import { usePeople } from '@/state/usePeople';
import { containsBengali, mapFontToBangla } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText, estimateSingleLineMinWidth } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { DueEntrySheet } from '@/ui/DueEntrySheet';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { PersonAvatar } from '@/ui/PersonAvatar';
import { PersonEditorSheet } from '@/ui/PersonEditorSheet';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';
import { hapticSelection, hapticSuccess } from '@/ui/haptics';
import { PressableScale } from '@/ui/PressableScale';

function isIncomingDueKind(kind: DueKind): boolean {
  return kind === 'received_back' || kind === 'borrowed';
}

function getDueKindLabel(kind: DueKind): string {
  switch (kind) {
    case 'lent':
      return t('people.kindLentFull');
    case 'received_back':
      return t('people.kindReceivedBackFull');
    case 'borrowed':
      return t('people.kindBorrowedFull');
    case 'paid_back':
      return t('people.kindPaidBackFull');
  }
}

export default function PersonDetailScreen() {
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const personId = Array.isArray(id) ? id[0] : id;

  const { repo, settings } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { peopleById, allPeople, dueEntries, loading } = usePeople();
  const { accountsById } = useAccounts();

  const today = todayLocalDate();
  const referenceYear = Number.parseInt(today.slice(0, 4), 10);
  const currency = settings.currency;
  const use24Hour = true;

  const person = personId ? (peopleById.get(personId) ?? null) : null;

  const personEntries = useMemo<DueEntry[]>(() => {
    if (!personId) return [];
    return dueEntries
      .filter((e) => e.deletedAt == null && e.personId === personId)
      .sort((a, b) => {
        if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn);
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return b.id.localeCompare(a.id);
      });
  }, [dueEntries, personId]);

  const netMinor = useMemo(() => computePersonNetMinor(personEntries), [personEntries]);
  const sinceDate = useMemo(
    () => findOpenCycleStartDate(personEntries, netMinor),
    [personEntries, netMinor]
  );

  const [remindLang, setRemindLang] = useState<ReminderLanguage>('bn');
  const [editedMsgState, setEditedMsgState] = useState<{ base: string; value: string } | null>(
    null
  );
  const [dueSheetState, setDueSheetState] = useState<
    | { mode: 'closed' }
    | { mode: 'add'; action: 'gave' | 'got' }
    | { mode: 'settle' }
    | { mode: 'edit'; entry: DueEntry }
  >({ mode: 'closed' });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);

  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' && containsBengali(text)
      ? { minWidth: estimateSingleLineMinWidth(text, fontSize) }
      : null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/people');
    }
  };

  const generatedMessage = person
    ? buildReminderMessage({
        personName: person.name,
        honorific: person.honorific,
        amountMinor: Math.abs(netMinor),
        sinceDate,
        currency,
        language: remindLang,
        netMinor,
        referenceYear,
      })
    : '';

  const displayedMessage =
    editedMsgState && editedMsgState.base === generatedMessage
      ? editedMsgState.value
      : generatedMessage;

  const settlePreset = useMemo(() => suggestSettleKindAndAmount(netMinor), [netMinor]);

  const handleHonorificChange = async (next: PersonHonorific) => {
    if (!person || next === person.honorific) return;
    hapticSelection();
    await repo.updatePerson(person.id, { honorific: next });
    bumpDataVersion();
    setEditedMsgState(null);
  };

  const handleWhatsapp = async () => {
    const encoded = encodeURIComponent(displayedMessage);
    const url = `whatsapp://send?text=${encoded}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fallback cleanly to OS share sheet
    }
    try {
      await Share.share({ message: displayedMessage });
    } catch {
      // Cancelled
    }
  };

  const handleMessenger = async () => {
    try {
      await Share.share({ message: displayedMessage });
    } catch {
      // Cancelled
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(displayedMessage);
    hapticSuccess();
    showToast({
      message: t('people.remindCopiedToast'),
      icon: 'circle-check',
      tone: 'accent',
    });
  };

  const handleToggleArchive = async () => {
    if (!person) return;
    setConfirmArchive(false);
    setOptionsOpen(false);
    if (person.archivedAt == null) {
      await repo.archivePerson(person.id);
    } else {
      await repo.unarchivePerson(person.id);
    }
    hapticSuccess();
    bumpDataVersion();
    if (person.archivedAt == null) {
      handleBack();
    }
  };

  if (!loading && !person) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel={t('common.back')}
            onPress={handleBack}
          />
          <AppText variant="title" style={styles.flex1}>
            {t('people.title')}
          </AppText>
        </View>
        <ErrorState
          title={t('people.notFound')}
          body={t('error.genericBody')}
          retryLabel={t('common.back')}
          onRetry={handleBack}
        />
      </Screen>
    );
  }

  if (!person) {
    return null;
  }

  const absNet = Math.abs(netMinor);
  const recordAnotherLabel = t('people.recordAnotherCta');
  const honorificBadgeLabel =
    person.honorific === 'bhai'
      ? t('people.honorificBhai')
      : person.honorific === 'apu'
        ? t('people.honorificApu')
        : '';
  const useBanglaInputFont =
    remindLang === 'bn' || locale === 'bn' || containsBengali(displayedMessage);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <IconButton
          testID="person-detail-back"
          icon="arrow-left"
          accessibilityLabel={t('common.back')}
          onPress={handleBack}
        />
        <AppText variant="title" style={styles.flex1} numberOfLines={1}>
          {person.name}
        </AppText>
        <IconButton
          testID="person-detail-options"
          icon="sliders-horizontal"
          accessibilityLabel={t('people.moreActions')}
          onPress={() => {
            setConfirmArchive(false);
            setOptionsOpen(true);
          }}
        />
      </View>

      {/* Hero Summary Card */}
      <Surface testID="person-detail-hero" style={{ gap: theme.spacing.md }}>
        <View style={styles.heroTopRow}>
          <PersonAvatar name={person.name} colorKey={person.colorKey} size="lg" />
          <View style={[styles.flex1, { gap: 2 }]}>
            <View style={styles.nameBadgeRow}>
              <AppText variant="headline">{person.name}</AppText>
              {person.honorific !== 'none' ? (
                <View
                  style={[
                    styles.honorificBadge,
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    numberOfLines={1}
                    style={bnMinWidth(honorificBadgeLabel, 12)}
                  >
                    {honorificBadgeLabel}
                  </AppText>
                </View>
              ) : null}
            </View>

            {netMinor > 0 ? (
              <AppText variant="caption" color="accent">
                {t('people.owesYou')}
                {sinceDate
                  ? ` · ${t('people.sinceDate', { date: formatFriendlyDate(sinceDate, today, locale) })}`
                  : ''}
              </AppText>
            ) : netMinor < 0 ? (
              <AppText variant="caption" color="danger">
                {t('people.youOwe')}
                {sinceDate
                  ? ` · ${t('people.sinceDate', { date: formatFriendlyDate(sinceDate, today, locale) })}`
                  : ''}
              </AppText>
            ) : (
              <AppText variant="caption" color="textSecondary">
                {t('people.settledOn')}
              </AppText>
            )}

            <Money
              testID="person-detail-balance"
              variant="display"
              amountMinor={absNet}
              currency={currency}
              color={netMinor > 0 ? 'accent' : netMinor < 0 ? 'danger' : 'textSecondary'}
              allowCompact
            />
          </View>
        </View>

        <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
          <Button
            testID="person-gave-btn"
            title={t('people.gave')}
            variant="primary"
            leftIcon="arrow-up-right"
            onPress={() => {
              hapticSelection();
              setDueSheetState({ mode: 'add', action: 'gave' });
            }}
            style={styles.flex1}
          />
          <Button
            testID="person-got-btn"
            title={t('people.got')}
            variant="secondary"
            leftIcon="arrow-down-left"
            onPress={() => {
              hapticSelection();
              setDueSheetState({ mode: 'add', action: 'got' });
            }}
            style={styles.flex1}
          />
        </View>
      </Surface>

      {/* Remind Card (PLAN §8.4 + mockup screen 7) */}
      {netMinor !== 0 ? (
        <Surface testID="person-remind-card" style={{ gap: theme.spacing.md }}>
          <View style={[styles.sectionHeader, { gap: theme.spacing.sm }]}>
            <AppText variant="headline" style={styles.flex1}>
              {t('people.remindTitle', { name: person.name })}
            </AppText>
            <SegmentedControl<ReminderLanguage>
              testID="person-remind-lang-toggle"
              size="sm"
              value={remindLang}
              onChange={(nextLang) => {
                setRemindLang(nextLang);
                setEditedMsgState(null);
              }}
              options={[
                { value: 'en', label: t('people.remindLangEn') },
                { value: 'bn', label: t('people.remindLangBn') },
              ]}
            />
          </View>

          {/* Honorific selector pills */}
          <View style={[styles.honorificRow, { gap: theme.spacing.xs }]}>
            {(
              [
                { key: 'none', labelKey: 'people.honorificNone' },
                { key: 'bhai', labelKey: 'people.honorificBhai' },
                { key: 'apu', labelKey: 'people.honorificApu' },
              ] as const
            ).map((opt) => {
              const active = person.honorific === opt.key;
              return (
                <PressableScale pressScale={0.98}
                  key={opt.key}
                  testID={`person-honorific-pill-${opt.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void handleHonorificChange(opt.key);
                  }}
                  style={[
                    styles.honorificChip,
                    {
                      backgroundColor: active
                        ? theme.colors.accentSoft
                        : theme.colors.surfaceSunken,
                      borderColor: active ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <AppText variant="caption" color={active ? 'accent' : 'textSecondary'} numberOfLines={1}>
                    {t(opt.labelKey)}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>

          {/* Editable message speech bubble */}
          <View
            style={[
              styles.speechBubble,
              {
                backgroundColor: theme.colors.surfaceSunken,
                borderLeftColor: theme.colors.accent,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <TextInput
              testID="person-remind-message-input"
              multiline
              value={displayedMessage}
              onChangeText={(txt) =>
                setEditedMsgState({ base: generatedMessage, value: txt })
              }
              placeholder={t('people.remindPlaceholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.speechInput,
                {
                  color: theme.colors.text,
                  fontFamily: useBanglaInputFont
                    ? mapFontToBangla(theme.typography.body.fontFamily)
                    : theme.typography.body.fontFamily,
                  fontSize: theme.typography.body.fontSize,
                  lineHeight: theme.typography.body.lineHeight,
                  letterSpacing: useBanglaInputFont ? 0 : undefined,
                },
              ]}
            />
          </View>

          {/* WhatsApp | Messenger | Copy actions */}
          <View style={[styles.shareRow, { gap: 6 }]}>
            <Button
              testID="person-remind-whatsapp-btn"
              title={t('people.remindWhatsapp')}
              variant="secondary"
              size="sm"
              numberOfLines={1}
              leftIcon="message-circle"
              onPress={() => {
                void handleWhatsapp();
              }}
              style={styles.shareBtn}
            />
            <Button
              testID="person-remind-messenger-btn"
              title={t('people.remindMessenger')}
              variant="secondary"
              size="sm"
              numberOfLines={1}
              leftIcon="send"
              onPress={() => {
                void handleMessenger();
              }}
              style={styles.shareBtn}
            />
            <Button
              testID="person-remind-copy-btn"
              title={t('people.remindCopy')}
              variant="secondary"
              size="sm"
              numberOfLines={1}
              leftIcon="copy"
              onPress={() => {
                void handleCopy();
              }}
              style={styles.shareBtn}
            />
          </View>
        </Surface>
      ) : null}

      {/* Entries Timeline */}
      <View style={{ gap: theme.spacing.sm }}>
        <View style={[styles.sectionHeader, { gap: theme.spacing.sm }]}>
          <AppText variant="headline" style={styles.flex1}>
            {t('people.entriesTitle')}
          </AppText>
          <PressableScale pressScale={0.98}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setDueSheetState({ mode: 'add', action: 'gave' })}
          >
            <AppText
              variant="label"
              color="accent"
              numberOfLines={1}
              style={bnMinWidth(recordAnotherLabel, 13)}
            >
              {recordAnotherLabel}
            </AppText>
          </PressableScale>
        </View>

        {personEntries.length === 0 ? (
          <Surface>
            <EmptyState
              icon="scroll-text"
              title={t('people.entriesTitle')}
              body={t('people.entriesEmpty', { name: person.name })}
              ctaLabel={t('people.recordAnotherCta')}
              onCtaPress={() => setDueSheetState({ mode: 'add', action: 'gave' })}
            />
          </Surface>
        ) : (
          <Surface testID="person-entries-list" padded={false}>
            {personEntries.map((entry, idx) => {
              const incoming = isIncomingDueKind(entry.kind);
              const wallet = entry.accountId
                ? accountsById.get(entry.accountId) ?? null
                : null;
              const dateLabel = formatFriendlyDate(entry.occurredOn, today, locale);
              const timeLabel = entry.occurredTime
                ? formatFriendlyTime(entry.occurredTime, use24Hour)
                : null;
              const subParts = [dateLabel];
              if (timeLabel) subParts.push(timeLabel);
              if (wallet) subParts.push(wallet.name);
              if (entry.note.trim()) subParts.push(entry.note.trim());

              return (
                <ListRow
                  key={entry.id}
                  testID={`person-entry-${entry.id}`}
                  title={getDueKindLabel(entry.kind)}
                  subtitle={subParts.join(' · ')}
                  left={
                    <IconTile
                      icon={incoming ? 'arrow-down-left' : 'arrow-up-right'}
                      colorKey={incoming ? 'teal' : 'orange'}
                      size="sm"
                    />
                  }
                  right={
                    <Money
                      variant="bodyStrong"
                      amountMinor={entry.amountMinor}
                      prefix={incoming ? '+' : '−'}
                      currency={currency}
                      color={incoming ? 'accent' : 'text'}
                    />
                  }
                  showDivider={idx < personEntries.length - 1}
                  onPress={() => setDueSheetState({ mode: 'edit', entry })}
                />
              );
            })}
          </Surface>
        )}
      </View>

      {/* Due Entry Add / Settle / Edit Sheet */}
      <DueEntrySheet
        visible={dueSheetState.mode !== 'closed'}
        onClose={() => setDueSheetState({ mode: 'closed' })}
        initialPersonId={person.id}
        initialKind={
          dueSheetState.mode === 'settle'
            ? settlePreset.kind
            : dueSheetState.mode === 'add'
              ? dueKindForAction(dueSheetState.action, netMinor)
              : 'lent'
        }
        initialAmountMinor={
          dueSheetState.mode === 'settle'
            ? settlePreset.amountMinor
            : null
        }
        editingEntry={dueSheetState.mode === 'edit' ? dueSheetState.entry : null}
        titleOverride={
          dueSheetState.mode === 'settle' ? t('due.sheetTitleSettle') : undefined
        }
      />

      {/* Person Edit Sheet */}
      <PersonEditorSheet
        visible={editPersonOpen}
        onClose={() => setEditPersonOpen(false)}
        person={person}
        existingCount={allPeople.length}
      />

      {/* Options Sheet */}
      <Sheet
        testID="person-options-sheet"
        visible={optionsOpen}
        onClose={() => {
          setConfirmArchive(false);
          setOptionsOpen(false);
        }}
        title={t('people.moreActions')}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            testID="person-edit-action-btn"
            title={t('people.editPersonTitle')}
            variant="secondary"
            leftIcon="pencil"
            onPress={() => {
              setConfirmArchive(false);
              setOptionsOpen(false);
              setEditPersonOpen(true);
            }}
          />
          {person.archivedAt == null ? (
            confirmArchive ? (
              <View
                testID="person-archive-confirm-box"
                style={[
                  styles.confirmBox,
                  {
                    backgroundColor: theme.colors.dangerSoft,
                    borderRadius: theme.radius.card,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                  },
                ]}
              >
                <AppText variant="bodyStrong" color="danger">
                  {t('people.archiveConfirmTitle', { name: person.name })}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('people.archiveConfirmBody', { name: person.name })}
                </AppText>
                <View style={[styles.confirmActions, { gap: theme.spacing.sm }]}>
                  <Button
                    testID="person-archive-cancel-btn"
                    title={t('common.cancel')}
                    variant="secondary"
                    size="sm"
                    onPress={() => setConfirmArchive(false)}
                    style={styles.confirmBtn}
                  />
                  <Button
                    testID="person-archive-confirm-btn"
                    title={t('people.archiveButton')}
                    variant="danger"
                    size="sm"
                    onPress={() => {
                      void handleToggleArchive();
                    }}
                    style={styles.confirmBtn}
                  />
                </View>
              </View>
            ) : (
              <Button
                testID="person-archive-action-btn"
                title={t('people.archiveButton')}
                variant="dangerSoft"
                leftIcon="archive"
                onPress={() => setConfirmArchive(true)}
              />
            )
          ) : (
            <Button
              testID="person-archive-action-btn"
              title={t('people.restoreButton')}
              variant="secondary"
              leftIcon="archive-restore"
              onPress={() => {
                void handleToggleArchive();
              }}
            />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex1: {
    flex: 1,
    minWidth: 0,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  honorificBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  honorificRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  honorificChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  speechBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
  },
  speechInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  shareBtn: {
    flexGrow: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  confirmBox: {
    borderWidth: 0,
  },
  confirmActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  confirmBtn: {
    flexGrow: 1,
  },
});
