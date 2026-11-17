import React, { createContext, useContext } from 'react';

export interface LockState {
  /** True while the app is locked, being checked, or the lock could not be checked. */
  locked: boolean;
  /** True when a credential exists in secure storage (the single source of truth for "lock on"). */
  enabled: boolean;
  /** Re-reads the credential after settings turned the lock on or off. Never throws. */
  refresh: () => Promise<void>;
}

const DEFAULT_STATE: LockState = { locked: false, enabled: false, refresh: async () => {} };

export const LockContext = createContext<LockState>(DEFAULT_STATE);

/** True while the app lock covers the app. Anything that opens its own window must hide then. */
export function useIsLocked(): boolean {
  return useContext(LockContext).locked;
}

export function useLockState(): LockState {
  return useContext(LockContext);
}

/** The lock screen's own sheets live above the lock and must stay usable. */
export function LockedScope({ children }: { children: React.ReactNode }) {
  const parent = useContext(LockContext);
  return (
    <LockContext.Provider value={{ ...parent, locked: false }}>{children}</LockContext.Provider>
  );
}
