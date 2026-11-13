import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_CATEGORIES } from '@/domain/categories';
import { todayLocalDate } from '@/domain/dates';
import { parseMoneyInput } from '@/domain/money';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';
import { AppText } from '@/ui/AppText';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { DayOfMonthGrid } from '@/ui/DayOfMonthGrid';
import { DayToggles } from '@/ui/DayToggles';
import { EmptyState } from '@/ui/EmptyState';
import { Field } from '@/ui/Field';
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

function GalleryBody({
  schemePref,
  onChangeScheme,
}: {
  schemePref: 'light' | 'dark';
  onChangeScheme: (next: 'light' | 'dark') => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

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
              v2 Gallery
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              DEV · {theme.scheme.toUpperCase()}
            </AppText>
          </View>
          <View style={{ width: 114 }}>
            <SegmentedControl
              testID="gallery-theme-toggle"
              size="sm"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={schemePref}
              onChange={onChangeScheme}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            TYPOGRAPHY & MONEY
          </AppText>
          <Surface style={{ gap: theme.spacing.sm }}>
            <Money testID="gallery-money-hero" amountMinor={2_355_000} currency="BDT" variant="hero" />
            <Money amountMinor={125_050} currency="BDT" variant="display" />
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
                  <AppText variant="tab" color="textSecondary" numberOfLines={1}>
                    {cat.name.split(' ')[0]}
                  </AppText>
                </View>
              ))}
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            SURFACES & BANNERS
          </AppText>
          <View style={{ gap: theme.spacing.sm }}>
            <Surface variant="card">
              <AppText variant="bodyStrong">Surface card</AppText>
              <AppText variant="caption" color="textSecondary">
                Elevated crisp surface with subtle border
              </AppText>
            </Surface>
            <Surface variant="sunken">
              <AppText variant="bodyStrong">Surface sunken</AppText>
              <AppText variant="caption" color="textSecondary">
                Recessed container for inputs and controls
              </AppText>
            </Surface>
            <Banner
              message="New cycle started 10 Nov · Last cycle ৳4,600"
              icon="repeat"
              tone="accent"
              onPress={() => {}}
            />
            <Banner
              message="Over budget by ৳1,200 this cycle"
              icon="triangle-alert"
              tone="danger"
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            BUTTONS & ICON BUTTONS
          </AppText>
          <Surface style={{ gap: theme.spacing.sm }}>
            <Button title="Save expense" leftIcon="check" onPress={() => {}} />
            <Button title="Say or type it" variant="secondary" leftIcon="sparkles" onPress={() => {}} />
            <View style={styles.inlineRow}>
              <Button title="Small primary" size="sm" onPress={() => {}} />
              <Button title="Ghost" variant="ghost" size="sm" onPress={() => {}} />
              <Button title="Delete" variant="dangerSoft" size="sm" leftIcon="trash-2" onPress={() => {}} />
            </View>
            <View style={styles.inlineRow}>
              <IconButton icon="plus" variant="accent" accessibilityLabel="Add" onPress={() => {}} />
              <IconButton
                icon="sliders-horizontal"
                variant="surface"
                badgeCount={2}
                accessibilityLabel="Filter"
                onPress={() => {}}
              />
              <IconButton variant="accentSoft" accessibilityLabel="Profile" onPress={() => {}}>
                <AppText variant="label" color="accent">
                  H
                </AppText>
              </IconButton>
            </View>
          </Surface>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            LIST ROWS & SETTINGS GROUP
          </AppText>
          <Surface padded={false}>
            <ListRow
              title="Rent Narsingdi"
              subtitle="Rent income · 6:10 PM"
              left={<IconTile icon="building-2" colorKey="violet" />}
              right={
                <Money amountMinor={250_000} currency="BDT" variant="bodyStrong" color="accent" prefix="+" />
              }
              showDivider
              onPress={() => {}}
            />
            <ListRow
              title="Google AI Pro"
              subtitle="Subscriptions · 9:02 AM"
              left={<IconTile icon="repeat" colorKey="teal" />}
              right={<Money amountMinor={-60_000} currency="BDT" variant="bodyStrong" />}
              showChevron
              onPress={() => {}}
            />
          </Surface>

          <SettingsGroup title="Preferences & reminders">
            <SettingsRow label="Currency" value="BDT ৳" locked />
            <SettingsRow label="Budget cycle starts" value="10th of month" showChevron onPress={() => {}} />
            <SettingsRow
              label="Daily check-in"
              trailing={
                <Switch
                  value={switchVal}
                  onValueChange={setSwitchVal}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.surfaceSunken }}
                />
              }
            />
          </SettingsGroup>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            CONTROLS, PICKERS & DAY GRIDS
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
              placeholder="Search or describe..."
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
  const params = useLocalSearchParams<{ theme?: string }>();
  const [overrideScheme, setOverrideScheme] = useState<'light' | 'dark' | null>(null);
  const schemePref: 'light' | 'dark' =
    overrideScheme ??
    (params.theme === 'dark' || params.theme === 'light' ? params.theme : theme.scheme);

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
    }
  }, [router]);

  if (!__DEV__) {
    return null;
  }

  return (
    <ThemeProvider preference={schemePref}>
      <ToastProvider>
        <GalleryBody schemePref={schemePref} onChangeScheme={setOverrideScheme} />
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
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileItem: {
    width: 65,
    alignItems: 'center',
    gap: 4,
  },
});
