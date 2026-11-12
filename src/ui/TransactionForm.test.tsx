import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { buildDefaultCategories } from '@/domain/categories';
import { t } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ConfirmModal } from './ConfirmModal';
import { TransactionForm } from './TransactionForm';

jest.mock('@expo/vector-icons', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  const Icon = ({ name }: { name: string }) => reactMod.createElement(rnMod.Text, null, name);
  Icon.glyphMap = {
    restaurant: 1,
    cart: 1,
    car: 1,
    'bag-handle': 1,
    home: 1,
    flash: 1,
    medkit: 1,
    film: 1,
    school: 1,
    airplane: 1,
    repeat: 1,
    sparkles: 1,
    people: 1,
    gift: 1,
    'ellipsis-horizontal': 1,
    cash: 1,
    briefcase: 1,
    wallet: 1,
    'backspace-outline': 1,
  };
  return { Ionicons: Icon };
});

describe('TransactionForm', () => {
  const categories = buildDefaultCategories(1700000000000);

  it('prevents double-submit on rapid double-tap Save', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          currency="BDT"
          categories={categories}
          recentDescriptions={['Lunch']}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.changeText(view.getByTestId('amount-input'), '350');
    await fireEvent.changeText(view.getByTestId('description-input'), 'Lunch');

    const saveBtn = view.getByTestId('save-tx-button');
    await fireEvent.press(saveBtn);
    await fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expense',
        amountMinor: 35000,
        description: 'Lunch',
      })
    );

    await act(async () => {
      resolveSubmit();
    });
  });

  it('shows inline validation error for zero amount while preserving user input', async () => {
    const onSubmit = jest.fn(async () => {});

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          currency="BDT"
          categories={categories}
          recentDescriptions={[]}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.changeText(view.getByTestId('amount-input'), '0');
    await fireEvent.changeText(view.getByTestId('description-input'), 'Rickshaw fare');
    await fireEvent.press(view.getByTestId('save-tx-button'));

    expect(await view.findByText(t('tx.errorInvalidAmount'))).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByTestId('amount-input').props.value).toBe('0');
    expect(view.getByTestId('description-input').props.value).toBe('Rickshaw fare');
  });

  it('keeps form inputs intact when save fails so user can retry', async () => {
    const onSubmit = jest
      .fn<Promise<void>, [unknown]>()
      .mockRejectedValueOnce(new Error('DB busy'))
      .mockResolvedValueOnce(undefined);

    const view = await render(
      <ThemeProvider preference="light">
        <TransactionForm
          currency="USD"
          categories={categories}
          recentDescriptions={[]}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    );

    await fireEvent.changeText(view.getByTestId('amount-input'), '12.50');
    await fireEvent.changeText(view.getByTestId('description-input'), 'Coffee');
    await fireEvent.press(view.getByTestId('save-tx-button'));

    expect(await view.findByText(t('tx.errorSaveFailed'))).toBeTruthy();
    expect(view.getByTestId('amount-input').props.value).toBe('12.50');
    expect(view.getByTestId('description-input').props.value).toBe('Coffee');

    await fireEvent.press(view.getByTestId('save-tx-button'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });
});

describe('ConfirmModal delete confirmation', () => {
  it('calls onCancel without deleting, and calls onConfirm when confirmed', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    const view = await render(
      <ThemeProvider preference="light">
        <ConfirmModal
          visible
          title={t('tx.deleteConfirmTitle')}
          body={t('tx.deleteConfirmBody')}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          destructive
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </ThemeProvider>
    );

    await fireEvent.press(view.getByText(t('common.cancel')));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText(t('common.delete')));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
