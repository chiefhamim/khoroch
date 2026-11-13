import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeDuesOverview, type DuesOverview } from '@/domain/dues';
import type { DueEntry, Person } from '@/domain/types';
import { useAppContext } from './AppContext';
import { useDataVersionStore } from './dataVersion';

export interface UsePeopleResult {
  people: Person[];
  allPeople: Person[];
  peopleById: Map<string, Person>;
  dueEntries: DueEntry[];
  overview: DuesOverview;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function usePeople(): UsePeopleResult {
  const { repo } = useAppContext();
  const dataVersion = useDataVersionStore((s) => s.dataVersion);

  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [dueEntries, setDueEntries] = useState<DueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ppl, entries] = await Promise.all([
          repo.listPeople({ includeArchived: true }),
          repo.listDueEntries(),
        ]);
        if (!active) return;
        setAllPeople(ppl);
        setDueEntries(entries);
        setError(null);
      } catch {
        if (!active) return;
        setError('load_failed');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [repo, dataVersion, reloadTick]);

  const people = useMemo(
    () => allPeople.filter((p) => p.archivedAt == null),
    [allPeople]
  );

  const peopleById = useMemo(
    () => new Map(allPeople.map((p) => [p.id, p])),
    [allPeople]
  );

  const overview = useMemo(
    () => computeDuesOverview(allPeople, dueEntries),
    [allPeople, dueEntries]
  );

  const reload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  return {
    people,
    allPeople,
    peopleById,
    dueEntries,
    overview,
    loading,
    error,
    reload,
  };
}
