import { create } from 'zustand';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/domain/categories';
import { ALL_REMINDER_DAYS, type CurrencyCode, type ReminderDays } from '@/domain/types';

export interface OnboardingDraftState {
  name: string;
  currency: CurrencyCode;
  monthStartDay: number;
  budgetInput: string;
  selectedCategoryIds: string[];
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: ReminderDays;
  setName: (name: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setMonthStartDay: (day: number) => void;
  setBudgetInput: (input: string) => void;
  toggleCategory: (id: string) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderDays: (days: ReminderDays) => void;
  reset: () => void;
}

const DEFAULT_SELECTED = DEFAULT_EXPENSE_CATEGORIES.slice(0, 10).map((c) => c.id);

export const useOnboardingDraft = create<OnboardingDraftState>((set) => ({
  name: '',
  currency: 'BDT',
  monthStartDay: 1,
  budgetInput: '',
  selectedCategoryIds: DEFAULT_SELECTED,
  reminderEnabled: true,
  reminderTime: '21:00',
  reminderDays: [...ALL_REMINDER_DAYS],
  setName: (name) => set({ name }),
  setCurrency: (currency) => set({ currency }),
  setMonthStartDay: (monthStartDay) => set({ monthStartDay }),
  setBudgetInput: (budgetInput) => set({ budgetInput }),
  toggleCategory: (id) =>
    set((s) => ({
      selectedCategoryIds: s.selectedCategoryIds.includes(id)
        ? s.selectedCategoryIds.filter((item) => item !== id)
        : [...s.selectedCategoryIds, id],
    })),
  setReminderEnabled: (reminderEnabled) => set({ reminderEnabled }),
  setReminderTime: (reminderTime) => set({ reminderTime }),
  setReminderDays: (reminderDays) => set({ reminderDays }),
  reset: () =>
    set({
      name: '',
      currency: 'BDT',
      monthStartDay: 1,
      budgetInput: '',
      selectedCategoryIds: DEFAULT_SELECTED,
      reminderEnabled: true,
      reminderTime: '21:00',
      reminderDays: [...ALL_REMINDER_DAYS],
    }),
}));
