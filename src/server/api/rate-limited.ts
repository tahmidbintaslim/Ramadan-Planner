// Server-only: the route handlers that sit behind the best-effort per-IP limiter (src/server/rate-limit.ts).
// One bucket set per route, 60 requests/minute/IP each. The public proxies call upstream APIs (AlAdhan,
// IslamicAPI, ...) on a cache miss, and push subscribe writes to the database, so these are the routes a
// single client could most cheaply abuse. Vercel Firewall rules are the real layer (docs/security.md).
import "@tanstack/react-start/server-only";
import { createRateLimiter, DEFAULT_LIMIT, withRateLimit } from "@/server/rate-limit";
import { handlePushSubscribe } from "./push-subscribe";
import { handleRamadan } from "./ramadan";
import { handleRamadanTimetable } from "./ramadan-timetable";
import { handleTimings } from "./timings";

const limiters = {
  timings: createRateLimiter(DEFAULT_LIMIT),
  ramadan: createRateLimiter(DEFAULT_LIMIT),
  ramadanTimetable: createRateLimiter(DEFAULT_LIMIT),
  pushSubscribe: createRateLimiter(DEFAULT_LIMIT),
};

export const rateLimitedTimings = (request: Request) =>
  withRateLimit(limiters.timings, request, () => handleTimings(request));

export const rateLimitedRamadan = (request: Request) =>
  withRateLimit(limiters.ramadan, request, () => handleRamadan(request));

export const rateLimitedRamadanTimetable = (request: Request) =>
  withRateLimit(limiters.ramadanTimetable, request, () => handleRamadanTimetable(request));

export const rateLimitedPushSubscribe = (request: Request) =>
  withRateLimit(limiters.pushSubscribe, request, () => handlePushSubscribe(request));
