import { create } from 'zustand';

interface PrivacyStore {
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  setHideAmounts: (hide: boolean) => void;
}

export const usePrivacyStore = create<PrivacyStore>((set) => ({
  hideAmounts: false,
  toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
  setHideAmounts: (hideAmounts) => set({ hideAmounts }),
}));
