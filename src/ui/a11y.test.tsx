import React from 'react';
import { AccessibilityInfo, PixelRatio, StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { OverviewContent } from '@/app/(tabs)/index';
import { MemoryRepo } from '@/data/memoryRepo';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { ListRow } from './ListRow';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@expo/vector-icons', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  const Icon = ({ name }: { name: string }) => reactMod.createElement(rnMod.Text, null, name);
  Icon.glyphMap = {};
  return { Ionicons: Icon };
});

function ReducedMotionProbe() {
  const { reducedMotion } = useTheme();
  return <AppText testID="reduced-motion-flag">{String(reducedMotion)}</AppText>;
}

describe('Accessibility, large fontScale, reduced motion, and DB error recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates reducedMotion, keeps >= 48dp touch targets, and allows large OS fontScale', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2.0);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const view = await render(
      <ThemeProvider preference="light">
        <ReducedMotionProbe />
        <Button testID="a11y-btn" title="Save budget" onPress={() => {}} />
        <Chip testID="a11y-chip" label="Food & Dining" selected onPress={() => {}} />
        <ListRow
          testID="a11y-row"
          title="Coffee shop"
          subtitle="Food & Dining · 09:30"
          onPress={() => {}}
          showChevron
        />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(view.getByTestId('reduced-motion-flag').children.join('')).toBe('true');
    });

    const btn = view.getByTestId('a11y-btn');
    const btnStyle = StyleSheet.flatten(btn.props.style);
    expect(btn.props.accessibilityRole).toBe('button');
    expect(btn.props.accessibilityLabel).toBe('Save budget');
    expect(btnStyle.minHeight).toBeGreaterThanOrEqual(48);

    const chip = view.getByTestId('a11y-chip');
    const chipStyle = StyleSheet.flatten(chip.props.style);
    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(chipStyle.minHeight).toBeGreaterThanOrEqual(48);

    const rowText = view.getByText('Coffee shop');
    expect(rowText.props.allowFontScaling).not.toBe(false);
    expect(PixelRatio.getFontScale()).toBe(2.0);
  });

  it('renders friendly ErrorState when Overview DB read fails and recovers on Retry', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('currency', 'BDT');
    await repo.setBudget('2026-11-01', '', 4_000_000);
    const settings = await repo.getSettings();

    const listSpy = jest
      .spyOn(repo, 'listTransactionsInRange')
      .mockRejectedValueOnce(new Error('SQLite read failed'));

    const view = await render(
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings,
          updateSetting: async (k, v) => {
            await repo.setSetting(k, v);
          },
          refreshSettings: async () => {},
        }}
      >
        <ThemeProvider preference="dark">
          <OverviewContent todayOverride="2026-11-13" hourOverride={10} />
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => {
      expect(view.getByText(t('error.genericBody'))).toBeTruthy();
    });

    await fireEvent.press(view.getByText(t('common.retry')));

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(view.getByText(t('overview.leftToSpend'))).toBeTruthy();
    });
  });
});
