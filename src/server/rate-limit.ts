// Best-effort, dependency-free, in-memory rate limiting (token bucket per client IP).
//
// This is NOT the real protection layer: every serverless instance has its own memory, instances are
// recycled, and Vercel may run many in parallel, so a determined client gets roughly limit x instances.
// It only blunts a single noisy client hitting one warm instance. The real layer is the Vercel Firewall
// (WAF rate-limit rules), configured in the Vercel dashboard; see docs/security.md.
import "@tanstack/react-start/server-only";

export interface RateLimitDecision {
  allowed: boolean;
  /** Whole tokens left after this request. */
  remaining: number;
  /** Seconds until one token is available again (0 when allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Bucket size and refill amount per window (e.g. 60 requests ...). */
  limit: number;
  /** ... per this many milliseconds (e.g. 60_000). */
  windowMs: number;
  /** Most keys kept; the least recently seen are evicted beyond this, so memory stays bounded. */
  maxKeys?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  /** Number of tracked keys (for tests). */
  size(): number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const maxKeys = options.maxKeys ?? 10_000;
  const now = options.now ?? Date.now;
  const refillPerMs = limit / windowMs;
  // A Map iterates in insertion order; re-inserting on every hit keeps the least recently seen key first.
  const buckets = new Map<string, Bucket>();

  return {
    check(key) {
      const t = now();
      const previous = buckets.get(key);
      let tokens = limit;
      if (previous) {
        tokens = Math.min(limit, previous.tokens + Math.max(0, t - previous.updatedAt) * refillPerMs);
        buckets.delete(key);
      }

      const allowed = tokens >= 1;
      if (allowed) tokens -= 1;
      buckets.set(key, { tokens, updatedAt: t });

      while (buckets.size > maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }

      return {
        allowed,
        remaining: Math.floor(tokens),
        retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000)),
      };
    },
    size: () => buckets.size,
  };
}

/**
 * The client IP as reported by the platform proxy, or null when the request did not come through one.
 * On Vercel, `x-real-ip` and `x-forwarded-for` are set by the edge (a client-sent value is overwritten),
 * so they can be trusted there. A direct connection to the Node server (local dev, e2e) has none of them
 * and is not limited: the limiter is a Vercel-side measure.
 */
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || null;
}

/** 60 requests per minute per IP, the default for the public proxies and push subscribe. */
export const DEFAULT_LIMIT = { limit: 60, windowMs: 60_000 } as const;

/**
 * Runs `handler` unless `limiter` says the client IP is over its budget, in which case it answers
 * 429 with Retry-After. Requests without a platform client IP are passed through (see clientIp).
 */
export async function withRateLimit(
  limiter: RateLimiter,
  request: Request,
  handler: () => Promise<Response> | Response,
): Promise<Response> {
  const ip = clientIp(request);
  if (ip) {
    const decision = limiter.check(ip);
    if (!decision.allowed) {
      return Response.json(
        { ok: false, error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": String(decision.retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }
  return handler();
}
