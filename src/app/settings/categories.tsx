import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Category, TransactionType } from '@/domain/types';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryIcon, resolveIoniconName } from '@/ui/CategoryIcon';
import { ConfirmModal } from '@/ui/ConfirmModal';
import { ErrorState } from '@/ui/ErrorState';
import { ListRow } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';

const ICON_OPTIONS = [
  'restaurant',
  'cart',
  'car',
  'bag-handle',
  'home',
  'flash',
  'medkit',
  'film',
  'school',
  'airplane',
  'repeat',
  'sparkles',
  'people',
  'gift',
  'cafe',
  'pizza',
  'bicycle',
  'bus',
  'book',
  'fitness',
  'shirt',
  'game-controller',
  'cash',
  'briefcase',
  'wallet',
  'ellipsis-horizontal',
] as const;

const PROTECTED_CATEGORY_IDS = new Set(['other', 'other_income']);

export default function CategoriesScreen() {
  const { repo } = useAppContext();
  const { theme } = useTheme();
  const router = useRouter();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [kind, setKind] = useState<TransactionType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [iconInput, setIconInput] = useState<string>('restaurant');
  const [isSelectedInput, setIsSelectedInput] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Archive confirm state
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);

  useEffect(() => {
    let active = true;
    repo
      .listCategories({ includeArchived: true })
      .then((list) => {
        if (!active) return;
        setLoadError(false);
        setCategories(list);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [repo, dataVersion, reloadTick]);

  const filtered = useMemo(() => {
    return categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => {
        const aArch = a.archivedAt !== null ? 1 : 0;
        const bArch = b.archivedAt !== null ? 1 : 0;
        if (aArch !== bArch) return aArch - bArch;
        return a.sortOrder - b.sortOrder;
      });
  }, [categories, kind]);

  const openAdd = () => {
    setEditingCat(null);
    setNameInput('');
    setIconInput(kind === 'expense' ? 'pricetag' : 'cash');
    setIsSelectedInput(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setNameInput(cat.name);
    setIconInput(cat.icon);
    setIsSelectedInput(cat.isSelected);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (saving) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setFormError(t('categories.errorNameRequired'));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const nextSortOrder =
        editingCat?.sortOrder ??
        categories.reduce((max, c) => (c.kind === kind && c.sortOrder > max ? c.sortOrder : max), 0) +
          1;
      await repo.upsertCategory({
        id: editingCat?.id ?? `custom_${Crypto.randomUUID().slice(0, 8)}`,
        name: trimmed,
        icon: iconInput,
        colorKey: editingCat?.colorKey ?? 'gray',
        kind: editingCat?.kind ?? kind,
        sortOrder: nextSortOrder,
        isSelected: isSelectedInput,
        archivedAt: editingCat?.archivedAt ?? null,
        createdAt: editingCat?.createdAt ?? Date.now(),
      });
      setModalOpen(false);
      bumpDataVersion();
    } catch {
      setFormError(t('categories.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget || saving) return;
    setSaving(true);
    try {
      await repo.archiveCategory(archiveTarget.id);
      setArchiveTarget(null);
      setModalOpen(false);
      bumpDataVersion();
    } catch {
      setArchiveTarget(null);
      setFormError(t('categories.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { minHeight: theme.touch.min, marginBottom: theme.spacing.md }]}>
        <Pressable
          testID="categories-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={[
            styles.iconBtn,
            {
              width: theme.touch.min,
              height: theme.touch.min,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.headerTitle}>
          {t('categories.title')}
        </AppText>
        <Button
          testID="categories-add-button"
          title={t('common.add')}
          variant="secondary"
          onPress={openAdd}
          style={{ minWidth: theme.touch.min + theme.spacing.xxl }}
        />
      </View>

      <View style={{ marginBottom: theme.spacing.md }}>
        <SegmentedControl<TransactionType>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: t('common.expense') },
            { value: 'income', label: t('common.income') },
          ]}
        />
      </View>

      {loadError ? (
        <ErrorState
          title={t('error.genericTitle')}
          body={t('categories.loadError')}
          retryLabel={t('common.retry')}
          onRetry={() => setReloadTick((v) => v + 1)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
          <Card style={{ paddingVertical: theme.spacing.xs }}>
            {filtered.map((cat, idx) => (
              <View key={cat.id}>
                {idx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                <ListRow
                  testID={`cat-row-${cat.id}`}
                  title={cat.name}
                  subtitle={
                    cat.archivedAt !== null
                      ? t('categories.archivedBadge')
                      : cat.isSelected
                        ? t('categories.quickChipToggle')
                        : undefined
                  }
                  left={
                    <CategoryIcon
                      icon={cat.icon}
                      tone={cat.archivedAt ? 'neutral' : cat.kind === 'income' ? 'income' : 'primary'}
                    />
                  }
                  showChevron
                  onPress={() => openEdit(cat)}
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      )}

      {modalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setModalOpen(false)}
        >
          <View style={[styles.backdrop, { padding: theme.spacing.xl }]}>
            <Card style={[styles.dialog, { gap: theme.spacing.md }]}>
              <AppText variant="title">
                {editingCat ? t('categories.editTitle') : t('categories.newTitle')}
              </AppText>

              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="textMuted">
                  {t('categories.nameLabel')}
                </AppText>
                <TextInput
                  testID="category-name-input"
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={t('categories.namePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={40}
                  style={[
                    styles.input,
                    {
                      minHeight: theme.touch.min,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: theme.radius.md,
                      paddingHorizontal: theme.spacing.md,
                      color: theme.colors.text,
                      fontFamily: theme.typography.body.fontFamily,
                      fontSize: theme.typography.body.fontSize,
                    },
                  ]}
                />
              </View>

              <View style={{ gap: theme.spacing.xs }}>
                <AppText variant="label" color="textMuted">
                  {t('categories.iconLabel')}
                </AppText>
                <View style={[styles.iconGrid, { gap: theme.spacing.sm }]}>
                  {ICON_OPTIONS.map((ic) => {
                    const active = iconInput === ic;
                    return (
                      <Pressable
                        key={ic}
                        accessibilityRole="button"
                        accessibilityLabel={`Icon ${ic}`}
                        onPress={() => setIconInput(ic)}
                        style={[
                          styles.iconChoice,
                          {
                            width: theme.touch.min,
                            height: theme.touch.min,
                            borderRadius: theme.radius.md,
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                            backgroundColor: active
                              ? theme.colors.primarySoft
                              : theme.colors.surfaceAlt,
                          },
                        ]}
                      >
                        <Ionicons
                          name={resolveIoniconName(ic)}
                          size={20}
                          color={active ? theme.colors.primary : theme.colors.text}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.toggleRow, { minHeight: theme.touch.min }]}>
                <AppText variant="body">{t('categories.quickChipToggle')}</AppText>
                <Switch
                  value={isSelectedInput}
                  onValueChange={setIsSelectedInput}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                />
              </View>

              {formError ? (
                <AppText variant="caption" color="danger">
                  {formError}
                </AppText>
              ) : null}

              <View style={[styles.modalActions, { gap: theme.spacing.sm }]}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  disabled={saving}
                  onPress={() => setModalOpen(false)}
                  style={styles.modalBtn}
                />
                <Button
                  testID="category-save-button"
                  title={t('common.save')}
                  loading={saving}
                  disabled={saving}
                  onPress={() => void handleSaveCategory()}
                  style={styles.modalBtn}
                />
              </View>

              {editingCat &&
              editingCat.archivedAt === null &&
              !PROTECTED_CATEGORY_IDS.has(editingCat.id) ? (
                <Button
                  testID="category-archive-button"
                  title={t('categories.archiveButton')}
                  variant="danger"
                  onPress={() => setArchiveTarget(editingCat)}
                />
              ) : null}
            </Card>
          </View>
        </Modal>
      ) : null}

      <ConfirmModal
        visible={archiveTarget !== null}
        title={t('categories.archiveConfirmTitle', { name: archiveTarget?.name ?? '' })}
        body={t('categories.archiveConfirmBody')}
        confirmLabel={t('categories.archiveButton')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={saving}
        onConfirm={() => void handleConfirmArchive()}
        onCancel={() => {
          if (!saving) setArchiveTarget(null);
        }}
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
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
  },
  input: {
    borderWidth: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconChoice: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalBtn: {
    flex: 1,
  },
});
