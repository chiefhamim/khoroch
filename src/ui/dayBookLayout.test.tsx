import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { MemoryRepo } from '@/data/memoryRepo';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { DayBookView } from './DayBookView';
import { dayStripCellBounds, dayStripOffset, type DayStripLayout } from './dayStrip';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(cb, [cb]);
  },
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

/** Minimal shape of a rendered host element, enough to walk and read styles. */
type ReactTestInstance = {
  props: Record<string, unknown>;
  children: (ReactTestInstance | string)[];
  parent: ReactTestInstance | null;
};

function descendants(root: unknown, out: ReactTestInstance[] = []): ReactTestInstance[] {
  const node = root as ReactTestInstance;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function flat(root: unknown): Record<string, unknown> {
  const node = root as ReactTestInstance;
  return (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
}

async function renderDayBook() {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.setSetting('currency', 'BDT');
  const settings = await repo.getSettings();
  return render(
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
      <ThemeProvider preference="light">
        <DayBookView header={null} />
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('Day book layout', () => {
  it('keeps the balance card to one level: a plain KPI row, no tinted tiles inside', async () => {
    const view = await renderDayBook();
    const summary = await waitFor(() => view.getByTestId('daybook-summary'));
    const kpi = view.getByTestId('daybook-kpi-row');
    expect(kpi).toBeTruthy();
    // Nothing inside the card draws its own fill or border: no card inside the card.
    const tinted = descendants(summary).filter((n) => {
      const s = flat(n);
      const fill = s.backgroundColor;
      const isHairline = s.height === StyleSheet.hairlineWidth;
      const hasFill = typeof fill === 'string' && fill !== 'transparent' && !isHairline;
      return hasFill || (typeof s.borderWidth === 'number' && s.borderWidth > 0);
    });
    // The only drawn lines inside are the hairline dividers (borderLeftWidth), never a box.
    expect(tinted).toHaveLength(0);
    // Three columns, two hairline dividers.
    const dividers = descendants(kpi).filter((n) => flat(n).borderLeftWidth === StyleSheet.hairlineWidth);
    expect(dividers).toHaveLength(2);
  });

  it('shows the empty state on the page background with the Add icon and label in one row', async () => {
    const view = await renderDayBook();
    const empty = await waitFor(() => view.getByTestId('daybook-empty'));
    const s = flat(empty);
    expect(s.borderWidth).toBeUndefined();
    expect(s.backgroundColor).toBeUndefined();
    const addLabel = view.getByText('Add entry');
    const row = (addLabel as unknown as ReactTestInstance).parent as ReactTestInstance;
    expect(flat(row).flexDirection).toBe('row');
  });

  it('Button puts a leading icon and the label in one centred row container', async () => {
    const view = await render(
      <ThemeProvider preference="light">
        <Button testID="btn" title="Add" leftIcon="plus" onPress={() => undefined} />
      </ThemeProvider>
    );
    const content = view.getByTestId('btn-content');
    const style = flat(content);
    expect(style.flexDirection).toBe('row');
    expect(style.justifyContent).toBe('center');
    expect(style.alignItems).toBe('center');
    expect(descendants(content).some((n) => n.props.children === 'Add')).toBe(true);
    expect(view.getByText('Add').props.numberOfLines).toBe(1);
  });
});

describe('Day book date strip window', () => {
  const CELL = 48;
  const GAP = 4;
  const PAD = 12;
  const MARGIN = 16;
  for (const width of [360, 390, 411]) {
    it(`today's cell is fully visible on first render at ${width}dp`, () => {
      const layout: DayStripLayout = {
        count: 90,
        cell: CELL,
        gap: GAP,
        pad: PAD,
        viewport: width - 2 * MARGIN - 2,
      };
      const offset = dayStripOffset(layout, 89);
      const { left, right } = dayStripCellBounds(layout, 89, offset);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(layout.viewport);
      // The last cell ends exactly one padding from the right edge.
      expect(right).toBe(layout.viewport - PAD);
    });
  }

  it('snapped offsets start a cell exactly at the left padding', () => {
    const layout: DayStripLayout = { count: 90, cell: CELL, gap: GAP, pad: PAD, viewport: 328 };
    const offset = dayStripOffset(layout, 40);
    expect(offset % (CELL + GAP)).toBe(0);
    expect(dayStripCellBounds(layout, 40 - 3, offset).left).toBe(PAD);
  });
});
