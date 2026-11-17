import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { DEFAULT_SETTINGS } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DateField } from './DateField';

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

function renderField(settings: Settings | null) {
  const field = <DateField testID="df" value="2026-11-13" today="2026-11-13" onChange={() => {}} />;
  const themed = <ThemeProvider preference="light">{field}</ThemeProvider>;
  if (settings === null) return render(themed);
  return render(
    <AppContext.Provider
      value={{
        repo: new MemoryRepo(),
        backend: 'memory',
        settings,
        updateSetting: async () => {},
        refreshSettings: async () => {},
      }}
    >
      {themed}
    </AppContext.Provider>
  );
}

/** The first weekday header of the open calendar: Sa (Saturday first) or Su, Mo and so on. */
async function firstHeader(settings: Settings | null): Promise<string> {
  setLocale('en');
  const view = await renderField(settings);
  await act(async () => {
    fireEvent.press(view.getByTestId('df'));
  });
  const heads = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
  const found = view
    .queryAllByText(/^(Sa|Su|Mo|Tu|We|Th|Fr)$/)
    .map((n) => String(n.props.children));
  expect(found).toHaveLength(7);
  expect(new Set(found)).toEqual(new Set(heads));
  return found[0];
}

describe('date pickers follow the effective week start', () => {
  it('starts on Monday when the setting says Monday', async () => {
    expect(await firstHeader({ ...DEFAULT_SETTINGS, weekStartDay: 1 })).toBe('Mo');
  });

  it('honours the older weekStartsOn when weekStartDay was never changed', async () => {
    expect(
      await firstHeader({ ...DEFAULT_SETTINGS, weekStartDay: 6, weekStartsOn: 'sunday' })
    ).toBe('Su');
  });

  it('keeps Saturday with no app context', async () => {
    expect(await firstHeader(null)).toBe('Sa');
  });
});
