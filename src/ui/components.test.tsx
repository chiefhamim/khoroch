import React from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { fireEvent, render, act } from '@testing-library/react-native';
import { addDays, diffDays } from '@/domain/dates';
import { usePrivacyStore } from '@/state/privacyStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { setLocale } from '@/i18n';
import { AppText, estimateSingleLineMinWidth } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { DayOfMonthGrid } from './DayOfMonthGrid';
import { DayToggles } from './DayToggles';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { IconTile } from './IconTile';
import { applyKeypadKey, Keypad } from './Keypad';
import { Money } from './Money';
import { PillSwitch } from './PillSwitch';
import { ProfileAvatar } from './ProfileAvatar';
import { isHapticsEnabled, setHapticsEnabled } from './haptics';
import { ProgressBar } from './ProgressBar';
import { ProgressRing } from './ProgressRing';
import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';
import { Sheet } from './Sheet';
import { pickDailyAxisLabels } from './SpendingChart';
import { Surface } from './Surface';
import { TimeField } from './TimeField';
import { ToastView } from './Toast';

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

describe('v2 design system components', () => {
  it('renders Money with tabular-nums, Hind Siliguri TakaSign, U+2212 minus, compact, roundToWhole, and hidden', async () => {
    const view = await render(
      <ThemeProvider preference="light" accent="ocean">
        <Money testID="m-neg" amountMinor={-60_000} currency="BDT" />
        <Money testID="m-dec" amountMinor={125_050} currency="USD" />
        <Money testID="m-hero" amountMinor={4_835_000} currency="BDT" variant="hero" />
        <Money testID="m-compact" amountMinor={4_835_000} currency="BDT" variant="bodyStrong" compact />
        <Money testID="m-whole" amountMinor={248_769} currency="BDT" variant="headline" roundToWhole />
        <Money testID="m-hidden" amountMinor={4_835_000} currency="BDT" variant="bodyStrong" hidden />
      </ThemeProvider>
    );

    const neg = view.getByTestId('m-neg');
    expect(neg.props.accessibilityLabel).toBe('−৳600');
    expect(StyleSheet.flatten(neg.props.style).fontVariant).toEqual(['tabular-nums']);

    const negTaka = view.getByTestId('m-neg-taka');
    expect(StyleSheet.flatten(negTaka.props.style).fontFamily).toBe('HindSiliguri_600SemiBold');
    expect(StyleSheet.flatten(negTaka.props.style).fontSize).toBe(9);
    expect(StyleSheet.flatten(negTaka.props.style).opacity).toBe(1);

    const heroTaka = view.getByTestId('m-hero-taka');
    expect(StyleSheet.flatten(heroTaka.props.style).fontFamily).toBe('HindSiliguri_600SemiBold');
    expect(StyleSheet.flatten(heroTaka.props.style).fontSize).toBe(24);
    expect(StyleSheet.flatten(heroTaka.props.style).opacity).toBe(1);

    const dec = view.getByTestId('m-dec');
    expect(dec.props.accessibilityLabel).toBe('$1,250.50');

    expect(view.getByTestId('m-compact').props.accessibilityLabel).toBe('৳48.4k');
    expect(view.getByTestId('m-whole').props.accessibilityLabel).toBe('৳2,488');
    expect(view.getByText('Hidden')).toBeTruthy();
  });

  it('applies privacyStore showPoisha, compactNumbers (cards only), and hideAmounts dynamically', async () => {
    usePrivacyStore.setState({ hideAmounts: false, showPoisha: false, compactNumbers: false });

    const view = await render(
      <ThemeProvider preference="light" accent="forest">
        <Money testID="card-money" amountMinor={4_835_000} currency="BDT" allowCompact />
        <Money testID="ledger-money" amountMinor={4_835_000} currency="BDT" />
      </ThemeProvider>
    );

    expect(view.getByTestId('card-money').props.accessibilityLabel).toBe('৳48,350');
    expect(view.getByTestId('ledger-money').props.accessibilityLabel).toBe('৳48,350');

    await act(async () => {
      usePrivacyStore.getState().setCompactNumbers(true);
    });
    expect(view.getByText(/48\.4k/)).toBeTruthy();
    expect(view.getByTestId('ledger-money').props.accessibilityLabel).toBe('৳48,350');

    await act(async () => {
      usePrivacyStore.getState().syncFromSettings({ showPoisha: true, compactNumbers: false });
    });
    expect(view.getByTestId('card-money').props.accessibilityLabel).toBe('৳48,350.00');
    expect(view.getByTestId('ledger-money').props.accessibilityLabel).toBe('৳48,350.00');

    await act(async () => {
      usePrivacyStore.getState().resetForOpen(true);
    });
    expect(view.getAllByText('Hidden')).toHaveLength(2);

    await act(async () => {
      usePrivacyStore.setState({ hideAmounts: false, showPoisha: false, compactNumbers: false });
    });
  });

  it('applies keypad keys respecting 2 decimal precision and max length', () => {
    let val = '';
    val = applyKeypadKey(val, '1');
    val = applyKeypadKey(val, '2');
    val = applyKeypadKey(val, '.');
    val = applyKeypadKey(val, '5');
    val = applyKeypadKey(val, '9');
    val = applyKeypadKey(val, '7'); // ignored: 2 decimals max
    expect(val).toBe('12.59');
    val = applyKeypadKey(val, '.'); // ignored: duplicate dot
    expect(val).toBe('12.59');
    val = applyKeypadKey(val, 'BACK');
    expect(val).toBe('12.5');
    expect(applyKeypadKey('', '.')).toBe('0.');
    expect(applyKeypadKey('0', '5')).toBe('5');
  });

  it('toggles weekdays in DayToggles and selects day in DayOfMonthGrid', async () => {
    const onDays = jest.fn();
    const onCycle = jest.fn();

    const view = await render(
      <ThemeProvider preference="light">
        <DayToggles testID="toggles" selectedDays={[2, 3, 4, 5]} onChange={onDays} />
        <DayOfMonthGrid testID="cycle" value={10} onChange={onCycle} />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByTestId('toggles-day-6'));
    expect(onDays).toHaveBeenCalledWith([2, 3, 4, 5, 6]);

    await fireEvent.press(view.getByTestId('cycle-day-15'));
    expect(onCycle).toHaveBeenCalledWith(15);
  });

  it('renders DateField and TimeField friendly labels cleanly', async () => {
    const view = await render(
      <ThemeProvider preference="dark">
        <DateField testID="df-today" value="2026-11-13" today="2026-11-13" onChange={() => {}} />
        <DateField testID="df-past" value="2026-11-11" today="2026-11-13" onChange={() => {}} />
        <TimeField testID="tf-12" value="13:20" use24Hour={false} onChange={() => {}} />
        <TimeField testID="tf-24" value="21:00" use24Hour={true} onChange={() => {}} />
      </ThemeProvider>
    );

    expect(view.getByText('Today')).toBeTruthy();
    expect(view.getByText('Wed, 11 Nov')).toBeTruthy();
    expect(view.getByText('1:20 PM')).toBeTruthy();
    expect(view.getByText('21:00')).toBeTruthy();
  });

  it('renders Surface, IconTile, ProgressRing, ProgressBar, SettingsGroup, Banner, ToastView, and Sheet', async () => {
    const onKeypad = jest.fn();
    const view = await render(
      <ThemeProvider preference="light">
        <Surface>
          <View>
            <IconTile icon="utensils" colorKey="orange" selected />
            <IconButton icon="plus" accessibilityLabel="Add" onPress={() => {}} badgeCount={2} />
            <Button title="Primary CTA" onPress={() => {}} />
            <Field value="hello" onChangeText={() => {}} />
            <ProgressBar pct={45} status="ok" />
            <ProgressRing pct={41} status="ok">
              <Money amountMinor={2_355_000} currency="BDT" />
            </ProgressRing>
            <SettingsGroup title="General">
              <SettingsRow label="Currency" value="BDT" locked />
            </SettingsGroup>
            <Banner message="Cycle started" />
            <ToastView message="Saved" />
            <Keypad testID="kp" value="10" onChange={onKeypad} />
          </View>
        </Surface>
        <Sheet visible onClose={() => {}} title="Test Sheet">
          <Button title="Close inside" onPress={() => {}} />
        </Sheet>
      </ThemeProvider>
    );

    await fireEvent.press(view.getByTestId('kp-key-5'));
    expect(onKeypad).toHaveBeenCalledWith('105');
    expect(view.getByText('Currency')).toBeTruthy();
    expect(view.getByText('Test Sheet')).toBeTruthy();
    expect(view.getByText('Cycle started')).toBeTruthy();
  });

  it('pickDailyAxisLabels keeps <=5 labels, >=3 day spacing, and "Today" last when in range', () => {
    const buildRange = (start: string, count: number) =>
      Array.from({ length: count }, (_, i) => addDays(start, i));

    for (const [len, today] of [
      [1, '2026-11-10'],
      [3, '2026-11-12'],
      [4, '2026-11-13'],
      [7, '2026-11-16'],
      [13, '2026-11-13'],
      [30, '2026-11-13'],
      [31, undefined],
    ] as const) {
      const start = len === 13 || len === 30 ? '2026-11-01' : '2026-11-10';
      const days = buildRange(start, len);
      const labels = pickDailyAxisLabels(days, today);
      expect(labels).toHaveLength(len);

      const nonEmptyIndices = labels
        .map((label, idx) => (label ? idx : -1))
        .filter((idx) => idx >= 0);

      expect(nonEmptyIndices.length).toBeLessThanOrEqual(5);
      expect(nonEmptyIndices.length).toBeGreaterThanOrEqual(1);

      for (let i = 1; i < nonEmptyIndices.length; i++) {
        const gap = diffDays(days[nonEmptyIndices[i]], days[nonEmptyIndices[i - 1]]);
        expect(gap).toBeGreaterThanOrEqual(3);
      }

      if (today && days.includes(today)) {
        const lastIdx = nonEmptyIndices[nonEmptyIndices.length - 1];
        expect(days[lastIdx]).toBe(today);
        expect(labels[lastIdx]).toBe('Today');
      }
    }
  });

  it('estimates single-line minWidth wider for Bengali labels and updates AppText font when locale switches', async () => {
    expect(estimateSingleLineMinWidth('আজকের খাতা', 13)).toBeGreaterThan(
      estimateSingleLineMinWidth('Day book', 13)
    );
    expect(estimateSingleLineMinWidth('আজকের খাতা', 13)).toBeGreaterThanOrEqual(85);

    setLocale('en');
    try {
      const view = await render(
        <ThemeProvider preference="light" accent="forest">
          <AppText testID="locale-sample" variant="headline">
            Today
          </AppText>
        </ThemeProvider>
      );
      expect(StyleSheet.flatten(view.getByTestId('locale-sample').props.style).fontFamily).toBe(
        'Manrope_600SemiBold'
      );

      await act(async () => {
        setLocale('bn');
      });
      await view.rerender(
        <ThemeProvider preference="light" accent="forest">
          <AppText testID="locale-sample" variant="headline">
            আজ
          </AppText>
        </ThemeProvider>
      );
      expect(StyleSheet.flatten(view.getByTestId('locale-sample').props.style).fontFamily).toBe(
        'HindSiliguri_600SemiBold'
      );
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });

  it('keeps multi-word Bangla Chip and DateField labels on a single line without truncation', async () => {
    setLocale('bn');
    try {
      const view = await render(
        <ThemeProvider preference="light" accent="forest">
          <Chip testID="bn-chip-all" label="সব তারিখ" onPress={() => {}} />
          <Chip testID="bn-chip-month" label="এই মাস" onPress={() => {}} />
          <DateField
            testID="bn-date-field"
            value="2026-11-11"
            today="2026-11-14"
            onChange={() => {}}
          />
        </ThemeProvider>
      );

      const chipText = view.getByText('সব তারিখ');
      const monthText = view.getByText('এই মাস');
      expect(StyleSheet.flatten(chipText.props.style).minWidth).toBe(
        estimateSingleLineMinWidth('সব তারিখ', 13)
      );
      expect(StyleSheet.flatten(monthText.props.style).minWidth).toBe(
        estimateSingleLineMinWidth('এই মাস', 13)
      );

      const dfText = view.getByText('বুধ, ১১ নভে');
      expect(StyleSheet.flatten(dfText.props.style).minWidth).toBe(
        estimateSingleLineMinWidth('বুধ, ১১ নভে', 13)
      );

      await view.rerender(
        <ThemeProvider preference="light" accent="forest">
          <AppText
            testID="bn-weight-clear"
            variant="caption"
            style={{ fontWeight: '600', letterSpacing: 0.6 }}
          >
            রবি, 8 নভে
          </AppText>
        </ThemeProvider>
      );
      const weightedStyle = StyleSheet.flatten(
        view.getByTestId('bn-weight-clear').props.style
      );
      expect(weightedStyle.fontFamily).toBe('HindSiliguri_600SemiBold');
      expect(weightedStyle.fontWeight).toBeUndefined();
      expect(weightedStyle.letterSpacing).toBe(0);
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });

  it('gives short multi-word Bangla Button CTA labels a compact minWidth without over-pushing icons', async () => {
    setLocale('bn');
    try {
      const view = await render(
        <ThemeProvider preference="dark" accent="forest">
          <Button
            testID="bn-delete-btn"
            title="মুছে ফেলুন"
            leftIcon="trash-2"
            variant="dangerSoft"
            onPress={() => {}}
          />
          <Button
            testID="bn-transfer-save-btn"
            title="ট্রান্সফার সেভ করুন"
            variant="primary"
            onPress={() => {}}
          />
          <Button
            testID="bn-confirm-save-btn"
            title="নিশ্চিত ও সেভ করুন (2)"
            variant="primary"
            onPress={() => {}}
          />
          <Button
            testID="bn-long-btn"
            title="আপনার সমস্ত হিসাবের ব্যাকআপ নিন"
            variant="primary"
            onPress={() => {}}
          />
        </ThemeProvider>
      );

      const scale = Math.max(1, PixelRatio.getFontScale?.() ?? 1);
      const deleteText = view.getByText('মুছে ফেলুন');
      const deleteMinWidth = StyleSheet.flatten(deleteText.props.style).minWidth as number;
      expect(deleteMinWidth).toBeGreaterThanOrEqual(75 * scale);
      expect(deleteMinWidth).toBeLessThanOrEqual(98 * scale);

      const transferSaveText = view.getByText('ট্রান্সফার সেভ করুন');
      const transferSaveMinWidth = StyleSheet.flatten(transferSaveText.props.style)
        .minWidth as number;
      expect(transferSaveMinWidth).toBeGreaterThanOrEqual(140 * scale);
      expect(transferSaveMinWidth).toBeLessThanOrEqual(170 * scale);

      const confirmSaveText = view.getByText('নিশ্চিত ও সেভ করুন (২)');
      const confirmSaveMinWidth = StyleSheet.flatten(confirmSaveText.props.style)
        .minWidth as number;
      expect(confirmSaveMinWidth).toBeGreaterThanOrEqual(170 * scale);
      expect(confirmSaveMinWidth).toBeLessThanOrEqual(210 * scale);

      const longText = view.getByText('আপনার সমস্ত হিসাবের ব্যাকআপ নিন');
      expect(StyleSheet.flatten(longText.props.style).minWidth).toBeUndefined();

      const feedbackView = await render(
        <ThemeProvider preference="light">
          <ToastView message="আজকের হিসাব মেলানো হয়েছে" />
          <EmptyState
            title="আজ কোনো হিসাব লেখা হয়নি"
            body="আজ কোনো খরচ না হয়ে থাকলে ট্যাপ করুন।"
          />
        </ThemeProvider>
      );
      const toastText = feedbackView.getByText('আজকের হিসাব মেলানো হয়েছে');
      const toastMinWidth = StyleSheet.flatten(toastText.props.style).minWidth as number;
      expect(toastMinWidth).toBeGreaterThanOrEqual(Math.min(190 * scale, 280));
      expect(toastMinWidth).toBeLessThanOrEqual(280);

      const emptyTitle = feedbackView.getByText('আজ কোনো হিসাব লেখা হয়নি');
      expect(StyleSheet.flatten(emptyTitle.props.style).alignSelf).toBe('stretch');
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });

  it('caps ToastView message minWidth when actionLabel is present and triggers onAction/onDismiss', async () => {
    const onAction = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <ThemeProvider preference="dark">
        <ToastView
          testID="action-toast"
          message="Saved · Food & Dining ৳350 and a longer description for wrapping"
          actionLabel="Undo"
          onAction={onAction}
          onDismiss={onDismiss}
        />
        <Sheet visible onClose={() => {}} title="ধার দেওয়া বা নেওয়া এবং বিস্তারিত শিরোনাম">
          <Button title="Done" onPress={() => {}} />
        </Sheet>
      </ThemeProvider>
    );

    const msgStyle = StyleSheet.flatten(
      view.getByText('Saved · Food & Dining ৳350 and a longer description for wrapping').props.style
    );
    expect(msgStyle.minWidth).toBeLessThanOrEqual(190);
    await fireEvent.press(view.getByLabelText('Undo'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const sheetTitleStyle = StyleSheet.flatten(
      view.getByText('ধার দেওয়া বা নেওয়া এবং বিস্তারিত শিরোনাম').props.style
    );
    expect(sheetTitleStyle.minWidth).toBe(0);
  });

  it('promotes medium Bangla labels containing U+09E7 to HindSiliguri_600SemiBold so Bangla 1 renders cleanly', async () => {
    setLocale('bn');
    try {
      const view = await render(
        <ThemeProvider preference="dark">
          <AppText testID="bn-one-caption" variant="caption">
            ১ জন
          </AppText>
          <AppText testID="bn-two-caption" variant="caption">
            ২ জন
          </AppText>
        </ThemeProvider>
      );
      expect(
        StyleSheet.flatten(view.getByTestId('bn-one-caption').props.style).fontFamily
      ).toBe('HindSiliguri_600SemiBold');
      expect(
        StyleSheet.flatten(view.getByTestId('bn-two-caption').props.style).fontFamily
      ).toBe('HindSiliguri_500Medium');
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });

  it('renders PillSwitch as a full stadium switch supporting press/valueChange and haptics flag gating', async () => {
    const onChange = jest.fn();
    const view = await render(
      <ThemeProvider preference="light">
        <PillSwitch testID="pill-sw" value={false} onValueChange={onChange} />
      </ThemeProvider>
    );

    const sw = view.getByTestId('pill-sw');
    expect(sw.props.accessibilityRole).toBe('switch');
    expect(sw.props.accessibilityState?.checked).toBe(false);

    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);

    fireEvent(sw, 'valueChange', true);
    expect(onChange).toHaveBeenCalledTimes(2);

    setHapticsEnabled(false);
    expect(isHapticsEnabled()).toBe(false);
    setHapticsEnabled(true);
    expect(isHapticsEnabled()).toBe(true);
  });

  it('renders custom expense money color and curated ProfileAvatar preset', async () => {
    const view = await render(
      <ThemeProvider preference="light" accent="graphite" incomeColor="ocean" expenseColor="crimson">
        <Money testID="inc-money" amountMinor={125_000} currency="BDT" color="income" prefix="+" />
        <Money testID="exp-money" amountMinor={75_000} currency="BDT" color="expense" prefix="−" />
        <ProfileAvatar testID="av-sea" name="Hamim" avatarId="sea_lotus" size={44} />
        <ProfileAvatar testID="av-init" name="Hamim" avatarId="initial" size={44} />
      </ThemeProvider>
    );

    expect(view.getByTestId('inc-money').props.accessibilityLabel).toBe('+৳1,250');
    expect(view.getByTestId('exp-money').props.accessibilityLabel).toBe('−৳750');
    expect(view.getByTestId('av-sea')).toBeTruthy();
    expect(view.getByTestId('av-init')).toBeTruthy();
    expect(view.getByText('H')).toBeTruthy();
  });
});
