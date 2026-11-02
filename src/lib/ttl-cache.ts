// Small in-memory TTL cache with in-flight de-duplication, replacing Next.js's `fetch(..., { next: { revalidate } })`.
// Per server instance only; nothing is persisted. A rejected load is never cached.

interface Entry {
  value?: unknown;
  /** Set while a load is running; concurrent callers share it. */
  pending?: Promise<unknown>;
  expiresAt: number;
}

/** Upper bound on distinct keys held at once; the oldest-inserted entry is evicted past it. */
export const DEFAULT_MAX_ENTRIES = 500;

const store = new Map<string, Entry>();

function evictExpired(now: number): void {
  for (const [key, entry] of store) {
    if (!entry.pending && entry.expiresAt <= now) store.delete(key);
  }
}

function enforceBound(maxEntries: number): void {
  while (store.size > maxEntries) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Return the cached value for `key` while it is younger than `ttlMs`, otherwise run `load` once (callers that
 * arrive while it runs share the same promise) and cache its result. If `load` rejects nothing is cached.
 */
export function ttlCache<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit) {
    if (hit.pending) return hit.pending as Promise<T>;
    if (hit.expiresAt > now) return Promise.resolve(hit.value as T);
    store.delete(key);
  }

  const entry: Entry = { expiresAt: Number.POSITIVE_INFINITY };
  const pending = (async () => load())().then(
    (value) => {
      if (store.get(key) === entry) {
        entry.value = value;
        entry.pending = undefined;
        entry.expiresAt = Date.now() + ttlMs;
      }
      return value;
    },
    (error) => {
      if (store.get(key) === entry) store.delete(key);
      throw error;
    },
  );
  entry.pending = pending;
  // Re-insert so Map order is insertion order of live keys, then trim.
  evictExpired(now);
  store.set(key, entry);
  enforceBound(maxEntries);
  return pending;
}

/** Test helper: drop everything. */
export function clearTtlCache(): void {
  store.clear();
}

/** The part of a `Response` the callers use, safe to share between callers (json() returns a fresh copy). */
export interface CachedResponse {
  ok: boolean;
  status: number;
  statusText: string;
  // `any` like `Response.json()`: callers narrow the shape themselves.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<T = any>(): Promise<T>;
}

class NotOk extends Error {
  constructor(readonly response: CachedResponse) {
    super(`HTTP ${response.status}`);
  }
}

/**
 * `fetch(url)` + body parse, cached for `ttlSeconds` (the old `next.revalidate` value). Only a successful JSON
 * response is cached; a non-2xx answer is returned to the caller (as before) but not remembered, and a network
 * or parse error rejects as `fetch`/`res.json()` did.
 */
export async function cachedFetch(
  url: string,
  ttlSeconds: number,
  init?: RequestInit,
): Promise<CachedResponse> {
  try {
    const body = await ttlCache<{ status: number; statusText: string; data: unknown }>(
      `fetch:${url}`,
      ttlSeconds * 1000,
      async () => {
        const res = await fetch(url, init ?? {});
        if (!res.ok) {
          throw new NotOk({
            ok: false,
            status: res.status,
            statusText: res.statusText,
            json: () => res.json(),
          });
        }
        return { status: res.status, statusText: res.statusText, data: await res.json() };
      },
    );
    return {
      ok: true,
      status: body.status,
      statusText: body.statusText,
      json: <T,>() => Promise.resolve(structuredClone(body.data) as T),
    };
  } catch (error) {
    if (error instanceof NotOk) return error.response;
    throw error;
  }
}
