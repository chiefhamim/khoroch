import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  CATEGORY_COLOR_KEYS,
  type Category,
  type CategoryColorKey,
  type TransactionType,
} from '@/domain/types';
import { MAX_CATEGORY_NAME_LENGTH } from '@/domain/validation';
import { t } from '@/i18n';
import { useAppContext } from '@/state/AppContext';
import { bumpDataVersion, useDataVersionStore } from '@/state/dataVersion';
import { CATEGORY_COLORS } from '@/theme/categoryColors';
import { useTheme } from '@/theme/useTheme';
import { AppIcon, CATEGORY_ICON_CHOICES } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Field } from '@/ui/Field';
import { hapticLight, hapticSelection, hapticSuccess } from '@/ui/haptics';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { Screen } from '@/ui/Screen';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { useToast } from '@/ui/Toast';

const PROTECTED_CATEGORY_IDS = new Set(['other', 'other_income', 'fees']);

export default function CategoriesScreen() {
  const { repo } = useAppContext();
  const { theme, reducedMotion } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [kind, setKind] = useState<TransactionType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Add/Edit sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [colorKeyInput, setColorKeyInput] = useState<CategoryColorKey>('orange');
  const [iconInput, setIconInput] = useState<string>('utensils');
  const [isSelectedInput, setIsSelectedInput] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

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

  const { activeList, archivedList } = useMemo(() => {
    const byKind = categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return {
      activeList: byKind.filter((c) => c.archivedAt === null),
      archivedList: byKind.filter((c) => c.archivedAt !== null),
    };
  }, [categories, kind]);

  const openAdd = () => {
    hapticLight();
    setEditingCat(null);
    setNameInput('');
    setColorKeyInput(kind === 'expense' ? 'orange' : 'teal');
    setIconInput(kind === 'expense' ? 'tag' : 'banknote');
    setIsSelectedInput(true);
    setFormError(null);
    setConfirmArchive(false);
    setSheetOpen(true);
  };

  const openEdit = (cat: Category) => {
    hapticLight();
    setEditingCat(cat);
    setNameInput(cat.name);
    setColorKeyInput(cat.colorKey);
    setIconInput(cat.icon);
    setIsSelectedInput(cat.isSelected);
    setFormError(null);
    setConfirmArchive(false);
    setSheetOpen(true);
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
        categories.reduce(
          (max, c) => (c.kind === kind && c.sortOrder > max ? c.sortOrder : max),
          0
        ) + 1;
      await repo.upsertCategory({
        id: editingCat?.id ?? `custom_${Crypto.randomUUID().slice(0, 8)}`,
        name: trimmed,
        icon: iconInput,
        colorKey: colorKeyInput,
        kind: editingCat?.kind ?? kind,
        sortOrder: nextSortOrder,
        isSelected: isSelectedInput,
        archivedAt: editingCat?.archivedAt ?? null,
        createdAt: editingCat?.createdAt ?? Date.now(),
      });
      hapticSuccess();
      setSheetOpen(false);
      bumpDataVersion();
      showToast({ message: t('tx.savedToast'), icon: 'circle-check', tone: 'accent' });
    } catch {
      setFormError(t('categories.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveOrRestore = async () => {
    if (!editingCat || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingCat.archivedAt === null) {
        await repo.archiveCategory(editingCat.id);
      } else {
        await repo.upsertCategory({
          ...editingCat,
          archivedAt: null,
        });
      }
      hapticSuccess();
      setConfirmArchive(false);
      setSheetOpen(false);
      bumpDataVersion();
    } catch {
      setFormError(t('categories.errorSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const canArchive =
    editingCat !== null &&
    editingCat.archivedAt === null &&
    !PROTECTED_CATEGORY_IDS.has(editingCat.id);
  const canRestore = editingCat !== null && editingCat.archivedAt !== null;

  const renderTileCard = (cat: Category, dimmed: boolean) => (
    <Pressable
      key={cat.id}
      testID={`cat-tile-${cat.id}`}
      accessibilityRole="button"
      accessibilityLabel={cat.name}
      onPress={() => openEdit(cat)}
      style={({ pressed }) => [
        styles.gridItem,
        {
          padding: theme.spacing.xs,
          opacity: dimmed ? 0.55 : pressed && !reducedMotion ? 0.78 : 1,
        },
      ]}
    >
      <Surface
        padding={0}
        style={[
          styles.tileSurface,
          {
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <IconTile icon={cat.icon} colorKey={cat.colorKey} size="lg" />
        <AppText
          variant="caption"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={styles.tileLabel}
        >
          {cat.name}
        </AppText>
      </Surface>
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      {/* Top header */}
      <View style={[styles.header, { gap: theme.spacing.md, marginBottom: theme.spacing.md }]}>
        <IconButton
          testID="categories-back"
          icon="arrow-left"
          variant="surface"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
        />
        <AppText variant="title" style={styles.headerTitle}>
          {t('categories.title')}
        </AppText>
        <IconButton
          testID="categories-add-button"
          icon="plus"
          variant="surface"
          accessibilityLabel={t('categories.newTitle')}
          onPress={openAdd}
        />
      </View>

      <View style={{ marginBottom: theme.spacing.lg }}>
        <SegmentedControl<TransactionType>
          testID="categories-kind-segmented"
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
        >
          <View style={[styles.tileGrid, { marginHorizontal: -theme.spacing.xs }]}>
            {activeList.map((cat) => renderTileCard(cat, false))}
          </View>

          {archivedList.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" color="textSecondary" style={styles.sectionCap}>
                {t('categories.archivedBadge').toUpperCase()}
              </AppText>
              <View style={[styles.tileGrid, { marginHorizontal: -theme.spacing.xs }]}>
                {archivedList.map((cat) => renderTileCard(cat, true))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Edit / Add Category Sheet */}
      <Sheet
        testID="category-edit-sheet"
        visible={sheetOpen}
        onClose={() => {
          if (!saving) setSheetOpen(false);
        }}
        title={editingCat ? t('categories.editTitle') : t('categories.newTitle')}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              testID="category-save-button"
              title={t('common.save')}
              loading={saving}
              disabled={saving}
              onPress={() => void handleSaveCategory()}
            />
            {canArchive && !confirmArchive ? (
              <Button
                testID="category-archive-button"
                title={t('categories.archiveButton')}
                variant="ghost"
                disabled={saving}
                onPress={() => setConfirmArchive(true)}
              />
            ) : null}
            {canArchive && confirmArchive ? (
              <Surface variant="dangerSoft" style={{ gap: theme.spacing.sm }}>
                <AppText variant="label" color="danger">
                  {t('categories.archiveConfirmTitle', { name: editingCat?.name ?? '' })}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('categories.archiveConfirmBody')}
                </AppText>
                <View style={[styles.confirmRow, { gap: theme.spacing.sm }]}>
                  <Button
                    title={t('common.cancel')}
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onPress={() => setConfirmArchive(false)}
                    style={styles.flexOne}
                  />
                  <Button
                    testID="category-archive-confirm-btn"
                    title={t('categories.archiveButton')}
                    variant="danger"
                    size="sm"
                    loading={saving}
                    disabled={saving}
                    onPress={() => void handleArchiveOrRestore()}
                    style={styles.flexOne}
                  />
                </View>
              </Surface>
            ) : null}
            {canRestore ? (
              <Button
                testID="category-restore-button"
                title={t('categories.restoreButton')}
                variant="secondary"
                loading={saving}
                disabled={saving}
                onPress={() => void handleArchiveOrRestore()}
              />
            ) : null}
          </View>
        }
      >
        {/* Live preview */}
        <View style={styles.previewWrap}>
          <IconTile icon={iconInput} colorKey={colorKeyInput} size="lg" />
          <AppText variant="headline" numberOfLines={1}>
            {nameInput.trim() || t('categories.namePlaceholder')}
          </AppText>
        </View>

        <Field
          testID="category-name-input"
          label={t('categories.nameLabel')}
          value={nameInput}
          onChangeText={(txt) => {
            setNameInput(txt);
            if (formError) setFormError(null);
          }}
          placeholder={t('categories.namePlaceholder')}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          error={formError}
        />

        {/* 13 Colour swatches */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('categories.colorLabel')}
          </AppText>
          <View style={[styles.swatchGrid, { gap: theme.spacing.sm }]}>
            {CATEGORY_COLOR_KEYS.map((key) => {
              const spec = CATEGORY_COLORS[key];
              const hex = theme.scheme === 'dark' ? spec.dark : spec.light;
              const selected = colorKeyInput === key;
              return (
                <Pressable
                  key={key}
                  testID={`cat-color-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={spec.label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    hapticSelection();
                    setColorKeyInput(key);
                  }}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: hex,
                      borderColor: selected ? theme.colors.text : 'transparent',
                    },
                  ]}
                >
                  {selected ? (
                    <AppIcon
                      name="check"
                      size={16}
                      color={theme.scheme === 'dark' ? '#0A0A0C' : '#FFFFFF'}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lucide icon grid */}
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textSecondary">
            {t('categories.iconLabel')}
          </AppText>
          <View style={[styles.iconGrid, { gap: theme.spacing.xs }]}>
            {CATEGORY_ICON_CHOICES.map((ic) => {
              const active = iconInput === ic;
              return (
                <Pressable
                  key={ic}
                  testID={`cat-icon-${ic}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Icon ${ic}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticSelection();
                    setIconInput(ic);
                  }}
                  style={[
                    styles.iconChoice,
                    {
                      borderRadius: theme.radius.iconTile,
                      borderColor: active ? theme.colors.accent : 'transparent',
                      backgroundColor: active
                        ? theme.colors.accentSoft
                        : theme.colors.surfaceSunken,
                    },
                  ]}
                >
                  <AppIcon
                    name={ic}
                    size={20}
                    color={active ? theme.colors.accent : theme.colors.text}
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
            trackColor={{ false: theme.colors.surfaceSunken, true: theme.colors.accent }}
            thumbColor="#ffffff"
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.3333%',
  },
  tileSurface: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  tileLabel: {
    textAlign: 'center',
  },
  sectionCap: {
    letterSpacing: 0.7,
    fontWeight: '600',
  },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmRow: {
    flexDirection: 'row',
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
});
