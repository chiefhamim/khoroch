import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PERSON_AVATAR_COLOR_KEYS, pickPersonColorKey } from '@/domain/dues';
import type { CategoryColorKey, Person, PersonHonorific } from '@/domain/types';
import { MAX_PERSON_NAME_LENGTH } from '@/domain/validation';
import { t, useLocale } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion } from '@/state/dataVersion';
import { CATEGORY_COLORS } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Field } from './Field';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { hapticSelection, hapticSuccess } from './haptics';
import { PressableScale } from '@/ui/PressableScale';

export interface PersonEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  person?: Person | null;
  existingCount?: number;
  onSaved?: (personId: string) => void;
}

interface PersonEditorBodyProps {
  person?: Person | null;
  existingCount: number;
  onClose: () => void;
  onSaved?: (personId: string) => void;
}

function PersonEditorBody({
  person,
  existingCount,
  onClose,
  onSaved,
}: PersonEditorBodyProps) {
  useLocale();
  const { repo } = useAppContext();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState(person?.name ?? '');
  const [colorKey, setColorKey] = useState<CategoryColorKey>(
    person?.colorKey ?? pickPersonColorKey(existingCount)
  );
  const [honorific, setHonorific] = useState<PersonHonorific>(person?.honorific ?? 'none');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg(t('people.errorNameRequired'));
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      let savedId: string;
      if (person) {
        await repo.updatePerson(person.id, {
          name: trimmed,
          colorKey,
          honorific,
        });
        savedId = person.id;
      } else {
        savedId = `person_${Crypto.randomUUID().slice(0, 12)}`;
        await repo.insertPerson({
          id: savedId,
          name: trimmed,
          colorKey,
          honorific,
        });
      }
      hapticSuccess();
      bumpDataVersion();
      showToast({
        message: t('people.savedToast'),
        icon: 'circle-check',
        tone: 'accent',
      });
      onSaved?.(savedId);
      onClose();
    } catch {
      setErrorMsg(t('tx.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Field
        testID="person-editor-name-input"
        label={t('people.nameLabel')}
        placeholder={t('people.namePlaceholder')}
        value={name}
        error={errorMsg}
        errorTestID="person-editor-error"
        onChangeText={(txt) => {
          setName(txt);
          setErrorMsg(null);
        }}
        maxLength={MAX_PERSON_NAME_LENGTH}
        autoFocus={!person}
      />

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textSecondary">
          {t('people.colorLabel')}
        </AppText>
        <View style={[styles.swatchRow, { gap: theme.spacing.sm }]}>
          {PERSON_AVATAR_COLOR_KEYS.map((key) => {
            const swatch = CATEGORY_COLORS[key];
            const selected = colorKey === key;
            return (
              <PressableScale pressScale={0.98}
                key={key}
                testID={`person-color-${key}`}
                accessibilityRole="button"
                accessibilityLabel={key}
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  setColorKey(key);
                }}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: theme.scheme === 'dark' ? swatch.dark : swatch.light,
                    borderColor: selected ? theme.colors.text : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label" color="textSecondary">
          {t('people.honorificLabel')}
        </AppText>
        <SegmentedControl<PersonHonorific>
          testID="person-honorific-toggle"
          size="md"
          value={honorific}
          onChange={setHonorific}
          options={[
            { value: 'none', label: t('people.honorificNone') },
            { value: 'bhai', label: t('people.honorificBhai') },
            { value: 'apu', label: t('people.honorificApu') },
          ]}
        />
      </View>

      <View style={[styles.actionsRow, { gap: theme.spacing.sm }]}>
        <Button
          testID="person-editor-cancel-btn"
          title={t('common.cancel')}
          variant="secondary"
          onPress={onClose}
          style={styles.flex1}
        />
        <Button
          testID="person-editor-save-btn"
          title={t('common.save')}
          variant="primary"
          loading={saving}
          disabled={saving}
          onPress={() => {
            void handleSave();
          }}
          style={styles.flex1}
        />
      </View>
    </View>
  );
}

export function PersonEditorSheet({
  visible,
  onClose,
  person,
  existingCount = 0,
  onSaved,
}: PersonEditorSheetProps) {
  useLocale();
  return (
    <Sheet
      testID="person-editor-sheet"
      visible={visible}
      onClose={onClose}
      title={person ? t('people.editPersonTitle') : t('people.newPersonTitle')}
    >
      {visible ? (
        <PersonEditorBody
          key={person?.id ?? 'new-person'}
          person={person}
          existingCount={existingCount}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
});
