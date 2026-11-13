import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
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
  it('renders Money with tabular-nums, U+2212 minus, and whole-unit vs decimal formatting', async () => {
    const view = await render(
      <ThemeProvider preference="light">
        <Money testID="m-neg" amountMinor={-60_000} currency="BDT" />
        <Money testID="m-dec" amountMinor={125_050} currency="USD" />
      </ThemeProvider>
    );

    const neg = view.getByTestId('m-neg');
    expect(neg.props.accessibilityLabel).toBe('−৳ 600');
    expect(StyleSheet.flatten(neg.props.style).fontVariant).toEqual(['tabular-nums']);

    const dec = view.getByTestId('m-dec');
    expect(dec.props.accessibilityLabel).toBe('$1,250.50');
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
    expect(view.getByText('1:20 PM')).toBeTruthy();
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
});
