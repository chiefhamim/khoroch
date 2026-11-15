import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { buildDefaultCategories } from '@/domain/categories';
import { formatMonthYear, formatShortDate, parseLocalDate, todayLocalDate } from '@/domain/dates';
import type { Account, Transaction } from '@/domain/types';
import { setLocale } from '@/i18n';
import { toBnDigits } from '@/i18n/displayText';
import { mapFontToBangla } from '@/theme/tokens';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { buildDescriptionSuggestions, FastTransactionEntry } from './FastTransactionEntry';

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const categories = buildDefaultCategories(1700000000000);
const cash: Account = {
  id: 'cash',
  name: 'Cash',
  kind: 'cash',
  provider: null,
  colorKey: 'green',
  monogram: null,
  last4: null,
  openingBalanceMinor: 0,
  openingDate: '2026-11-01',
  includeInTotal: true,
  sortOrder: 0,
  archivedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

function tx(id: string, description: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountMinor: 1_000,
    currency: 'BDT',
    categoryId: 'transportation',
    accountId: 'cash',
    transferId: null,
    description,
    note: '',
    occurredOn: '2026-11-13',
    occurredTime: '08:30',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe('buildDescriptionSuggestions', () => {
  it('ranks by how often a description is used and skips category-name fallbacks', () => {
    const rows = [
      tx('1', 'Snacks', { categoryId: 'food_dining' }),
      tx('2', 'Bus'),
      tx('3', 'bus'),
      tx('4', 'Transportation'),
      tx('5', 'Office salary', { type: 'income', categoryId: 'salary' }),
    ];
    const names = new Set(categories.map((c) => c.name));
    expect(buildDescriptionSuggestions(rows, 'expense', names).map((s) => s.description)).toEqual(['Bus', 'Snacks']);
    expect(buildDescriptionSuggestions(rows, 'income', names).map((s) => s.description)).toEqual(['Office salary']);
  });
});

describe('FastTransactionEntry', () => {
  it('logs money received with a description, wallet and the current time', async () => {
    const onSubmit = jest.fn(async () => {});
    const view = await render(
      <ThemeProvider preference="light">
        <FastTransactionEntry
          currency="BDT"
          categories={categories}
          accounts={[cash]}
          defaultAccountId="cash"
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByLabelText('Received'));
    await fireEvent.changeText(view.getByTestId('fast-description'), 'From wife for office');
    await fireEvent.press(view.getByLabelText('Digit 1'));
    await fireEvent.press(view.getByLabelText('Digit 3'));
    await fireEvent.press(view.getByLabelText('Digit 0'));
    await fireEvent.press(view.getByLabelText('Gift Received'));
    await fireEvent.press(view.getByTestId('fast-save'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'income',
        amountMinor: 13_000,
        categoryId: 'gift_received',
        accountId: 'cash',
        description: 'From wife for office',
        occurredOn: todayLocalDate(),
        occurredTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      })
    );
  });

  it('fills description and category from a suggestion', async () => {
    const onSubmit = jest.fn(async () => {});
    const view = await render(
      <ThemeProvider preference="light">
        <FastTransactionEntry
          currency="BDT"
          categories={categories}
          accounts={[cash]}
          recentTransactions={[tx('1', 'Bus fare')]}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByLabelText('Bus fare'));
    await fireEvent.press(view.getByLabelText('Digit 1'));
    await fireEvent.press(view.getByLabelText('Digit 0'));
    await fireEvent.press(view.getByTestId('fast-save'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', amountMinor: 1_000, description: 'Bus fare', categoryId: 'transportation' })
    );
  });

  it('uses Bangla fonts for description input and localizes When + Calendar sheet in Bangla', async () => {
    setLocale('bn');
    try {
      const view = await render(
        <ThemeProvider preference="dark">
          <FastTransactionEntry
            currency="BDT"
            categories={categories}
            accounts={[cash]}
            defaultAccountId="cash"
            onClose={jest.fn()}
            onSubmit={jest.fn(async () => {})}
          />
        </ThemeProvider>
      );

      const inputStyle = StyleSheet.flatten(view.getByTestId('fast-description').props.style);
      expect(inputStyle.fontFamily).toBe(mapFontToBangla('Manrope_600SemiBold'));
      expect(view.getByText(/আজ,/)).toBeTruthy();

      await fireEvent.press(view.getByTestId('fast-when'));
      const today = todayLocalDate();
      const { year, month } = parseLocalDate(today);
      expect(view.getByText(toBnDigits(formatMonthYear(year, month, 'bn')))).toBeTruthy();
      expect(view.getByText(toBnDigits(formatShortDate(today, 'bn')))).toBeTruthy();
      expect(view.getByText('মঙ্গল')).toBeTruthy();
      expect(view.getByText('বৃহঃ')).toBeTruthy();
    } finally {
      await act(async () => {
        setLocale('en');
      });
    }
  });
});
