import { create } from 'zustand';

interface PrivacyStore {
  hideAmounts: boolean;
  showPoisha: boolean;
  compactNumbers: boolean;
  toggleHideAmounts: () => void;
  setHideAmounts: (hide: boolean) => void;
  setShowPoisha: (show: boolean) => void;
  setCompactNumbers: (compact: boolean) => void;
  syncFromSettings: (prefs: { showPoisha: boolean; compactNumbers: boolean }) => void;
  resetForOpen: (hideAmountsOnOpen: boolean) => void;
}

export const usePrivacyStore = create<PrivacyStore>((set) => ({
  hideAmounts: false,
  showPoisha: false,
  compactNumbers: false,
  toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
  setHideAmounts: (hideAmounts) => set({ hideAmounts }),
  setShowPoisha: (showPoisha) => set({ showPoisha }),
  setCompactNumbers: (compactNumbers) => set({ compactNumbers }),
  syncFromSettings: (prefs) =>
    set({
      showPoisha: prefs.showPoisha,
      compactNumbers: prefs.compactNumbers,
    }),
  resetForOpen: (hideAmountsOnOpen) => {
    if (hideAmountsOnOpen) {
      set({ hideAmounts: true });
    }
  },
}));
