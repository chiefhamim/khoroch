import React from 'react';
import { render } from '@testing-library/react-native';
import { setLocale } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { SpendingChart, type ChartGranularity } from './SpendingChart';

const period = (start: string, endExcl: string) => ({ start, endExcl }) as never;

function renderChart(granularity: ChartGranularity, spent: number[], income: number[] = []) {
  return render(
    <ThemeProvider preference="light">
      <SpendingChart
        currency="BDT"
        granularity={granularity}
        daily={spent.map((spentMinor, i) => ({ day: `2026-11-0${i + 1}`, spentMinor }))}
        weekly={[]}
        monthly={spent.map((spentMinor, i) => ({
          period: period(`2026-0${i + 1}-01`, `2026-0${i + 2}-01`),
          spentMinor,
          incomeMinor: income[i] ?? 0,
        }))}
      />
    </ThemeProvider>
  );
}

describe('SpendingChart low-data states', () => {
  afterEach(() => setLocale('en'));

  it('says there is one day of spending, not a first entry, for a single spending day', async () => {
    const view = await renderChart('daily', [12_000]);
    expect(view.getByText('One day of spending so far')).toBeTruthy();
    expect(view.queryByText('First entry')).toBeNull();
  });

  it('does not count an income-only month as spending activity', async () => {
    const view = await renderChart('monthly', [0, 0], [50_000, 70_000]);
    expect(view.getByText('No entries yet')).toBeTruthy();
  });

  it('uses the Bangla caption for one spending day', async () => {
    setLocale('bn');
    const view = await renderChart('daily', [12_000]);
    expect(view.getByText('এখন পর্যন্ত একদিনের খরচ রয়েছে')).toBeTruthy();
  });
});
