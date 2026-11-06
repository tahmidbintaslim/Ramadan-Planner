// Small fixed-window rate limiter, in memory and per server instance (a Vercel function instance or the Node
// server). It is a speed bump against scripted abuse of an endpoint that calls a paid API, not a guarantee:
// separate instances keep separate counts. Use Vercel's firewall rate limiting for a hard, global limit.

export interface RateLimiter {
  /** Counts one hit for `key`; true when it is still within the limit. */
  hit(key: string, now?: number): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5_000,
}: {
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys; the oldest is dropped past it, so memory stays bounded. */
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    hit(key, now = Date.now()) {
      const entry = windows.get(key);
      if (!entry || now - entry.start >= windowMs) {
        windows.delete(key);
        windows.set(key, { start: now, count: 1 });
        while (windows.size > maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest === undefined) break;
          windows.delete(oldest);
        }
        return limit >= 1;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform (its first entry is the client);
 * `x-real-ip` covers other proxies. Falls back to a shared bucket, which only makes the limit stricter.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}
