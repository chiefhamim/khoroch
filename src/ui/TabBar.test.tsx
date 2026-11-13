import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { V2TabBar } from '@/app/(tabs)/_layout';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { computeTabBarHeight } from './Screen';

const mockPush = jest.fn();
const mockHapticLight = jest.fn();
const mockHapticMedium = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));

jest.mock('./haptics', () => ({
  hapticLight: () => mockHapticLight(),
  hapticMedium: () => mockHapticMedium(),
}));

describe('Phase 8 navigation shell (V2TabBar)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockHapticLight.mockClear();
    mockHapticMedium.mockClear();
  });

  function buildTabBarProps(activeIndex = 0) {
    const navigateToTab = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    return {
      props: {
        state: {
          key: 'tabs',
          index: activeIndex,
          routeNames: ['index', 'activity', 'budget', 'insights'],
          routes: [
            { key: 'r-index', name: 'index' },
            { key: 'r-activity', name: 'activity' },
            { key: 'r-budget', name: 'budget' },
            { key: 'r-insights', name: 'insights' },
          ],
          stale: false,
          type: 'tab' as const,
          history: [],
        },
        emitter: { emit },
        navigateToTab,
        descriptors: {},
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      } as unknown as React.ComponentProps<typeof V2TabBar>,
      navigateToTab,
      emit,
    };
  }

  it('computes tab bar height including safe-area inset + clearance', () => {
    expect(computeTabBarHeight(0)).toBe(76);
    expect(computeTabBarHeight(24)).toBe(90);
  });

  it('renders Home, Activity, Budget, Insights (no Settings tab) and routes center + tap vs long-press', async () => {
    const { props, navigateToTab, emit } = buildTabBarProps(0);

    const view = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 20, left: 0 }}>
        <ThemeProvider preference="light">
          <V2TabBar {...props} />
        </ThemeProvider>
      </SafeAreaInsetsContext.Provider>
    );

    expect(view.getByText('Home')).toBeTruthy();
    expect(view.getByText('Activity')).toBeTruthy();
    expect(view.getByText('Budget')).toBeTruthy();
    expect(view.getByText('Insights')).toBeTruthy();
    expect(view.queryByText('Settings')).toBeNull();

    const barStyle = StyleSheet.flatten(view.getByTestId('v2-tab-bar').props.style);
    expect(barStyle.height).toBe(86);

    await fireEvent.press(view.getByTestId('tab-item-budget'));
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'r-budget' })
    );
    expect(navigateToTab).toHaveBeenCalledWith('r-budget');

    await fireEvent.press(view.getByTestId('tab-add-button'));
    expect(mockHapticLight).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/transaction/new');

    await fireEvent(view.getByTestId('tab-add-button'), 'longPress');
    expect(mockHapticMedium).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/quick-entry');
  });
});
