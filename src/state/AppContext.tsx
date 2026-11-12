import { createContext, useContext } from 'react';
import type { Repo } from '@/data/repo';
import type { Settings } from '@/domain/types';

export interface AppContextValue {
  repo: Repo;
  backend: 'sqlite' | 'memory';
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppContext.Provider');
  }
  return ctx;
}
