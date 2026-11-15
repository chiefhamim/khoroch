import { create } from 'zustand';
import type { LocalDate } from '@/domain/types';

interface DayBookStore {
  /** Day currently shown in the Ledger day book, or null when the day book is not the visible ledger mode. */
  day: LocalDate | null;
  setDay: (day: LocalDate | null) => void;
}

export const useDayBookStore = create<DayBookStore>((set) => ({
  day: null,
  setDay: (day) => set({ day }),
}));
