import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import CategoriesScreen from '@/app/settings/categories';
import { MemoryRepo } from '@/data/memoryRepo';
import type { Category } from '@/domain/types';
import { setLocale } from '@/i18n';
import { AppContext } from '@/state/AppContext';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui/Toast';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: jest.fn(),
    canGoBack: () => mockCanGoBack,
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => '12345678-90ab-cdef-1234-567890abcdef',
}));

jest.mock('react-native-safe-area-context', () => {
  const reactMod = jest.requireActual<typeof import('react')>('react');
  const rnMod = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) =>
      reactMod.createElement(rnMod.View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

function makeCategory(overrides: Partial<Category> & { id: string; name: string }): Category {
  return {
    icon: 'utensils',
    colorKey: 'orange',
    kind: 'expense',
    sortOrder: 1,
    isSelected: true,
    archivedAt: null,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

async function setupCategoriesRepo(): Promise<MemoryRepo> {
  const repo = new MemoryRepo();
  await repo.setSetting('onboardingDone', true);
  await repo.upsertCategory(
    makeCategory({ id: 'food_dining', name: 'Food & Dining', sortOrder: 1 })
  );
  await repo.upsertCategory(
    makeCategory({
      id: 'groceries',
      name: 'Groceries',
      icon: 'shopping-basket',
      colorKey: 'green',
      sortOrder: 2,
    })
  );
  await repo.upsertCategory(
    makeCategory({
      id: 'other',
      name: 'Other',
      icon: 'shapes',
      colorKey: 'gray',
      sortOrder: 16,
    })
  );
  await repo.upsertCategory(
    makeCategory({
      id: 'salary',
      name: 'Salary',
      icon: 'banknote',
      colorKey: 'teal',
      kind: 'income',
      sortOrder: 101,
    })
  );
  return repo;
}

async function renderCategories(repo: MemoryRepo) {
  const settings = await repo.getSettings();
  return render(
    <AppContext.Provider
      value={{
        repo,
        backend: 'memory',
        settings,
        refreshSettings: async () => {},
        updateSetting: async () => {},
      }}
    >
      <ThemeProvider preference="dark">
        <ToastProvider>
          <CategoriesScreen />
        </ToastProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
}

describe('CategoriesScreen', () => {
  beforeEach(() => {
    setLocale('en');
    mockCanGoBack = true;
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    cleanup();
    setLocale('en');
  });

  it('validates, creates, edits, archives, restores categories, and uses back fallback', async () => {
    const repo = await setupCategoriesRepo();
    const view = await renderCategories(repo);

    await waitFor(() => {
      expect(view.getByText('Categories')).toBeTruthy();
      expect(view.getByText('Food & Dining')).toBeTruthy();
    });

    await fireEvent.press(view.getByLabelText('Income'));
    await waitFor(() => {
      expect(view.getByText('Salary')).toBeTruthy();
    });
    await fireEvent.press(view.getByLabelText('Expense'));
    await waitFor(() => {
      expect(view.getByText('Groceries')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('categories-add-button'));
    await waitFor(() => {
      expect(view.getByTestId('category-name-input')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('category-save-button'));
    await waitFor(() => {
      expect(view.getByTestId('category-name-error')).toBeTruthy();
    });

    await fireEvent.changeText(view.getByTestId('category-name-input'), 'Tea & Snacks');
    await fireEvent.press(view.getByTestId('cat-color-teal'));
    await fireEvent.press(view.getByTestId('category-save-button'));

    await waitFor(() => {
      expect(view.getByText('Tea & Snacks')).toBeTruthy();
    });

    // Protected category 'other' cannot be archived.
    await fireEvent.press(view.getByTestId('cat-tile-other'));
    await waitFor(() => {
      expect(view.getByTestId('category-name-input')).toBeTruthy();
    });
    expect(view.queryByTestId('category-archive-button')).toBeNull();

    // Archive and restore custom/normal category 'groceries'.
    await fireEvent.press(view.getByTestId('cat-tile-groceries'));
    await waitFor(() => {
      expect(view.getByTestId('category-archive-button')).toBeTruthy();
    });
    await fireEvent.press(view.getByTestId('category-archive-button'));
    await waitFor(() => {
      expect(view.getByTestId('category-archive-confirm-btn')).toBeTruthy();
    });
    await fireEvent.press(view.getByTestId('category-archive-confirm-btn'));

    await waitFor(() => {
      expect(view.getByText('ARCHIVED')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('cat-tile-groceries'));
    await waitFor(() => {
      expect(view.getByTestId('category-restore-button')).toBeTruthy();
    });
    await fireEvent.press(view.getByTestId('category-restore-button'));

    await waitFor(() => {
      expect(view.queryByText('ARCHIVED')).toBeNull();
    });

    mockCanGoBack = false;
    await fireEvent.press(view.getByTestId('categories-back'));
    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('localizes Categories header, segmented tabs, archived label, and sheet copy in Bangla', async () => {
    const repo = await setupCategoriesRepo();
    await repo.archiveCategory('groceries');
    await repo.setSetting('language', 'bn');
    setLocale('bn');

    const view = await renderCategories(repo);

    await waitFor(() => {
      expect(view.getByText('ক্যাটাগরিসমূহ')).toBeTruthy();
      expect(view.getByLabelText('খরচ')).toBeTruthy();
      expect(view.getByLabelText('আয়')).toBeTruthy();
      expect(view.getByText('আর্কাইভড')).toBeTruthy();
    });

    await fireEvent.press(view.getByTestId('cat-tile-groceries'));
    await waitFor(() => {
      expect(view.getByText('ক্যাটাগরি এডিট')).toBeTruthy();
      expect(view.getByText('কুইক চিপসে দেখান')).toBeTruthy();
      expect(view.getByTestId('category-restore-button')).toBeTruthy();
    });
  });
});
