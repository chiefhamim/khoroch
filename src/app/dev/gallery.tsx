import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isDevVariant } from '@/config/appVariant';
import { DEFAULT_CATEGORIES } from '@/domain/categories';
import { todayLocalDate } from '@/domain/dates';
import { parseMoneyInput } from '@/domain/money';
import { ACCENT_THEMES, type AccentTheme, type ThemePreference } from '@/domain/types';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ACCENT_DEFINITIONS } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppIcon } from '@/ui/AppIcon';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { BudgetStatusBadge } from '@/ui/BudgetStatusBadge';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { DayOfMonthGrid } from '@/ui/DayOfMonthGrid';
import { DayToggles } from '@/ui/DayToggles';
import { EmptyState } from '@/ui/EmptyState';
import { Field } from '@/ui/Field';
import { HeroCard, HeroProgressBar } from '@/ui/HeroCard';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { Keypad } from '@/ui/Keypad';
import { ListRow } from '@/ui/ListRow';
import { Money } from '@/ui/Money';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProgressRing } from '@/ui/ProgressRing';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SettingsGroup } from '@/ui/SettingsGroup';
import { SettingsRow } from '@/ui/SettingsRow';
import { Sheet } from '@/ui/Sheet';
import { Surface } from '@/ui/Surface';
import { TimeField } from '@/ui/TimeField';
import { ToastProvider, ToastView, useToast } from '@/ui/Toast';
import { PressableScale } from '@/ui/PressableScale';

type GalleryMode = 'light' | 'dark' | 'black';

function GalleryBody({
  modePref,
  accentPref,
  onChangeMode,
  onChangeAccent,
}: {
  modePref: GalleryMode;
  accentPref: AccentTheme;
  onChangeMode: (next: GalleryMode) => void;
  onChangeAccent: (next: AccentTheme) => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [modePref, accentPref]);

  const [segment, setSegment] = useState<'day' | 'week' | 'month'>('day');
  const [chipSelected, setChipSelected] = useState('food');
  const [fieldText, setFieldText] = useState('Coffee & croissant');
  const [pickedDate, setPickedDate] = useState('2026-11-11');
  const [pickedToday, setPickedToday] = useState(todayLocalDate());
  const [pickedTime, setPickedTime] = useState('13:20');
  const [days, setDays] = useState<number[]>([2, 3, 4, 5]);
  const [cycleDay, setCycleDay] = useState(10);
  const [padDraft, setPadDraft] = useState('1250');
  const [switchVal, setSwitchVal] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const parsedPad = parseMoneyInput(padDraft);
  const padMinor = parsedPad.ok && parsedPad.minor !== null ? parsedPad.minor : 0;

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: theme.geometry.screenMargin,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl * 2,
          gap: theme.geometry.sectionGap,
        }}
      >
        <View style={styles.topHeader}>
          <IconButton
            testID="gallery-back"
            icon="arrow-left"
            variant="surface"
            accessibilityLabel="Back"
            onPress={() => router.back()}
          />
          <View style={styles.headerText}>
            <AppText variant="title" numberOfLines={1}>
              v1.2 Gallery
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              DEV · {ACCENT_DEFINITIONS[accentPref].label} · {theme.mode.toUpperCase()}
            </AppText>
          </View>
        </View>

        <SegmentedControl<GalleryMode>
          testID="gallery-theme-toggle"
          size="sm"
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'black', label: 'Black' },
          ]}
          value={modePref}
          onChange={onChangeMode}
        />

        {/* 5 Accent switchers */}
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            ACCENT PALETTE (5 THEMES)
          </AppText>
          <Surface style={{ gap: theme.spacing.sm }}>
            <View style={styles.accentRow}>
              {ACCENT_THEMES.map((accentId) => {
                const def = ACCENT_DEFINITIONS[accentId];
                const selected = accentPref === accentId;
                return (
                  <PressableScale pressScale={0.98}
                    key={accentId}
                    testID={`gallery-accent-${accentId}`}
                    accessibilityRole="button"
                    accessibilityLabel={def.label}
                    accessibilityState={{ selected }}
                    onPress={() => onChangeAccent(accentId)}
                    style={styles.accentBtn}
                  >
                    <View
                      style={[
                        styles.accentRing,
                        { borderColor: selected ? theme.colors.text : 'transparent' },
                      ]}
                    >
                      <View
                        style={[styles.accentCircle, { backgroundColor: def.swatchColor }]}
                      >
                        {selected ? <AppIcon name="check" size={14} color="#FFFFFF" /> : null}
                      </View>
                    </View>
                    <AppText
                      variant="caption"
                      color={selected ? 'text' : 'textSecondary'}
                      numberOfLines={1}
                    >
                      {def.label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </Surface>
        </View>

        {/* Solid HeroCard sample */}
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            SOLID HERO CARD
          </AppText>
          <HeroCard style={{ gap: theme.spacing.md }}>
            <View style={styles.heroHeaderRow}>
              <AppText variant="label" color="heroTextSecondary">
                Left to spend
              </AppText>
              <BudgetStatusBadge status="ok" surface="hero" />
            </View>
            <Money amountMinor={2_355_000} currency="BDT" variant="hero" color="heroText" />
            <HeroProgressBar pct={53} />
            <View style={styles.heroStatsRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color="heroTextSecondary">
                  Safe / day
                </AppText>
                <Money amountMinor={87_200} currency="BDT" variant="bodyStrong" color="heroText" roundToWhole />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color="heroTextSecondary">
                  Spent
                </AppText>
                <Money amountMinor={2_645_000} currency="BDT" variant="bodyStrong" color="heroText" compact />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color="heroTextSecondary">
                  Income
                </AppText>
                <Money amountMinor={5_500_000} currency="BDT" variant="bodyStrong" color="heroText" compact />
              </View>
            </View>
          </HeroCard>
        </View>

        {/* Dedicated ৳ Size Buckets */}
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            TAKA SIGN SCALE (12 · 15 · 17 · 28 · 40)
          </AppText>
          <Surface testID="gallery-taka-buckets" style={{ gap: theme.spacing.sm }}>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                40sp Hero
              </AppText>
              <Money testID="gallery-money-hero" amountMinor={4_835_000} currency="BDT" variant="hero" />
            </View>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                28sp Display
              </AppText>
              <Money amountMinor={2_487_600} currency="BDT" variant="display" />
            </View>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                17sp Headline
              </AppText>
              <Money amountMinor={248_769} currency="BDT" variant="headline" roundToWhole />
            </View>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                15sp Body
              </AppText>
              <Money amountMinor={4_835_000} currency="BDT" variant="bodyStrong" compact />
            </View>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                12sp Caption
              </AppText>
              <Money amountMinor={12_500} currency="BDT" variant="caption" showDecimals />
            </View>
            <View style={styles.takaRow}>
              <AppText variant="caption" color="textSecondary" style={styles.takaSizeCol}>
                Hidden
              </AppText>
              <Money amountMinor={4_835_000} currency="BDT" variant="bodyStrong" hidden />
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            TYPOGRAPHY
          </AppText>
          <Surface style={{ gap: theme.spacing.sm }}>
            <View style={styles.inlineRow}>
              <Money amountMinor={-60_000} currency="BDT" variant="bodyStrong" />
              <Money
                amountMinor={250_000}
                currency="BDT"
                variant="bodyStrong"
                color="accent"
                prefix="+"
              />
              <Money amountMinor={42_99} currency="USD" variant="bodyStrong" />
            </View>
            <AppText variant="title">Title · Budget overview</AppText>
            <AppText variant="headline">Headline · Category budgets</AppText>
            <AppText variant="body">Body · Quiet confidence, crisp contrast.</AppText>
            <AppText variant="label" color="textSecondary">
              Label · 27 days left · 10 Nov – 9 Dec
            </AppText>
            <AppText variant="caption" color="textTertiary">
              Caption · Tertiary metadata
            </AppText>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            CATEGORY TILES (20 DEFAULTS)
          </AppText>
          <Surface style={{ gap: theme.spacing.md }}>
            <View style={styles.tileGrid}>
              {DEFAULT_CATEGORIES.map((cat, idx) => (
                <View key={cat.id} style={styles.tileItem}>
                  <IconTile
                    icon={cat.icon}
                    colorKey={cat.colorKey}
                    selected={idx === 0}
                  />
                  <AppText variant="tab" color="textSecondary" style={styles.tileLabel}>
                    {cat.name}
                  </AppText>
                </View>
              ))}
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            BUTTONS & ICON BUTTONS
          </AppText>
          <Surface style={{ gap: theme.spacing.md }}>
            <View style={styles.inlineRow}>
              <Button title="Primary Ink" onPress={() => showToast({ message: 'Primary tapped' })} />
              <Button title="Secondary" variant="secondary" onPress={() => {}} />
            </View>
            <View style={styles.inlineRow}>
              <Button title="Destructive" variant="danger" size="sm" onPress={() => {}} />
              <Button title="Ghost" variant="ghost" size="sm" onPress={() => {}} />
              <Button title="Loading" loading size="sm" onPress={() => {}} />
            </View>
            <View style={styles.inlineRow}>
              <IconButton icon="sliders-horizontal" variant="surface" badgeCount={3} accessibilityLabel="Filters" onPress={() => {}} />
              <IconButton icon="sparkles" variant="accentSoft" accessibilityLabel="Quick entry" onPress={() => {}} />
              <IconButton icon="plus" variant="accent" accessibilityLabel="Add" onPress={() => {}} />
              <IconButton icon="x" variant="sunken" accessibilityLabel="Close" onPress={() => {}} />
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            LIST ROWS, SETTINGS GROUP & BANNER
          </AppText>
          <Banner
            tone="accent"
            icon="repeat"
            message="New cycle started 10 Nov · Last cycle ৳28,450"
            showChevron
            onPress={() => {}}
          />
          <Surface padded={false}>
            <ListRow
              left={<IconTile icon="utensils" colorKey="amber" />}
              title="Lunch at Star Kabab"
              subtitle="Food & Dining · 12:45"
              right={<Money amountMinor={45_000} currency="BDT" variant="bodyStrong" prefix="-" />}
              showDivider
              onPress={() => {}}
            />
            <ListRow
              left={<IconTile icon="car" colorKey="blue" />}
              title="Pathao Ride"
              subtitle="Transport · Yesterday"
              right={<Money amountMinor={22_000} currency="BDT" variant="bodyStrong" prefix="-" />}
              onPress={() => {}}
            />
          </Surface>

          <SettingsGroup title="Preferences" footer="Changes take effect immediately.">
            <SettingsRow
              icon="palette"
              label="Appearance"
              value={`${ACCENT_DEFINITIONS[accentPref].label} · ${theme.mode}`}
              showChevron
              onPress={() => {}}
            />
            <SettingsRow
              icon="bell"
              label="Daily check-in"
              trailing={<Switch value={switchVal} onValueChange={setSwitchVal} />}
            />
          </SettingsGroup>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            CONTROLS, CHIPS, FIELDS & DATE PICKERS
          </AppText>
          <Surface style={{ gap: theme.spacing.md }}>
            <SegmentedControl
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              value={segment}
              onChange={setSegment}
            />
            <View style={styles.inlineRow}>
              <Chip
                label="Food & Dining"
                icon="utensils"
                selected={chipSelected === 'food'}
                onPress={() => setChipSelected('food')}
              />
              <Chip
                label="Transport"
                icon="car"
                selected={chipSelected === 'car'}
                onPress={() => setChipSelected('car')}
              />
            </View>
            <Field
              label="Description"
              leftIcon="search"
              value={fieldText}
              onChangeText={setFieldText}
              onClear={() => setFieldText('')}
              placeholder="Search entries"
            />
            <View style={styles.inlineRow}>
              <DateField testID="gallery-date-today" label="Date (today)" value={pickedToday} onChange={setPickedToday} />
              <DateField testID="gallery-date-past" label="Date (formatted)" value={pickedDate} onChange={setPickedDate} />
              <TimeField testID="gallery-time" label="Time" value={pickedTime} onChange={setPickedTime} />
            </View>
            <AppText variant="label" color="textSecondary">
              Reminder days (selected: {days.join(', ')})
            </AppText>
            <DayToggles selectedDays={days} onChange={setDays} />
            <AppText variant="label" color="textSecondary">
              Cycle start day ({cycleDay})
            </AppText>
            <DayOfMonthGrid value={cycleDay} onChange={setCycleDay} />
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            PROGRESS & CHARTS
          </AppText>
          <Surface style={{ gap: theme.spacing.lg }}>
            <ProgressRing pct={41} status="ok">
              <Money amountMinor={2_355_000} currency="BDT" variant="display" />
              <AppText variant="label" color="textSecondary">
                left · 41% used
              </AppText>
            </ProgressRing>
            <View style={{ gap: theme.spacing.sm }}>
              <ProgressBar pct={41} status="ok" />
              <ProgressBar pct={86} status="attention" />
              <ProgressBar pct={100} status="over" />
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            KEYPAD, SHEET, TOAST & EMPTY STATE
          </AppText>
          <Surface style={{ gap: theme.spacing.md }}>
            <View style={{ alignItems: 'center' }}>
              <Money amountMinor={padMinor} currency="BDT" variant="hero" />
            </View>
            <Keypad value={padDraft} onChange={setPadDraft} />
            <View style={styles.inlineRow}>
              <Button title="Open Sheet" variant="secondary" size="sm" onPress={() => setSheetOpen(true)} />
              <Button
                title="Show Toast"
                size="sm"
                onPress={() => showToast({ message: 'Saved · Food & Dining ৳350', actionLabel: 'Undo', onAction: () => {} })}
              />
            </View>
            <ToastView message="Saved · Food & Dining ৳350" actionLabel="Undo" onAction={() => {}} />
          </Surface>

          <EmptyState
            icon="wallet"
            title="No expenses yet"
            body="Tap the + button below whenever you spend or receive money."
            ctaLabel="Add transaction"
            onCtaPress={() => {}}
          />
        </View>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Example Bottom Sheet">
        <AppText variant="body" color="textSecondary">
          Sheets use 28dp top corners, a centered handle, and keyboard avoidance.
        </AppText>
        <Button title="Got it" onPress={() => setSheetOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

export default function DevGalleryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ theme?: string; accent?: string }>();
  const [overrideMode, setOverrideMode] = useState<GalleryMode | null>(null);
  const [overrideAccent, setOverrideAccent] = useState<AccentTheme | null>(null);

  const initialMode: GalleryMode =
    params.theme === 'dark' || params.theme === 'black' || params.theme === 'light'
      ? params.theme
      : theme.mode;
  const modePref: GalleryMode = overrideMode ?? initialMode;

  const initialAccent: AccentTheme = ACCENT_THEMES.includes(params.accent as AccentTheme)
    ? (params.accent as AccentTheme)
    : theme.accent;
  const accentPref: AccentTheme = overrideAccent ?? initialAccent;

  useEffect(() => {
    if (!isDevVariant()) {
      router.replace('/');
    }
  }, [router]);

  if (!isDevVariant()) {
    return null;
  }

  return (
    <ThemeProvider preference={modePref as ThemePreference} accent={accentPref}>
      <ToastProvider>
        <GalleryBody
          modePref={modePref}
          accentPref={accentPref}
          onChangeMode={setOverrideMode}
          onChangeAccent={setOverrideAccent}
        />
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accentBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  accentRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  takaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  takaSizeCol: {
    width: 96,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  tileItem: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
  },
  tileLabel: {
    textAlign: 'center',
  },
});
