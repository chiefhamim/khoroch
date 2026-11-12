import { create } from 'zustand';

interface DataVersionState {
  dataVersion: number;
  bumpDataVersion: () => void;
}

export const useDataVersionStore = create<DataVersionState>((set) => ({
  dataVersion: 0,
  bumpDataVersion: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
}));

export function bumpDataVersion(): void {
  useDataVersionStore.getState().bumpDataVersion();
}
