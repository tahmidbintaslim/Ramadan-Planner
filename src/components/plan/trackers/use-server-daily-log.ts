import { useCallback, useEffect, useState } from "react";
import { getDailyLogAction, type DailyLogDTO } from "@/actions/planner";

interface Loaded<T> {
  /** `${day}|${todayISO}`: the value belongs to this Ramadan day on this local date. */
  scope: string;
  value: T;
}

export interface ServerDailyLogField<T> {
  /** The loaded value for the current day and date; null until the first load finishes (edits must wait). */
  value: T | null;
  /** The first load failed: edits stay disabled so they cannot overwrite the stored log. */
  loadFailed: boolean;
  /** Replaces the loaded value (no-op until loaded, or when it belongs to another day). */
  setValue: (updater: (prev: T) => T) => void;
}

/**
 * One field of the signed-in user's daily log for `day`, loaded with the user's local date (`todayISO`, which picks
 * the Ramadan year). Reloads when the day or the date changes; until then `value` is null so callers can lock their
 * controls (a toggle before the first load would otherwise save over the whole stored list).
 */
export function useServerDailyLogField<T>(
  day: number,
  todayISO: string,
  enabled: boolean,
  pick: (log: DailyLogDTO | null) => T,
): ServerDailyLogField<T> {
  const scope = `${day}|${todayISO}`;
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [failedScope, setFailedScope] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getDailyLogAction(day, todayISO)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setLoaded({ scope, value: pick(res.data) });
          setFailedScope(null);
        } else {
          setFailedScope(scope);
        }
      })
      .catch(() => {
        if (!cancelled) setFailedScope(scope);
      });
    return () => {
      cancelled = true;
    };
    // `pick` is a pure mapping; reloading on its identity would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, todayISO, enabled, scope]);

  const setValue = useCallback(
    (updater: (prev: T) => T) => {
      setLoaded((prev) => (prev && prev.scope === scope ? { scope, value: updater(prev.value) } : prev));
    },
    [scope],
  );

  return {
    value: enabled && loaded?.scope === scope ? loaded.value : null,
    loadFailed: enabled && failedScope === scope,
    setValue,
  };
}
