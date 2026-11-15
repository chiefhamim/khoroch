import { create } from 'zustand';

/** Dev builds only: lets the welcome flow be opened for review without resetting any data. */
export const useOnboardingPreview = create<{ on: boolean; setOn: (on: boolean) => void }>((set) => ({
  on: false,
  setOn: (on) => set({ on }),
}));
