import { create } from 'zustand';
import { WALLET_PRESETS, type WalletPresetKey } from '@/domain/accounts';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/domain/categories';
import { ALL_REMINDER_DAYS, type CurrencyCode, type ReminderDays } from '@/domain/types';

export interface OnboardingWalletDraft {
  presetKey: WalletPresetKey;
  enabled: boolean;
  name: string;
  balanceInput: string;
  isDueNegative: boolean;
  last4: string;
  includeInTotal: boolean;
}

function buildDefaultWalletDrafts(): OnboardingWalletDraft[] {
  return WALLET_PRESETS.filter((p) => p.key !== 'cellfin').map((preset) => ({
    presetKey: preset.key,
    enabled: false,
    name: preset.name,
    balanceInput: '',
    isDueNegative: false,
    last4: '',
    includeInTotal: preset.defaultIncludeInTotal,
  }));
}

export interface OnboardingDraftState {
  name: string;
  currency: CurrencyCode;
  monthStartDay: number;
  budgetInput: string;
  selectedCategoryIds: string[];
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: ReminderDays;
  walletDrafts: OnboardingWalletDraft[];
  setName: (name: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setMonthStartDay: (day: number) => void;
  setBudgetInput: (input: string) => void;
  toggleCategory: (id: string) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderDays: (days: ReminderDays) => void;
  toggleWalletPreset: (presetKey: WalletPresetKey) => void;
  updateWalletDraft: (
    presetKey: WalletPresetKey,
    patch: Partial<OnboardingWalletDraft>
  ) => void;
  skipAllWallets: () => void;
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
  walletDrafts: buildDefaultWalletDrafts(),
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
  toggleWalletPreset: (presetKey) =>
    set((s) => ({
      walletDrafts: s.walletDrafts.map((w) =>
        w.presetKey === presetKey ? { ...w, enabled: !w.enabled } : w
      ),
    })),
  updateWalletDraft: (presetKey, patch) =>
    set((s) => ({
      walletDrafts: s.walletDrafts.map((w) =>
        w.presetKey === presetKey ? { ...w, ...patch } : w
      ),
    })),
  skipAllWallets: () =>
    set((s) => ({
      walletDrafts: s.walletDrafts.map((w) => ({ ...w, enabled: false })),
    })),
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
      walletDrafts: buildDefaultWalletDrafts(),
    }),
}));
