import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, act } from '@testing-library/react-native';
import { addDays, diffDays } from '@/domain/dates';
import { usePrivacyStore } from '@/state/privacyStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Banner } from './Banner';
import { Button } from './Button';
import { DateField } from './DateField';
import { DayOfMonthGrid } from './DayOfMonthGrid';
import { DayToggles } from './DayToggles';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { IconTile } from './IconTile';
import { applyKeypadKey, Keypad } from './Keypad';
import { Money } from './Money';
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
    expect(neg.props.accessibilityLabel).toBe('−৳ 600');
    expect(StyleSheet.flatten(neg.props.style).fontVariant).toEqual(['tabular-nums']);

    const negTaka = view.getByTestId('m-neg-taka');
    // ৳ is drawn by the patched app font, so it inherits the number's family and size.
    expect(StyleSheet.flatten(negTaka.props.style).fontFamily).toBeUndefined();
    expect(StyleSheet.flatten(negTaka.props.style).fontSize).toBe(15);
    expect(StyleSheet.flatten(negTaka.props.style).opacity).toBe(1);

    const heroTaka = view.getByTestId('m-hero-taka');
    expect(StyleSheet.flatten(heroTaka.props.style).fontFamily).toBeUndefined();
    expect(StyleSheet.flatten(heroTaka.props.style).fontSize).toBe(40);
    expect(StyleSheet.flatten(heroTaka.props.style).opacity).toBe(0.82);

    const dec = view.getByTestId('m-dec');
    expect(dec.props.accessibilityLabel).toBe('$1,250.50');

    expect(view.getByText(/৳\s48\.4k/)).toBeTruthy();
    expect(view.getByTestId('m-compact').props.accessibilityLabel).toBe('৳ 48,350');
    expect(view.getByText(/৳\s2,488/)).toBeTruthy();
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

    expect(view.getByTestId('card-money').props.accessibilityLabel).toBe('৳ 48,350');
    expect(view.getByTestId('ledger-money').props.accessibilityLabel).toBe('৳ 48,350');

    await act(async () => {
      usePrivacyStore.getState().setCompactNumbers(true);
    });
    expect(view.getByText(/48\.4k/)).toBeTruthy();
    expect(view.getByText(/৳\s48,350$/)).toBeTruthy();

    await act(async () => {
      usePrivacyStore.getState().syncFromSettings({ showPoisha: true, compactNumbers: false });
    });
    expect(view.getAllByText(/৳\s48,350\.00$/)).toHaveLength(2);

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
});
