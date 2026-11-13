import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import EditTransactionScreen from '@/app/transaction/[id]';
import { MemoryRepo } from '@/data/memoryRepo';
import { buildDefaultCategories } from '@/domain/categories';
import type { Transaction } from '@/domain/types';
import { isValidLocalTime } from '@/domain/validation';
import { DEFAULT_SETTINGS } from '@/data/repo';
import { t } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from './Toast';
import {
  buildContextualSuggestions,
  formatHeroAmountText,
  orderCategoriesForPicker,
  TransactionForm,
} from './TransactionForm';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'tx-edit-1' }),
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

const mockAndroidOpen = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: {
    open: (opts: unknown) => mockAndroidOpen(opts),
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

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx-1',
    type: overrides.type ?? 'expense',
    amountMinor: overrides.amountMinor ?? 50_000,
    currency: 'BDT',
    categoryId: overrides.categoryId ?? 'food_dining',
    accountId: overrides.accountId ?? null,
    transferId: overrides.transferId ?? null,
    description: overrides.description ?? 'Lunch',
    note: '',
    occurredOn: overrides.occurredOn ?? '2026-11-12',
    occurredTime: overrides.occurredTime ?? '12:30',
    source: 'manual',
    createdAt: overrides.createdAt ?? 1700000000000,
    updatedAt: overrides.updatedAt ?? 1700000000000,
    deletedAt: overrides.deletedAt ?? null,
  };
}

describe('Phase 9 TransactionForm helpers & flows', () => {
  const categories = buildDefaultCategories(1700000000000);

  beforeEach(() => {
    mockAndroidOpen.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockReplace.mockReset();
  });

  it('orders most-recently-used category first without auto-selecting any', () => {
    const recentTxs: Transaction[] = [
      makeTx({ id: 't1', categoryId: 'transportation', occurredOn: '2026-11-10', createdAt: 100 }),
      makeTx({ id: 't2', categoryId: 'transportation', occurredOn: '2026-11-11', createdAt: 200 }),
      makeTx({ id: 't3', categoryId: 'utilities', occurredOn: '2026-11-13', createdAt: 300 }),
    ];

    const ordered = orderCategoriesForPicker(categories, 'expense', recentTxs);
    expect(ordered[0].id).toBe('utilities'); // most recent
    expect(ordered[1].id).toBe('transportation'); // next most frequently used
    expect(ordered.every((c) => c.kind === 'expense')).toBe(true);
  });

  it('filters suggestions strictly by type and category without cross-pollination', () => {
    const recentTxs: Transaction[] = [
      makeTx({ id: 'e1', type: 'expense', categoryId: 'transportation', description: 'Uber to office' }),
      makeTx({ id: 'e2', type: 'expense', categoryId: 'food_dining', description: 'Biryani lunch' }),
      makeTx({ id: 'i1', type: 'income', categoryId: 'salary', description: 'October salary' }),
    ];

    const foodSuggestions = buildContextualSuggestions('expense', 'food_dining', recentTxs);
    expect(foodSuggestions[0]).toBe('Biryani lunch');
    expect(foodSuggestions).not.toContain('Uber to office');
    expect(foodSuggestions).not.toContain('October salary');

    const salarySuggestions = buildContextualSuggestions('income', 'salary', recentTxs);
    expect(salarySuggestions[0]).toBe('October salary');
    expect(salarySuggestions).not.toContain('Biryani lunch');
    expect(salarySuggestions).not.toContain('Uber to office');

    expect(formatHeroAmountText('')).toBe('0');
    expect(formatHeroAmountText('12500.5')).toBe('12,500.5');
  });

  it('keeps Save disabled until positive amount AND category are chosen, and auto-fills time on new', async () => {
    const onSubmit = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          currency="BDT"
          categories={categories}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    const saveBtn = view.getByTestId('save-tx-button');
    expect(saveBtn.props.accessibilityState.disabled).toBe(true);

    // Type 350 via custom keypad — still disabled because NO category is preselected
    await fireEvent.press(view.getByTestId('tx-keypad-key-3'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-5'));
    await fireEvent.press(view.getByTestId('tx-keypad-key-0'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(true);

    // Select Food & Dining
    await fireEvent.press(view.getByTestId('cat-chip-food_dining'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(false);

    // Switch type to Income — resets category so Save returns to disabled
    await fireEvent.press(view.getByText('Income'));
    expect(view.getByTestId('save-tx-button').props.accessibilityState.disabled).toBe(true);

    // Switch back to Expense, pick Food & Dining, fill description chip, submit
    await fireEvent.press(view.getByText('Expense'));
    await fireEvent.press(view.getByTestId('cat-chip-food_dining'));
    await fireEvent.press(view.getByTestId('suggestion-chip-0'));
    await fireEvent.press(view.getByTestId('save-tx-button'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = (onSubmit.mock.calls as unknown[][])[0][0] as {
      type: string;
      amountMinor: number;
      categoryId: string | null;
      occurredTime: string | null;
    };
    expect(submitted.type).toBe('expense');
    expect(submitted.amountMinor).toBe(35_000);
    expect(submitted.categoryId).toBe('food_dining');
    expect(typeof submitted.occurredTime).toBe('string');
    expect(isValidLocalTime(submitted.occurredTime ?? '')).toBe(true);
  });

  it('prevents duplicate submissions on rapid double-tap', async () => {
    let resolveSubmit: () => void = () => {};
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          mode="new"
          currency="USD"
          categories={categories}
          initialValues={{ amountMinor: 2_500, categoryId: 'groceries' }}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    const btn = view.getByTestId('save-tx-button');
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit();
    });
  });

  it('supports All sheet selection, inline + New category creation, note toggle, and keypad hide/return', async () => {
    const onCreateCategory = jest.fn(async (input) => ({
      id: 'custom_pets_1',
      name: input.name,
      icon: input.icon,
      colorKey: input.colorKey,
      kind: input.kind,
      sortOrder: 99,
      isSelected: true,
      archivedAt: null,
      createdAt: 1700000005000,
    }));

    const view = await render(
      <ThemeProvider preference="dark">
        <TransactionForm
          mode="new"
          currency="BDT"
          categories={categories}
          onClose={jest.fn()}
          onCreateCategory={onCreateCategory}
          onSubmit={jest.fn(async () => {})}
        />
      </ThemeProvider>
    );

    // Focus description hides Keypad; tapping hero amount brings Keypad back
    expect(view.getByTestId('tx-keypad')).toBeTruthy();
    await fireEvent(view.getByTestId('description-input'), 'focus');
    expect(view.queryByTestId('tx-keypad')).toBeNull();
    await fireEvent.press(view.getByTestId('tx-hero-amount'));
    expect(view.getByTestId('tx-keypad')).toBeTruthy();

    // "+ Add a note" opens note field
    await fireEvent.press(view.getByTestId('tx-add-note-toggle'));
    expect(view.getByTestId('note-input')).toBeTruthy();

    // Open All sheet and select a category beyond first 7 ("travel")
    await fireEvent.press(view.getByTestId('cat-all-button'));
    expect(view.getByTestId('all-categories-sheet')).toBeTruthy();
    await fireEvent.press(view.getByTestId('cat-sheet-item-travel'));
    expect(view.queryByTestId('all-categories-sheet')).toBeNull();
    expect(view.getByTestId('cat-chip-travel')).toBeTruthy();

    // Re-open All and create a custom category inline
    await fireEvent.press(view.getByTestId('cat-all-button'));
    await fireEvent.press(view.getByTestId('new-category-open-button'));
    await fireEvent.changeText(view.getByTestId('new-category-name-input'), 'Pets');
    await fireEvent.press(view.getByTestId('new-category-save-button'));

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledTimes(1));
    expect(onCreateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pets', kind: 'expense' })
    );
  });

  it('wires native Android DateTimePickerAndroid callbacks on DateField and TimeField', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    const onSubmit = jest.fn(async () => {});

    try {
      const view = await render(
        <ThemeProvider preference="light">
          <TransactionForm
            mode="edit"
            currency="BDT"
            categories={categories}
            initialValues={{
              type: 'expense',
              amountMinor: 50_000,
              categoryId: 'utilities',
              occurredOn: '2026-11-10',
              occurredTime: null,
            }}
            onClose={jest.fn()}
            onSubmit={onSubmit}
          />
        </ThemeProvider>
      );

      // Edit mode preserves null occurredTime and displays 'Add time'
      expect(view.getByText('Add time')).toBeTruthy();

      await fireEvent.press(view.getByTestId('tx-date-field'));
      expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
      const dateOpts = mockAndroidOpen.mock.calls[0][0] as {
        onChange: (e: { type?: string }, d?: Date) => void;
      };
      await act(async () => {
        dateOpts.onChange({ type: 'set' }, new Date(2026, 10, 9, 12, 0, 0));
      });

      await fireEvent.press(view.getByTestId('tx-time-field'));
      expect(mockAndroidOpen).toHaveBeenCalledTimes(2);
      const timeOpts = mockAndroidOpen.mock.calls[1][0] as {
        onChange: (e: { type?: string }, d?: Date) => void;
      };
      const pickedTime = new Date(2026, 10, 9, 18, 45, 0);
      await act(async () => {
        timeOpts.onChange({ type: 'set' }, pickedTime);
      });

      await fireEvent.press(view.getByTestId('save-tx-button'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          occurredOn: '2026-11-09',
          occurredTime: '18:45',
        })
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => originalOS, configurable: true });
    }
  });

  it('EditTransactionScreen deletes via ⋯ action sheet and confirmation sheet', async () => {
    const repo = new MemoryRepo();
    await repo.insertTransaction({
      id: 'tx-edit-1',
      type: 'expense',
      amountMinor: 42_000,
      currency: 'BDT',
      categoryId: 'food_dining',
      description: 'Tea & snacks',
      occurredOn: '2026-11-12',
      occurredTime: '16:10',
    });

    const view = await render(
      <AppContext.Provider
        value={{
          repo,
          backend: 'memory',
          settings: DEFAULT_SETTINGS,
          updateSetting: async () => {},
          refreshSettings: async () => {},
        }}
      >
        <ThemeProvider preference="light">
          <ToastProvider>
            <EditTransactionScreen />
          </ToastProvider>
        </ThemeProvider>
      </AppContext.Provider>
    );

    await waitFor(() => expect(view.getByTestId('tx-more-button')).toBeTruthy());

    // Open ⋯ action menu -> Delete transaction -> Confirm Delete
    await fireEvent.press(view.getByTestId('tx-more-button'));
    expect(view.getByTestId('tx-more-sheet')).toBeTruthy();

    await fireEvent.press(view.getByTestId('tx-action-delete'));
    expect(view.getByTestId('tx-delete-confirm-sheet')).toBeTruthy();
    expect(view.getByText(t('tx.deleteConfirmTitle'))).toBeTruthy();

    await fireEvent.press(view.getByTestId('tx-confirm-delete-button'));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));

    const after = await repo.getTransaction('tx-edit-1');
    expect(after?.deletedAt).not.toBeNull();
  });
});
