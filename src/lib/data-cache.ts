// The client's one cache for public, user-independent data: timings (today and tomorrow), the Ramadan status, the
// Ramadan timetable and the surah list. Keyed by request URL, which already carries the place (tz, coarse lat/lng),
// the calculation (cc, method, school, hadj) and the date. Concurrent requests for one key share one fetch; entries
// survive navigations (module memory) and reloads (localStorage, versioned and size-capped), so a cold or offline
// start shows the last answer at once and then revalidates. Never put personal data here.
import { useEffect, useState, useSyncExternalStore } from "react";
import { BD_TIME_ZONE, calcRequestParams, readStoredLocation, type StoredLocation } from "@/lib/user-location";

export const DATA_CACHE_KEY = "rp_data_cache_v1";
/** Persisted size cap (characters of JSON); the oldest entries go first. */
export const DATA_CACHE_MAX_CHARS = 300_000;
const DAY_MS = 86_400_000;

interface Entry {
  data: unknown;
  /** Fresh until (ms); after that it is still shown while it revalidates. */
  staleAt: number;
  /** Stored at (ms): the eviction order. */
  at: number;
}

const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
let loaded = false;

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_CACHE_KEY) ?? "{}") as Record<string, Entry>;
    const now = Date.now();
    for (const [key, e] of Object.entries(raw)) {
      // Long-dead entries (yesterday's timings, an old timetable) are dropped rather than shown.
      if (e && typeof e.staleAt === "number" && typeof e.at === "number" && e.staleAt + 30 * DAY_MS > now && !mem.has(key)) {
        mem.set(key, e);
      }
    }
  } catch {
    // Storage blocked or corrupt: start empty.
  }
}

function persist(): void {
  try {
    const entries = [...mem.entries()].sort((a, b) => b[1].at - a[1].at);
    const out: Record<string, Entry> = {};
    let size = 2;
    for (const [key, e] of entries) {
      const len = key.length + JSON.stringify(e).length + 4;
      if (size + len > DATA_CACHE_MAX_CHARS) continue;
      out[key] = e;
      size += len;
    }
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(out));
  } catch {
    // Storage full or blocked: memory still serves this session.
  }
}

function emit(): void {
  for (const l of listeners) l();
}

/** "DD-MM-YYYY" (AlAdhan) → ms at UTC midnight, or NaN. */
function ddmmyyyy(s: unknown): number {
  const m = typeof s === "string" ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(s) : null;
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : Number.NaN;
}

/** When an answer for `key` goes stale. */
export function staleAtFor(key: string, data: unknown, now = Date.now()): number {
  const url = new URL(key, "http://x");
  const date = url.searchParams.get("date");
  if ((url.pathname === "/api/timings" || url.pathname === "/api/ramadan") && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // A dated answer never changes; "today" moving on at local midnight changes the URL instead. Kept through the
    // date in every zone (UTC-12..+14), then dropped.
    return Date.parse(`${date}T00:00:00Z`) + 2 * DAY_MS;
  }
  if (url.pathname === "/api/ramadan-timetable") {
    // For the year: until the year ends or the day after its last row (then the next Ramadan's), whichever is first.
    const days = (data as { days?: { gregorianDate?: string }[] })?.days ?? [];
    const yearEnd = Date.UTC(new Date(now).getUTCFullYear() + 1, 0, 1);
    const after = ddmmyyyy(days[days.length - 1]?.gregorianDate) + DAY_MS;
    return Number.isFinite(after) && after > now ? Math.min(after, yearEnd) : Math.min(now + DAY_MS, yearEnd);
  }
  if (url.pathname === "/api/quran") return now + 30 * DAY_MS;
  return now + 3_600_000;
}

/** Only well-formed answers are kept (an error body or an empty list must not stick). */
function usable(key: string, data: unknown): boolean {
  const path = new URL(key, "http://x").pathname;
  if (path === "/api/timings") return Boolean((data as { prayerTimes?: unknown })?.prayerTimes);
  if (path === "/api/ramadan-timetable") return Array.isArray((data as { days?: unknown })?.days);
  if (path === "/api/quran") return Array.isArray(data) && data.length > 0;
  return data !== null && typeof data === "object";
}

/** The cached answer for `key`, fresh or stale (stale ones are revalidated by fetchCached/useCached). */
export function peekCached<T>(key: string): T | undefined {
  load();
  return mem.get(key)?.data as T | undefined;
}

export function isFresh(key: string, now = Date.now()): boolean {
  load();
  const e = mem.get(key);
  return e !== undefined && e.staleAt > now;
}

export function setCached(key: string, data: unknown, now = Date.now()): void {
  load();
  mem.set(key, { data, staleAt: staleAtFor(key, data, now), at: now });
  persist();
  emit();
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

/**
 * The answer for `key`: the cached one while fresh, else one shared request (`fetcher`, default GET `key`).
 * Rejects when the request fails or the answer is not usable; a stale entry is kept in that case.
 */
export function fetchCached<T>(key: string, fetcher: () => Promise<unknown> = () => fetchJSON(key)): Promise<T> {
  if (isFresh(key)) return Promise.resolve(mem.get(key)!.data as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = fetcher()
    .then((data) => {
      if (!usable(key, data)) throw new Error(`${key}: unusable answer`);
      setCached(key, data);
      return data as T;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Warm the cache without caring about the result. */
export function prefetch(key: string, fetcher?: () => Promise<unknown>): void {
  fetchCached(key, fetcher).catch(() => {});
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * React view of one key: the cached data at once (also on a client navigation's first render), revalidated when
 * stale. `key` null holds the request (e.g. on the server, before the place is known). Server and hydrating renders
 * see `undefined`, so they agree.
 */
export function useCached<T>(
  key: string | null,
  fetcher?: () => Promise<unknown>,
): { data: T | undefined; error: boolean; retry: () => void } {
  const data = useSyncExternalStore(subscribe, () => (key ? peekCached<T>(key) : undefined), () => undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetchCached(key, fetcher).catch(() => {
      if (live) setFailed(key);
    });
    return () => {
      live = false;
    };
    // `fetcher` is a stable loader at each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return {
    data,
    error: failed === key && data === undefined,
    retry: () => {
      setFailed(null);
      setAttempt((n) => n + 1);
    },
  };
}

/** /api/ramadan-timetable for a place (coarse coordinates) and calculation; the one spelling, so callers share it. */
export function timetableUrl(tz: string, loc: StoredLocation | null): string {
  const p = new URLSearchParams({ tz });
  if (loc) {
    p.set("lat", loc.lat.toFixed(2));
    p.set("lng", loc.lng.toFixed(2));
  }
  for (const [k, v] of Object.entries(calcRequestParams(loc))) p.set(k, v);
  return `/api/ramadan-timetable?${p}`;
}

/**
 * The timetable screen's URL: the stored location, else Dhaka (Asia/Dhaka, labelled Dhaka), never the device's zone:
 * a browser in UTC used to get Dhaka's sun times printed as UTC clock times. Browser only.
 */
export function screenTimetableUrl(): string {
  const stored = readStoredLocation();
  return timetableUrl(stored?.tz ?? BD_TIME_ZONE, stored);
}

/** The plan's timetable URL: the stored location, else the device time zone. Browser only. */
export function planTimetableUrl(): string {
  const loc = readStoredLocation();
  let tz = loc?.tz ?? BD_TIME_ZONE;
  if (!loc) {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
    } catch {
      // Keep the default zone.
    }
  }
  return timetableUrl(tz, loc);
}

export const SURAH_LIST_KEY = "/api/quran";

/** Tests only. */
export function resetDataCacheForTests(): void {
  mem.clear();
  inflight.clear();
  loaded = false;
}
