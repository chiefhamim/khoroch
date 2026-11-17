import React, { useState } from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { buildDefaultCategories } from '@/domain/categories';
import type { Account, PinnedAmounts, Transaction } from '@/domain/types';
import { usePrivacyStore } from '@/state/privacyStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { TransactionForm, type TransactionFormValues } from '@/ui/TransactionForm';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
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

const categories = buildDefaultCategories(1700000000000);

const cash: Account = {
  id: 'acc_cash',
  name: 'Cash',
  kind: 'cash',
  provider: null,
  colorKey: '#123227',
  monogram: null,
  last4: null,
  openingBalanceMinor: 0,
  openingDate: '2026-11-10',
  includeInTotal: true,
  sortOrder: 0,
  archivedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const lunch: Transaction = {
  id: 'tx-lunch',
  type: 'expense',
  amountMinor: 35_000,
  currency: 'BDT',
  categoryId: 'food_dining',
  accountId: 'acc_cash',
  transferId: null,
  description: 'Lunch',
  note: 'with team',
  occurredOn: '2026-11-12',
  occurredTime: '13:00',
  source: 'manual',
  createdAt: 10,
  updatedAt: 10,
  deletedAt: null,
};

function Harness({
  onSubmit,
  recent,
  initialPinned,
}: {
  onSubmit: (v: TransactionFormValues) => Promise<void>;
  recent: Transaction[];
  initialPinned: PinnedAmounts;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  return (
    <ThemeProvider preference="light">
      <TransactionForm
        mode="new"
        fastEntry
        currency="BDT"
        categories={categories}
        accounts={[cash]}
        recentTransactions={recent}
        initialValues={{ categoryId: 'food_dining' }}
        pinnedAmounts={pinned}
        onPinnedAmountsChange={setPinned}
        onSubmit={onSubmit}
      />
    </ThemeProvider>
  );
}

describe('Capture shortcuts on the add-entry screen', () => {
  it('always shows the one shortcuts row with the Quick amounts chip, whatever is typed', async () => {
    const view = await render(
      <Harness onSubmit={jest.fn(async () => {})} recent={[]} initialPinned={{ expense: [], income: [] }} />
    );
    expect(view.getByTestId('capture-shortcuts')).toBeTruthy();
    expect(view.getByTestId('preset-open')).toBeTruthy();
    expect(view.queryByTestId('preset-pin')).toBeNull();

    await fireEvent.press(view.getByTestId('fast-keypad-key-2'));
    await fireEvent.press(view.getByTestId('fast-keypad-key-5'));
    expect(view.getAllByTestId('capture-shortcuts')).toHaveLength(1);
    expect(view.getByTestId('preset-open')).toBeTruthy();
    // Typing adds no pin button above the keypad: pinning lives in the sheet.
    expect(view.queryByTestId('preset-pin')).toBeNull();
  });

  it('keeps amounts readable in the row when the app hides amounts', async () => {
    await act(async () => usePrivacyStore.setState({ hideAmounts: true }));
    try {
      const view = await render(
        <Harness onSubmit={jest.fn(async () => {})} recent={[lunch]} initialPinned={{ expense: [50_000], income: [] }} />
      );
      expect(view.getByTestId('repeat-chip-tx-lunch').props.accessibilityLabel).toContain('350');
      expect(view.getByTestId('preset-50000').props.accessibilityLabel).toContain('500');
      // The typed amount hero is hidden app-wide, but the shortcuts row must not be.
      const row = within(view.getByTestId('capture-shortcuts'));
      expect(row.queryAllByText('Hidden')).toHaveLength(0);
    } finally {
      await act(async () => usePrivacyStore.setState({ hideAmounts: false }));
    }
  });

  it('fills the form from a repeat chip without saving, then saves on Save', async () => {
    const onSubmit = jest.fn(async () => {});
    const view = await render(
      <Harness onSubmit={onSubmit} recent={[lunch]} initialPinned={{ expense: [], income: [] }} />
    );
    expect(view.getByTestId('fast-save').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(view.getByTestId('repeat-chip-tx-lunch'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByTestId('fast-save').props.accessibilityState.disabled).toBe(false);
    expect(view.getByDisplayValue('Lunch')).toBeTruthy();
    expect(view.getByDisplayValue('with team')).toBeTruthy();

    await fireEvent.press(view.getByTestId('fast-save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amountMinor: 35_000,
        categoryId: 'food_dining',
        accountId: 'acc_cash',
        description: 'Lunch',
        note: 'with team',
      })
    );
  });

  it('sets the amount from a pinned amount chip and saves it', async () => {
    const onSubmit = jest.fn(async () => {});
    const view = await render(
      <Harness onSubmit={onSubmit} recent={[]} initialPinned={{ expense: [50_000], income: [] }} />
    );

    await fireEvent.press(view.getByTestId('preset-50000'));
    await fireEvent.press(view.getByTestId('fast-save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 50_000 }));
  });

  it('disables pinning in the sheet and says why when nothing is typed', async () => {
    const view = await render(
      <Harness onSubmit={jest.fn(async () => {})} recent={[]} initialPinned={{ expense: [], income: [] }} />
    );

    // Nothing typed: the pin button is disabled and says why.
    await fireEvent.press(view.getByTestId('preset-open'));
    expect(view.getByTestId('preset-pin').props.accessibilityState.disabled).toBe(true);
    expect(view.getByText('Type an amount to pin it')).toBeTruthy();
  });

  it('pins and removes through the sheet once an amount is typed', async () => {
    const view = await render(
      <Harness onSubmit={jest.fn(async () => {})} recent={[]} initialPinned={{ expense: [], income: [] }} />
    );
    await fireEvent.press(view.getByTestId('fast-keypad-key-2'));
    await fireEvent.press(view.getByTestId('fast-keypad-key-5'));
    await fireEvent.press(view.getByTestId('fast-keypad-key-0'));

    await fireEvent.press(view.getByTestId('preset-open'));
    expect(view.getByTestId('preset-pin').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(view.getByTestId('preset-pin'));

    expect(view.getByTestId('preset-25000')).toBeTruthy();
    expect(view.getByTestId('preset-row-25000')).toBeTruthy();
    // Already pinned now: the button is disabled and the reason is shown.
    expect(view.getByTestId('preset-pin').props.accessibilityState.disabled).toBe(true);
    expect(view.getByText('This amount is already pinned')).toBeTruthy();

    await fireEvent.press(view.getByTestId('preset-remove-25000'));
    await waitFor(() => expect(view.queryByTestId('preset-25000')).toBeNull());
  });

  it('explains the four-amount limit in the sheet', async () => {
    const view = await render(
      <Harness
        onSubmit={jest.fn(async () => {})}
        recent={[]}
        initialPinned={{ expense: [100, 200, 300, 400], income: [] }}
      />
    );
    await fireEvent.press(view.getByTestId('fast-keypad-key-7'));
    await fireEvent.press(view.getByTestId('preset-open'));
    expect(view.getByTestId('preset-pin').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('preset-pin-reason')).toBeTruthy();
  });
});
