import { useEffect, useState } from 'react';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export function useSettings() {
  const { repo, backend, settings, updateSetting, refreshSettings } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);
  const [hasTransactions, setHasTransactions] = useState(false);

  useEffect(() => {
    let active = true;
    repo
      .hasAnyTransactions()
      .then((res) => {
        if (active) setHasTransactions(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [repo, dataVersion]);

  return {
    repo,
    backend,
    settings,
    hasTransactions,
    updateSetting,
    refreshSettings,
  };
}
