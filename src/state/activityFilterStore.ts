import { create } from 'zustand';
import type { LocalDate, TransactionType } from '@/domain/types';

export type ActivityDatePreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface ActivityFilterValues {
  search: string;
  type: TransactionType | null;
  categoryId: string | null;
  categoryIds: string[];
  accountId: string | null | undefined;
  datePreset: ActivityDatePreset;
  customFromIncl: LocalDate | '';
  customToIncl: LocalDate | '';
  minAmountText: string;
  maxAmountText: string;
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilterValues = {
  search: '',
  type: null,
  categoryId: null,
  categoryIds: [],
  accountId: undefined,
  datePreset: 'all',
  customFromIncl: '',
  customToIncl: '',
  minAmountText: '',
  maxAmountText: '',
};

interface ActivityFilterStore extends ActivityFilterValues {
  setSearch: (search: string) => void;
  setType: (type: TransactionType | null) => void;
  setCategoryId: (categoryId: string | null) => void;
  setCategoryIds: (categoryIds: string[]) => void;
  setAccountId: (accountId: string | null | undefined) => void;
  setDatePreset: (preset: ActivityDatePreset) => void;
  setCustomFromIncl: (date: string) => void;
  setCustomToIncl: (date: string) => void;
  setMinAmountText: (val: string) => void;
  setMaxAmountText: (val: string) => void;
  applyExternalFilters: (patch: Partial<ActivityFilterValues>) => void;
  resetAll: () => void;
}

export const useActivityFilterStore = create<ActivityFilterStore>((set) => ({
  ...DEFAULT_ACTIVITY_FILTERS,
  setSearch: (search) => set({ search }),
  setType: (type) => set({ type }),
  setCategoryId: (categoryId) =>
    set({
      categoryId,
      categoryIds: categoryId ? [categoryId] : [],
    }),
  setCategoryIds: (categoryIds) =>
    set({
      categoryIds,
      categoryId: categoryIds.length === 1 ? categoryIds[0] : null,
    }),
  setAccountId: (accountId) => set({ accountId }),
  setDatePreset: (datePreset) => set({ datePreset }),
  setCustomFromIncl: (customFromIncl) => set({ customFromIncl: customFromIncl as LocalDate | '' }),
  setCustomToIncl: (customToIncl) => set({ customToIncl: customToIncl as LocalDate | '' }),
  setMinAmountText: (minAmountText) => set({ minAmountText }),
  setMaxAmountText: (maxAmountText) => set({ maxAmountText }),
  applyExternalFilters: (patch) => {
    const resolvedCategoryIds =
      patch.categoryIds !== undefined
        ? patch.categoryIds
        : patch.categoryId
          ? [patch.categoryId]
          : [];
    const resolvedCategoryId =
      patch.categoryId !== undefined
        ? patch.categoryId
        : resolvedCategoryIds.length === 1
          ? resolvedCategoryIds[0]
          : null;
    set({
      ...DEFAULT_ACTIVITY_FILTERS,
      ...patch,
      categoryIds: resolvedCategoryIds,
      categoryId: resolvedCategoryId,
    });
  },
  resetAll: () => set({ ...DEFAULT_ACTIVITY_FILTERS }),
}));
