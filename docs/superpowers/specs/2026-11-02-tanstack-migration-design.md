# TanStack Start migration: design and spike results

Date: 2026-11-02. Status: spike done (local only); awaiting founder go. Full evidence: the spike's findings file (kept in the session scratchpad; summarized here). Scope: moving Ramadan Planner from Next.js 16 to TanStack Start 1.x on Vercel. Billing logic is framework-free (`src/lib/`) and moves unchanged.

## Spike results (all local; nothing deployed, no Clerk keys used)

| # | Question | Verdict | Notes |
|---|---|---|---|
| 1 | Scaffold | GO | `npx @tanstack/cli@latest create ... --deployment vercel`; react-start 1.169.4, vite 8.3.5, react 19.3.1, **nitro 3.0.260610-beta** (Nitro 3 has no stable release). |
| 2 | Build for Vercel | GO | `NITRO_PRESET=vercel vite build` gives `.vercel/output` (nodejs22.x function). Served Bengali SSR and the webhook locally. Not deployed. |
| 3 | Webhook raw body | GO | `request.text()` returned byte-identical bodies (CRLF, tabs, Bengali, emoji) on dev, built server and function: safe for Stripe signature checks. |
| 4 | Server fn + auth | CAUTION | Signed-out call is rejected. Validator method is `.validator()` (no `.inputValidator()`). Errors return HTTP 200 unless the middleware calls `setResponseStatus(401)`. |
| 5 | i18n | GO | `use-intl` renders the existing `bn.json`/`en.json` unchanged, ICU args and Bengali digits OK, no hydration warnings, `NEXT_LOCALE` cookie switching works, about 12 kB gzip. Paraglide not needed. |
| 6 | Bengali rendering | GO | Screenshots show conjuncts and digits correct. |
| 7 | Clerk | CAUTION | `@clerk/tanstack-react-start` 1.7.9 is npm `latest`, no beta tag. Uses `clerkMiddleware()` and `auth()` (`/server`), `ClerkProvider`, `<Show>`, env `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`. **Sign-in untested.** Needs Clerk Core 3, which conflicts with this repo's `package.json` overrides (`@clerk/backend <3`, `@clerk/shared <4`). |
| 8 | Bundle size | CAUTION | Spike `/` about 125 kB gzip JS (about 160 kB with Clerk); real Next `/` about 255 kB gzip (from build manifests). Pages are not equivalent: **no marketing claim yet**. |
| 9 | CVE-2026-102989 | GO | Critical reflected XSS in server-function responses; fixed in react-start 1.168.60 and start-server-core 1.169.39; spike has 1.169.4 / 1.169.45. |
| 10 | PWA | GO | Existing `sw.js` and a manifest serve from `public/` and register without a plugin. |

## Security finding the migration must handle (verified)

Clerk requires `src/start.ts`. Once that file exists, Start drops its default CSRF check for server functions: a cross-origin POST carrying the session cookie got data back. Fix: register `createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' })` in `src/start.ts`. It must be the filtered form: the unfiltered one returns 403 to the Stripe webhook. Add a test that a cross-origin server-function POST is rejected and that the webhook still works.

## Decisions

- Framework: TanStack Start 1.x on Vercel via Nitro (`NITRO_PRESET=vercel`). Pin exact versions of react-start, start-server-core and nitro; run the migration on a branch.
- i18n: `use-intl` with the existing message files unchanged; keep `translations:check`.
- Auth: Clerk's TanStack SDK 1.7.9 (Core 3). Remove or update the repo's Clerk `overrides` as part of the migration.
- Validation: zod via `.validator()`; the auth middleware sets 401 via `setResponseStatus`.
- Billing core, Prisma and supabase-js stay as they are.

## Route map to port (from the current app)

Pages: landing, auth (login/signup/forgot), dashboard, today, plan, quran, hadith, duas, books, quiz, tasbih, zakat, reminders, settings, admin/announcements. API routes: announcements (+ by id), calendar google connect/callback, calendar ics by secret, daily-content, push dispatch and subscribe, quran, ramadan-timetable, ramadan, timings, plus the new Stripe webhook. Server actions in `src/actions/*` become server functions behind the auth middleware. Service worker and manifest move to `public/`.

## Go/no-go checkpoint (end of week 4)

Go on to cutover only if: every page and API route above works on a Vercel preview; Clerk sign-in, sign-out and a protected server function work there; the CSRF test passes; all existing tests pass; Lighthouse performance is not worse than the Next.js build on the landing page. Otherwise stay on Next.js and keep the Part A billing core.

## Still unverified (do first in the migration)

1. Clerk sign-in and SSR auth state on a Vercel preview with Clerk development keys (needs the separate spike repo and Vercel project).
2. Nitro 3 beta behaviour in production on Vercel (cold starts, logs).
3. Whether the root loader refetches messages on every client navigation.
4. Real Lighthouse and bundle numbers for equivalent pages.

## Live Vercel results (separate throwaway project, 2026-11-02)

The spike was deployed to its own Vercel project (`ramadan-planner-tanstack-spike`, no secrets, protection off) and tested at its public URL. Evidence is kept in the session scratchpad.

| Check | Result |
|---|---|
| Build on Vercel (Nitro preset) | READY first try, 41 s, versions as local spike |
| Bengali SSR | Correct text and digits, no hydration warnings, no missing glyphs |
| Webhook raw body | 400 without header, 200 with it; sha256 of an 89-byte CRLF/Bengali/emoji body identical to the sent body (Stripe signature safe) |
| Signed-out server function | HTTP 401; cross-origin, no-Origin and GET requests rejected (403) while the webhook path stays open |
| Warm latency | server time min 64 / median 74 / max 166 ms through the session proxy (not real-user numbers); cold start never observed (UNVERIFIED) |
| Service worker + manifest | correct content types; worker registers |
| Lighthouse 13.6 mobile (spike page) | performance 100, accessibility 100, best practices 96, SEO 90; LCP 1.0 s, TBT 40 ms, CLS 0, 124.9 KiB JS (not an equivalent page: no marketing claim yet) |
| Clerk on Vercel | UNVERIFIED: not wired into the spike; needs a Clerk development instance |

Findings to carry into the migration:
- **Function region defaults to `iad1` (Washington).** Bangladesh users would be better served from `bom1` (Mumbai) or `sin1`; decide the production region (and the database region) in Task 12.
- **New Vercel projects default to Node 26.x**; the spike pinned `22.x`. Pin the Node version for the real project.
- The spike's own Clerk example used the unfiltered CSRF middleware, which returns 403 to the webhook: use only the filtered form in `src/start.ts`.
- The throwaway project is public with protection off: delete it (or re-enable protection) when done.
