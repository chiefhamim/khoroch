import * as Crypto from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  currentLocalTime,
  formatFriendlyDate,
  isValidLocalDate,
  todayLocalDate,
} from '@/domain/dates';
import {
  checkDueOverpayment,
  pickPersonColorKey,
  signedDeltaForDueKind,
} from '@/domain/dues';
import {
  formatMinorToDraft,
  getCurrencySymbol,
  parseMoneyInput,
} from '@/domain/money';
import type { DueEntry, DueKind, LocalDate } from '@/domain/types';
import { MAX_NOTE_LENGTH, MAX_PERSON_NAME_LENGTH, isValidLocalTime } from '@/domain/validation';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { useAccounts } from '@/state/useAccounts';
import { usePeople } from '@/state/usePeople';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from './AppIcon';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { DateField } from './DateField';
import { DateTimeSheet } from './DateTimeSheet';
import { Field } from './Field';
import { PersonAvatar } from './PersonAvatar';
import { Sheet } from './Sheet';
import { Surface } from './Surface';
import { TimeField } from './TimeField';
import { useToast } from './Toast';
import { WalletAvatar } from './WalletAvatar';
import { WalletPickerSheet } from './WalletPickerSheet';
import { hapticSelection, hapticSuccess } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

export interface DueEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  initialPersonId?: string | null;
  initialKind?: DueKind;
  initialAmountMinor?: number | null;
  initialAccountId?: string | null;
  initialOccurredOn?: LocalDate;
  editingEntry?: DueEntry | null;
  titleOverride?: string;
  onSaved?: (savedPersonId: string) => void;
}

const DUE_KIND_OPTIONS: readonly { kind: DueKind; labelKey: Parameters<typeof t>[0] }[] = [
  { kind: 'lent', labelKey: 'people.kindLent' },
  { kind: 'received_back', labelKey: 'people.kindReceivedBack' },
  { kind: 'borrowed', labelKey: 'people.kindBorrowed' },
  { kind: 'paid_back', labelKey: 'people.kindPaidBack' },
];

interface DueEntryBodyProps {
  initialPersonId?: string | null;
  initialKind: DueKind;
  initialAmountMinor?: number | null;
  initialAccountId?: string | null;
  initialOccurredOn?: LocalDate;
  editingEntry?: DueEntry | null;
  onClose: () => void;
  onSaved?: (savedPersonId: string) => void;
}

function DueEntryBody({
  initialPersonId,
  initialKind,
  initialAmountMinor,
  initialAccountId,
  initialOccurredOn,
  editingEntry,
  onClose,
  onSaved,
}: DueEntryBodyProps) {
  const { repo, settings } = useAppContext();
  const locale = useLocale();
  const { theme } = useTheme();
  const bnMinWidth = (text: string, fontSize: number) =>
    locale === 'bn' ? { minWidth: estimateSingleLineMinWidth(text, fontSize) } : null;
  const { showToast } = useToast();
  const { people, allPeople, dueEntries, overview } = usePeople();
  const { accounts, accountsById, overview: accountsOverview } = useAccounts();

  const currency = settings.currency;
  const currencySymbol = getCurrencySymbol(currency);

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => {
    if (editingEntry) return editingEntry.personId;
    if (initialPersonId) return initialPersonId;
    return null;
  });
  const [creatingNewPerson, setCreatingNewPerson] = useState<boolean>(() => {
    if (editingEntry || initialPersonId) return false;
    return true;
  });
  const [newPersonName, setNewPersonName] = useState('');
  const [kind, setKind] = useState<DueKind>(() => editingEntry?.kind ?? initialKind);
  const [amountText, setAmountText] = useState(() => {
    const minor = editingEntry?.amountMinor ?? initialAmountMinor ?? null;
    return minor && minor > 0 ? formatMinorToDraft(minor) : '';
  });
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (editingEntry) return editingEntry.accountId;
    return initialAccountId ?? null;
  });
  const [occurredOn, setOccurredOn] = useState<LocalDate>(
    () => editingEntry?.occurredOn ?? initialOccurredOn ?? todayLocalDate()
  );
  const [occurredTime, setOccurredTime] = useState<string>(
    () => editingEntry?.occurredTime ?? currentLocalTime()
  );
  const [note, setNote] = useState<string>(() => editingEntry?.note ?? '');
  const [dueOn, setDueOn] = useState<LocalDate | null>(() => editingEntry?.dueOn ?? null);
  const [dueCleared, setDueCleared] = useState(false);
  const [dueOnPickerOpen, setDueOnPickerOpen] = useState(false);

  // A due date cannot be earlier than the entry date: clear it and say so.
  const handleOccurredOnChange = (next: LocalDate) => {
    setOccurredOn(next);
    if (dueOn && dueOn < next) {
      setDueOn(null);
      setDueCleared(true);
    }
  };
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balancesById = useMemo(
    () => new Map(accountsOverview.balances.map((b) => [b.account.id, b.balanceMinor])),
    [accountsOverview.balances]
  );

  const activePerson = useMemo(() => {
    if (selectedPersonId) {
      return allPeople.find((p) => p.id === selectedPersonId) ?? null;
    }
    const cleanNew = newPersonName.trim().toLowerCase();
    if (creatingNewPerson && cleanNew) {
      return people.find((p) => p.name.trim().toLowerCase() === cleanNew) ?? null;
    }
    return null;
  }, [selectedPersonId, creatingNewPerson, newPersonName, allPeople, people]);

  const parsedMoney = useMemo(() => parseMoneyInput(amountText), [amountText]);
  const validAmountMinor =
    parsedMoney.ok && parsedMoney.minor !== null && parsedMoney.minor > 0
      ? parsedMoney.minor
      : null;

  const currentPersonNetExcludingEdit = useMemo(() => {
    if (!activePerson) return 0;
    const summary = overview.allActivePeople.find((p) => p.person.id === activePerson.id);
    let net = summary?.netMinor ?? 0;
    if (editingEntry && editingEntry.personId === activePerson.id && editingEntry.deletedAt == null) {
      net -= signedDeltaForDueKind(editingEntry.kind, editingEntry.amountMinor);
    } else if (!summary) {
      // Fallback if archived or loaded directly
      let direct = 0;
      for (const e of dueEntries) {
        if (e.deletedAt != null || e.personId !== activePerson.id) continue;
        if (editingEntry && e.id === editingEntry.id) continue;
        direct += signedDeltaForDueKind(e.kind, e.amountMinor);
      }
      net = direct;
    }
    return net;
  }, [activePerson, overview.allActivePeople, editingEntry, dueEntries]);

  const overpayment =
    validAmountMinor !== null && activePerson
      ? checkDueOverpayment({
          personName: activePerson.name,
          currentNetMinor: currentPersonNetExcludingEdit,
          entryKind: kind,
          amountMinor: validAmountMinor,
          currency,
          formatters: {
            fallbackPerson: t('due.overpaymentDefaultPerson'),
            moreThanOwes: (excess, name) =>
              t('due.overpaymentMoreThanOwes', { excess, name }),
            moreThanYouOwe: (excess, name) =>
              t('due.overpaymentMoreThanYouOwe', { excess, name }),
          },
        })
      : { isOverpayment: false, excessMinor: 0, warningText: null };

  const selectedAccount = accountId ? accountsById.get(accountId) ?? null : null;

  const handleSave = async () => {
    setErrorMsg(null);
    let resolvedPersonId = selectedPersonId;
    const cleanNewName = newPersonName.trim();

    if (!resolvedPersonId) {
      if (!cleanNewName) {
        setErrorMsg(t('due.errorSelectPerson'));
        return;
      }
      const existingMatch = people.find(
        (p) => p.name.trim().toLowerCase() === cleanNewName.toLowerCase()
      );
      if (existingMatch) {
        resolvedPersonId = existingMatch.id;
      }
    }

    if (validAmountMinor === null) {
      setErrorMsg(t('due.errorAmount'));
      return;
    }
    if (!isValidLocalDate(occurredOn)) {
      setErrorMsg(t('due.errorDate'));
      return;
    }
    const cleanTime = occurredTime.trim();
    if (cleanTime.length > 0 && !isValidLocalTime(cleanTime)) {
      setErrorMsg(t('due.errorDate'));
      return;
    }

    // A due date only belongs to money that is expected back (lent or borrowed).
    const savedDueOn = kind === 'lent' || kind === 'borrowed' ? dueOn : null;

    setSaving(true);
    try {
      if (!resolvedPersonId) {
        resolvedPersonId = `person_${Crypto.randomUUID().slice(0, 12)}`;
        await repo.insertPerson({
          id: resolvedPersonId,
          name: cleanNewName,
          colorKey: pickPersonColorKey(allPeople.length),
          honorific: 'none',
        });
      }

      if (editingEntry) {
        await repo.updateDueEntry(editingEntry.id, {
          personId: resolvedPersonId,
          kind,
          amountMinor: validAmountMinor,
          accountId,
          occurredOn,
          occurredTime: cleanTime || null,
          dueOn: savedDueOn,
          note: note.trim(),
        });
      } else {
        await repo.insertDueEntry({
          id: `due_${Crypto.randomUUID().slice(0, 12)}`,
          personId: resolvedPersonId,
          kind,
          amountMinor: validAmountMinor,
          accountId,
          occurredOn,
          occurredTime: cleanTime || null,
          dueOn: savedDueOn,
          note: note.trim(),
        });
      }

      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('due.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      onSaved?.(resolvedPersonId);
      onClose();
    } catch {
      setErrorMsg(t('tx.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry || saving) return;
    setSaving(true);
    try {
      await repo.softDeleteDueEntry(editingEntry.id);
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('due.deletedToast'),
        icon: 'trash-2',
        tone: 'default',
      });
      onSaved?.(editingEntry.personId);
      onClose();
    } catch {
      setErrorMsg(t('tx.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const lockPersonSelection = Boolean(initialPersonId && !editingEntry);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {/* Direction Pills */}
      <View style={[styles.kindGrid, { gap: theme.spacing.xs }]}>
        {DUE_KIND_OPTIONS.map((opt) => {
          const active = kind === opt.kind;
          return (
            <PressableScale pressScale={0.98}
              key={opt.kind}
              testID={`due-kind-${opt.kind}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelection();
                setKind(opt.kind);
              }}
              style={[
                styles.kindPill,
                {
                  backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceSunken,
                  borderColor: active ? theme.colors.accent : 'transparent',
                  borderRadius: theme.radius.chip,
                },
              ]}
            >
              <AppText
                variant="label"
                color={active ? 'accent' : 'textSecondary'}
                numberOfLines={1}
              >
                {t(opt.labelKey)}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      {/* Person Selector */}
      {!lockPersonSelection ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('due.personLabel')}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
          >
            <PressableScale pressScale={0.98}
              testID="due-person-new-chip"
              accessibilityRole="button"
              accessibilityState={{ selected: creatingNewPerson || (people.length === 0 && !selectedPersonId) }}
              onPress={() => {
                hapticSelection();
                setSelectedPersonId(null);
                setCreatingNewPerson(true);
                setErrorMsg(null);
              }}
              style={[
                styles.personChip,
                {
                  backgroundColor:
                    creatingNewPerson || (people.length === 0 && !selectedPersonId)
                      ? theme.colors.accentSoft
                      : theme.colors.surfaceSunken,
                  borderColor:
                    creatingNewPerson || (people.length === 0 && !selectedPersonId)
                      ? theme.colors.accent
                      : 'transparent',
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              <AppIcon
                name="plus"
                size={14}
                color={
                  creatingNewPerson || (people.length === 0 && !selectedPersonId)
                    ? theme.colors.accent
                    : theme.colors.textSecondary
                }
              />
              <AppText
                variant="label"
                color={
                  creatingNewPerson || (people.length === 0 && !selectedPersonId)
                    ? 'accent'
                    : 'text'
                }
                numberOfLines={1}
                style={bnMinWidth(t('due.newPersonCta'), 13)}
              >
                {t('due.newPersonCta')}
              </AppText>
            </PressableScale>

            {people.map((person) => {
              const selected = !creatingNewPerson && selectedPersonId === person.id;
              return (
                <PressableScale pressScale={0.98}
                  key={person.id}
                  testID={`due-person-chip-${person.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    hapticSelection();
                    setSelectedPersonId(person.id);
                    setCreatingNewPerson(false);
                    setErrorMsg(null);
                  }}
                  style={[
                    styles.personChip,
                    {
                      backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceSunken,
                      borderColor: selected ? theme.colors.accent : 'transparent',
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                >
                  <PersonAvatar name={person.name} colorKey={person.colorKey} size="xs" />
                  <AppText variant="label" color={selected ? 'accent' : 'text'} numberOfLines={1}>
                    {person.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </ScrollView>

          {creatingNewPerson || (people.length === 0 && !selectedPersonId) ? (
            <Field
              testID="due-new-person-input"
              placeholder={t('due.newPersonNamePlaceholder')}
              value={newPersonName}
              onChangeText={(txt) => {
                setNewPersonName(txt);
                setErrorMsg(null);
              }}
              maxLength={MAX_PERSON_NAME_LENGTH}
            />
          ) : null}
        </View>
      ) : null}

      {/* Amount Input */}
      <Field
        testID="due-amount-input"
        label={`${t('common.amount')} (${currencySymbol})`}
        placeholder="0"
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={(txt) => {
          setAmountText(txt);
          setErrorMsg(null);
        }}
      />

      {/* Gentle Overpayment Warning (never blocks save) */}
      {overpayment.isOverpayment && overpayment.warningText ? (
        <Banner
          testID="due-overpayment-warning"
          tone="neutral"
          icon="info"
          message={overpayment.warningText}
        />
      ) : null}

      {/* Optional Wallet + Date & Time */}
      <Surface variant="sunken" padded={false}>
        <PressableScale pressScale={0.98}
          testID="due-wallet-row"
          accessibilityRole="button"
          accessibilityLabel={t('due.walletLabel')}
          onPress={() => {
            hapticSelection();
            setWalletPickerOpen(true);
          }}
          style={({ pressed }) => [styles.flatRow, { opacity: pressed ? 0.72 : 1 }]}
        >
          <WalletAvatar account={selectedAccount} size="xs" />
          <AppText
            variant="label"
            color="textSecondary"
            numberOfLines={1}
            style={[styles.rowLabel, bnMinWidth(t('due.walletLabel'), 13)]}
          >
            {t('due.walletLabel')}
          </AppText>
          <AppText
            variant="bodyStrong"
            color={selectedAccount ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={[
              styles.rowValue,
              bnMinWidth(selectedAccount?.name ?? t('due.noWallet'), 15),
            ]}
          >
            {selectedAccount?.name ?? t('due.noWallet')}
          </AppText>
          <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
        </PressableScale>

        <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />

        <View style={styles.flatRow}>
          <AppIcon name="calendar" size={18} color={theme.colors.textTertiary} />
          <View style={styles.whenControlsRow}>
            <DateField
              testID="due-date-field"
              value={occurredOn}
              onChange={handleOccurredOnChange}
              maximumDate={new Date()}
            />
            <TimeField
              testID="due-time-field"
              value={occurredTime}
              onChange={setOccurredTime}
            />
          </View>
        </View>

        {kind === 'lent' || kind === 'borrowed' ? (
          <>
            <View style={[styles.rowDivider, { backgroundColor: theme.colors.separator }]} />
            <View style={styles.flatRow}>
              <AppIcon name="calendar-days" size={18} color={theme.colors.textTertiary} />
              <AppText variant="label" color="textSecondary" style={styles.dueLabel}>
                {t('due.dueDateLabel')}
              </AppText>
              <PressableScale
                pressScale={0.98}
                testID="due-duedate-btn"
                accessibilityRole="button"
                accessibilityLabel={
                  dueOn
                    ? `${t('due.dueDateLabel')}: ${formatFriendlyDate(dueOn, todayLocalDate(), locale)}`
                    : t('due.dueDateAdd')
                }
                onPress={() => {
                  hapticSelection();
                  setDueOnPickerOpen(true);
                }}
                style={[styles.dueValueBtn, { minHeight: theme.touch.min }]}
              >
                <AppText variant="bodyStrong" color={dueOn ? 'text' : 'accent'} style={styles.rowValue}>
                  {dueOn ? formatFriendlyDate(dueOn, todayLocalDate(), locale) : t('due.dueDateAdd')}
                </AppText>
              </PressableScale>
              {dueOn ? (
                <PressableScale
                  pressScale={0.92}
                  testID="due-duedate-remove-btn"
                  accessibilityRole="button"
                  accessibilityLabel={t('due.dueDateRemove')}
                  onPress={() => {
                    hapticSelection();
                    setDueOn(null);
                    setDueCleared(false);
                  }}
                  style={[
                    styles.dueRemoveBtn,
                    { width: theme.touch.min, height: theme.touch.min },
                  ]}
                >
                  <AppIcon name="x" size={18} color={theme.colors.textSecondary} />
                </PressableScale>
              ) : null}
            </View>
          </>
        ) : null}
      </Surface>

      {dueCleared && !dueOn && (kind === 'lent' || kind === 'borrowed') ? (
        <AppText testID="due-duedate-cleared-note" variant="caption" color="textSecondary">
          {t('due.dueDateCleared')}
        </AppText>
      ) : null}

      <DateTimeSheet
        visible={dueOnPickerOpen}
        mode="date"
        date={dueOn ?? undefined}
        title={t('due.dueDateSheetTitle')}
        minDate={occurredOn}
        onDateChange={(next) => {
          setDueOn(next);
          setDueCleared(false);
        }}
        onClose={() => setDueOnPickerOpen(false)}
      />

      {/* Optional Note */}
      <Field
        testID="due-note-input"
        label={t('due.noteLabel')}
        placeholder={t('due.notePlaceholder')}
        leftIcon="pencil"
        value={note}
        onChangeText={setNote}
        maxLength={MAX_NOTE_LENGTH}
      />

      {errorMsg ? (
        <AppText testID="due-form-error" variant="label" color="danger">
          {errorMsg}
        </AppText>
      ) : null}

      <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
        {editingEntry && !confirmDeleteOpen ? (
          <Button
            testID="due-delete-btn"
            title={t('common.delete')}
            variant="secondary"
            leftIcon="trash-2"
            onPress={() => setConfirmDeleteOpen(true)}
            style={styles.flex1}
          />
        ) : null}
        <Button
          testID="due-save-btn"
          title={t('due.saveCta')}
          variant="primary"
          loading={saving}
          disabled={saving}
          onPress={() => {
            void handleSave();
          }}
          style={styles.flex1}
        />
      </View>

      {confirmDeleteOpen ? (
        <Surface variant="sunken" style={{ gap: theme.spacing.sm }}>
          <AppText variant="bodyStrong">{t('due.deleteConfirmTitle')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('due.deleteConfirmBody')}
          </AppText>
          <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
            <Button
              title={t('common.cancel')}
              variant="secondary"
              size="sm"
              onPress={() => setConfirmDeleteOpen(false)}
              style={styles.flex1}
            />
            <Button
              testID="due-confirm-delete-btn"
              title={t('due.deleteCta')}
              variant="danger"
              size="sm"
              loading={saving}
              onPress={() => {
                void handleDelete();
              }}
              style={styles.flex1}
            />
          </View>
        </Surface>
      ) : null}

      <WalletPickerSheet
        visible={walletPickerOpen}
        onClose={() => setWalletPickerOpen(false)}
        title={t('tx.chooseWalletTitle')}
        accounts={accounts}
        selectedAccountId={accountId}
        allowNone
        balancesById={balancesById}
        currency={currency}
        onSelect={(chosenId) => setAccountId(chosenId)}
      />
    </View>
  );
}

export function DueEntrySheet({
  visible,
  onClose,
  initialPersonId,
  initialKind = 'lent',
  initialAmountMinor = null,
  initialAccountId = null,
  initialOccurredOn,
  editingEntry = null,
  titleOverride,
  onSaved,
}: DueEntrySheetProps) {
  useLocale();
  const title =
    titleOverride ??
    (editingEntry ? t('due.sheetTitleEdit') : t('due.sheetTitleNew'));

  return (
    <Sheet
      testID="due-entry-sheet"
      visible={visible}
      onClose={onClose}
      title={title}
    >
      {visible ? (
        <DueEntryBody
          key={`${editingEntry?.id ?? 'new'}-${initialPersonId ?? 'none'}-${initialKind}-${String(initialAmountMinor ?? '')}`}
          initialPersonId={initialPersonId}
          initialKind={initialKind}
          initialAmountMinor={initialAmountMinor}
          initialAccountId={initialAccountId}
          initialOccurredOn={initialOccurredOn}
          editingEntry={editingEntry}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kindPill: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowLabel: {
    minWidth: 96,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
  },
  dueLabel: {
    flexShrink: 1,
  },
  dueValueBtn: {
    flex: 1,
    justifyContent: 'center',
  },
  dueRemoveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  whenControlsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  flex1: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 110,
  },
});
