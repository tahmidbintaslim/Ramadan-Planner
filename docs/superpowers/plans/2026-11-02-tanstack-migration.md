# Next.js to TanStack Start Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Next.js 16 with TanStack Start 1.x (Vite + Nitro on Vercel) with no user-visible regressions, keeping Prisma, supabase-js, the framework-free billing core and all existing tests.

**Architecture:** In-place port on branch `claude/tanstack-migration` (stacked on `claude/laughing-hypatia-kvbzvh`). File routes under `src/routes/` replace `src/app/`; server actions become `createServerFn` functions behind an auth middleware; route handlers become server routes; `use-intl` replaces `next-intl` and reads the existing `src/messages/*.json` unchanged. Components, `src/lib/*` and Prisma stay put. Production stays on Next.js until Task 12.

**Tech Stack:** TanStack Start 1.x, TanStack Router, Vite 8, Nitro 3 (Vercel preset), React 19, Tailwind 4 (`@tailwindcss/vite`), `use-intl`, `@clerk/tanstack-react-start` 1.7.9 (Clerk Core 3), `next-themes` (framework-agnostic, kept), `@vercel/analytics/react`, Vitest, Playwright.

**Specs:** `docs/superpowers/specs/2026-11-02-tanstack-migration-design.md` (decisions, spike results, CSRF finding, go/no-go criteria) and `docs/superpowers/specs/2026-11-02-billing-freemium-design.md`.

## Global Constraints

- Pin exact versions of `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/start-server-core` and `nitro` (no `^`); `start-server-core` must be >= 1.169.39 and `react-start` >= 1.168.60 (CVE-2026-102989 fixes). Spike reference: react-start 1.169.4, vite 8.3.5, nitro 3.0.260610-beta, react 19.3.1 (this repo currently pins react 19.2.3: keep 19.2.3 unless the scaffold requires otherwise).
- `src/start.ts` MUST register `createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' })` (the filtered form only: the unfiltered form returns 403 to the Stripe webhook). A test must show a cross-origin server-function POST is rejected and a webhook POST is not.
- Server-function input validation uses `.validator(zodSchema)` (not `.inputValidator`). The auth middleware sets HTTP 401 via `setResponseStatus(401)` before throwing.
- Message files `src/messages/bn.json` and `en.json` are reused UNCHANGED; `npm run translations:check` must keep working.
- Client env vars use the `VITE_` prefix; secrets stay server-only. Rename: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` -> `VITE_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SUPABASE_URL` -> `VITE_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` -> `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` -> `VITE_CLERK_PUBLISHABLE_KEY`; `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` become server-only `SITE_URL` and `APP_URL` (read them with a fallback to the old names during the cutover window).
- Keep the exported names and call signatures of server actions to minimise component churn: each `xAction(input)` in `src/actions/*.ts` stays callable with a plain argument and delegates to a `createServerFn` (called as `fn({ data: input })`).
- Every task ends with: `npm test` (the existing 114 tests must stay green), `npx tsc --noEmit`, `npm run lint`, and the task's own acceptance checks. Run with `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci`; never connect to a real database, Stripe, Clerk or Vercel from implementer tasks.
- Behavior must not regress: guest mode (local-first data), Bengali default locale with `NEXT_LOCALE` cookie switching, light/dark/system theme, font-size control, `sw.js` registration for push.
- The Next.js app keeps working on `main` and on branch `claude/laughing-hypatia-kvbzvh`; this branch may break Next.js builds once Task 1 lands.

## Review Focus

- Signed-out call to ANY server function returns 401 (not an empty success) for every action in `src/actions/*`.
- Cross-origin POST to a server function is rejected; the Stripe-style webhook POST still works.
- Locale: first visit with no cookie renders Bengali without a hydration mismatch; Bengali digits render the same server and client.
- Dynamic routes with a bad param (`/quran/999`, `/hadith/nope`) return a proper 404 page, not a 500.
- Cron/push route rejects requests without the Bearer secret, accepts it with `CRON_SECRET`, and keeps `Cache-Control` headers identical to the Next.js responses listed in Task 8.

## Execution order (ruling from the preflight scan)

Run the tasks in this order: **1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11, 12.** Task 7 (server functions) must come before the shell and pages because client components import the action modules directly; under Vite, importing the old action files would drag Prisma, `next/headers` and other server-only code into the browser bundle. Task 7 depends only on Task 3's `authMiddleware` and Task 2's locale helpers. Tasks keep their numbers so the briefs and ledger stay stable.

---

### Task 1: Scaffold, build tooling and CI

**Files:** Modify `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.github/workflows/ci.yml`, `.nvmrc` (if the scaffold needs Node 22), `components.json` (`rsc: false`), `postcss.config.mjs` (delete), `next.config.ts` (delete), `src/app/globals.css` -> `src/styles/globals.css`. Create `vite.config.ts` (tanstackStart + react + tailwindcss + nitro with `NITRO_PRESET=vercel` for builds), `src/router.tsx`, `src/routes/__root.tsx` (minimal shell for now), `src/routes/index.tsx` (temporary placeholder), `src/start.ts` (empty config, CSRF added in Task 3).

**Interfaces:**
- Produces: the app boots with `npm run dev`; `npm run build` produces `.vercel/output` when `NITRO_PRESET=vercel`; `@/*` alias still maps to `src/*` in Vite, tsc and Vitest.

- [ ] **Step 1:** Create the branch (done) and replace Next dependencies: remove `next`, `eslint-config-next`, `next-intl`, `@clerk/nextjs`, `@tailwindcss/postcss`, `@vercel/analytics/next` usage; add the pinned TanStack, Vite, Nitro, `@tailwindcss/vite`, `use-intl`, `@clerk/tanstack-react-start`, `@vitejs/plugin-react` as the scaffold dictates (use `npx @tanstack/cli@latest create ... --deployment vercel` in a scratch dir to copy the exact versions and config). Remove or update the Clerk `overrides` in `package.json` that conflict with Core 3 (`@clerk/backend`, `@clerk/shared`, `@clerk/clerk-react`).
- [ ] **Step 2:** Write `vite.config.ts`, `tsconfig.json` (drop the `next` plugin and `next-env.d.ts`/`.next` includes; keep `paths`, `jsx: react-jsx`), ESLint flat config without `eslint-config-next` (use `typescript-eslint` + `eslint-plugin-react-hooks`), move global CSS and import it from `__root.tsx`.
- [ ] **Step 3:** Update scripts: `dev` (keep the VAPID key generation step), `build` = `prisma generate && vite build`, `start` = `node .output/server/index.mjs` (confirm the actual Nitro output path), keep `test`, `lint`, `translations:check`, DB scripts.
- [ ] **Step 4:** Update `.github/workflows/ci.yml`: same steps (install, lint, `tsc --noEmit`, `npm test`) and `NITRO_PRESET=vercel npm run build`; keep the placeholder `DATABASE_URL`.
- [ ] **Step 5:** Acceptance: `npm test` shows 114 passing; `npx tsc --noEmit` clean (excluding not-yet-ported `src/app/**`, which Task 4-8 delete; add a temporary `exclude` for `src/app` and `src/proxy.ts`); `NITRO_PRESET=vercel npm run build` succeeds; `npm run dev` serves the placeholder at `/`. Commit `chore(migrate): TanStack Start scaffold and build tooling`.

### Task 2: i18n with `use-intl`

**Files:** Create `src/i18n/provider.tsx` (wraps `IntlProvider` from `use-intl` with `locale`, `messages`, `timeZone` from the root loader), `src/i18n/server.ts` (`getLocaleFromRequest(): Promise<Locale>`: read the `NEXT_LOCALE` cookie, default `bn`; `loadMessages(locale)` imports the JSON; `getTranslator(locale, namespace)` using `createTranslator`). Modify `src/lib/locale.ts` (replace `next/headers` `cookies()` with the Start request helpers), `src/actions/locale.ts` (writes the cookie via the response helper), `src/routes/__root.tsx` (loader returns `{ locale, messages }`, provider wraps the app, `<html lang>` set), `scripts/compare-translations.mjs` (no change expected). Delete `src/i18n/request.ts`.

**Interfaces:**
- Produces: `useTranslations`/`useLocale` keep working because components import them from a shim `src/i18n/use-intl.ts` that re-exports `useTranslations`, `useLocale`, `useFormatter` from `use-intl`; Task 4-6 replace every `from "next-intl"` import with `from "@/i18n/use-intl"`. `getTranslations(ns)` / `getLocale()` server helpers in `src/i18n/server.ts` mirror the next-intl names so server pages port with a one-line import change.

- [ ] **Step 1:** Write a Vitest test for `loadMessages`/`getTranslator`: Bengali string with an ICU argument and plural renders correctly; unknown locale falls back to `bn`; missing key returns the key path without throwing.
- [ ] **Step 2:** Implement the helpers and provider; make the root loader fetch messages ONCE per session (cache by locale on the client so client navigations do not refetch; verify with a counter in a test or a network log in Playwright).
- [ ] **Step 3:** Acceptance: a throwaway route renders Bengali SSR text with Bengali digits, no hydration warnings (Playwright console check), cookie switch to `en` flips the text; `npm run translations:check` passes. Commit `feat(migrate): use-intl provider and locale loader`.

### Task 3: Auth, middleware and CSRF

**Files:** Modify `src/start.ts` (Clerk `clerkMiddleware()` in `requestMiddleware`, filtered CSRF middleware), `src/lib/auth/server.ts` (keep the exported `getAppAuthUser(options?: { ensureProfile?: boolean })` and `AppAuthUser` signature; reimplement `auth()` from `@clerk/tanstack-react-start/server`), `src/components/providers/auth-provider.tsx`, `src/components/layout/app-header.tsx` and `src/components/settings/settings-content.tsx` (swap `@clerk/nextjs` hooks/components for the TanStack SDK names: `ClerkProvider`, `<Show>`, `useClerk`, `useUser` per the installed package). Create `src/server/auth-middleware.ts` (`createMiddleware({ type: 'function' }).server`: loads the user via `getAppAuthUser({ ensureProfile: true })`, calls `setResponseStatus(401)` and throws `Unauthorized` when absent, passes `{ userId }` in context). Delete `src/proxy.ts` and `src/lib/supabase/middleware.ts` (unused). Create routes `src/routes/sign-in.$.tsx`, `src/routes/sign-up.$.tsx` (splat routes for Clerk), and keep `/login`, `/forgot` redirects and `/signup`.

**Interfaces:**
- Produces: `authMiddleware` (context `{ userId: string }`) used by every server function in Task 7; `requireUserId()` in `src/actions/planner.ts` is replaced by reading `context.userId`.
- Consumes: Task 2's root loader.

- [ ] **Step 1:** Tests (Vitest, with the Clerk module mocked): `getAppAuthUser` returns null when signed out; maps the Clerk id to the same UUID as before (`clerkIdToUuid` unchanged: assert the exact fixed output for a fixed id so existing users keep their data); the middleware throws and sets 401 when signed out.
- [ ] **Step 2:** Security test (Playwright or a node `fetch` against the dev server): a cross-origin POST to a server function with a session-like cookie is rejected; a POST to the webhook path without a cookie is NOT blocked by CSRF. (The webhook route itself arrives in Task 8/Part C; use a test route now.)
- [ ] **Step 3:** Acceptance: sign-in and sign-up pages render the Clerk components (full flow verified later with Clerk development keys on a preview); signed-out call to a sample server function returns 401. Commit `feat(migrate): Clerk, auth middleware and CSRF`.

### Task 4: Root layout, theme, shell and navigation

**Files:** Modify `src/routes/__root.tsx` (providers: Clerk, IntlProvider, ThemeProvider, AuthProvider, Toaster, AccessibilitySidebar, `@vercel/analytics/react`), `src/routes/_app.tsx` (pathless layout route replacing `(app)/layout.tsx`, `noindex` meta, `AppShell`), `src/routes/__root.tsx` `notFoundComponent` (port `not-found.tsx`). Replace in 18 files `next/link` -> a thin `src/components/shared/link.tsx` (`<Link>` wrapping TanStack `Link`, accepting `href` strings so call sites change by import only); in 5 files `usePathname` -> `useLocation().pathname`; in 3 files `useRouter().push/replace` -> `useNavigate`; in 2 files `useSearchParams` -> route search params / `useSearch`.

**Interfaces:**
- Produces: `Link` component with the same `href`, `className`, `prefetch`-less API as `next/link` for the existing call sites; layout routes `_app` (authenticated shell) and `_auth`.

- [ ] **Step 1:** Port the layouts and providers; ensure `ThemeProvider`/`next-themes` works with SSR without a flash (script injected in the root document head).
- [ ] **Step 2:** Replace navigation imports mechanically (grep for `next/link`, `next/navigation`) and fix types.
- [ ] **Step 3:** Acceptance: `rg "from \"next" src/components src/hooks` returns nothing; app shell renders in dark and light; nav highlights the active route; not-found page renders for `/does-not-exist` with HTTP 404. Commit `feat(migrate): root layout, shell and navigation`.

### Task 5: Static and client pages

**Files:** Create routes for `/` (port `src/app/page.tsx`, 1068 lines: replace `getLocale`/`getTranslations` with the Task 2 helpers; it is async server code with no DB access, so a loader is not needed), `/duas`, `/books`, `/quiz`, `/tasbih`, `/zakat`, `/dashboard`, `/today`, `/plan`, `/quran`, `/reminders`, `/settings` (the five wrappers around `*-content` client components), `/admin/announcements`. Replace `NEXT_PUBLIC_*` reads in these components (`VITE_VAPID_PUBLIC_KEY` in `settings-content`).

**Interfaces:** consumes `Link`, `useTranslations` shim, `_app` layout.

- [ ] **Step 1:** Port each page; keep metadata via route `head()` (title, description, robots noindex on `_app`).
- [ ] **Step 2:** Acceptance: a Playwright smoke test visits every route above as a guest and asserts HTTP 200, no console errors, a visible heading, no hydration warnings; Today tracker works in guest mode (tick Fajr, reload, state persists in localStorage). Commit `feat(migrate): static and client pages`.

### Task 6: Data-backed pages

**Files:** Create routes `/quran/$surah` (loader calls `fetchSurah`; `notFound()` on a bad id; `head()` builds title/canonical from `SITE_URL`), `/hadith`, `/hadith/$edition`, `/hadith/$edition/$chapter` (loaders call Prisma through server functions, never importing Prisma into client bundles). Modify `src/lib/quran.ts`, `src/lib/prayer-times.ts`, `src/lib/ramadan-date.ts`, `src/lib/ramadan-timetable.ts`, `src/lib/calendar.ts` (remove the `next: { revalidate }` fetch option; add a small in-memory TTL cache helper `src/lib/ttl-cache.ts` with a unit test, and rely on `Cache-Control` for HTTP responses); `src/lib/prisma.ts` unchanged except confirming it works under Nitro (singleton on `globalThis`).

**Interfaces:**
- Produces: `ttlCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>` (in-flight de-duplication, stale entries evicted).

- [ ] **Step 1:** Unit-test `ttlCache` (hit within TTL, reload after TTL with a fake clock, concurrent callers share one load, a rejected load is not cached).
- [ ] **Step 2:** Port the four routes; Prisma only inside `createServerFn` handlers; add a test that the client bundle does not contain `@prisma/client` (build, then grep the client output).
- [ ] **Step 3:** Acceptance: `/quran/1` renders with Arabic, Bengali, English; `/quran/999` and `/hadith/nope` return 404; hadith pages render from the database in a Playwright run against a seeded local database OR are marked "verified on preview" (no database is available to implementers). Commit `feat(migrate): data-backed pages and fetch caching`.

### Task 7: Server actions to server functions

**Files:** Modify `src/actions/planner.ts` (15 actions; 901 lines), `src/actions/integrations.ts` (6), `src/actions/announcements.ts` (4), `src/actions/admin-users.ts` (3), `src/actions/locale.ts` (2), `src/actions/auth.ts` (delete the legacy Supabase password actions `loginAction`, `signupAction`, `forgotPasswordAction`, `logoutAction` and the forms that call them, after confirming `/login`, `/signup` and `/forgot` only redirect to Clerk; record the decision in the PR). Remove `"use server"`; each action becomes a `createServerFn({ method: 'POST' }).middleware([authMiddleware]).validator(schema).handler(...)` plus an exported wrapper `xAction(input)` calling `fn({ data: input })`, so callers do not change. Admin-only actions check `isUserAdmin` inside the handler exactly as before. Update the Supabase server client `src/lib/supabase/server.ts` to read cookies via the Start helpers.

**Interfaces:**
- Produces: all action names and `ActionResult<T>` shapes unchanged; unauthenticated calls fail with HTTP 401.
- Consumes: Task 3 `authMiddleware`.

- [ ] **Step 1:** For each action file write a Vitest test with mocked auth and Supabase/Prisma clients: signed-out -> rejected; invalid input -> `{ ok: false, error: "invalid_input" }` (same error strings as today); a happy path returns the same DTO shape. Reuse the existing zod schemas.
- [ ] **Step 2:** Port file by file (planner, integrations, announcements, admin-users, locale); keep behavior byte-for-byte except transport.
- [ ] **Step 3:** Acceptance: all new action tests pass; `rg "use server" src` is empty; a Playwright run shows signed-out calls get 401; guest-mode pages never call server functions. Commit per file; final commit `feat(migrate): server functions replace server actions`.

### Task 8: API routes

**Files:** Create server routes (file routes with `server.handlers`) for: `GET/POST /api/announcements` (`Cache-Control: no-store`), `PATCH/DELETE /api/announcements/$id`, `GET /api/calendar/google/connect` and `/callback` (state cookie, redirect using the request origin, `secure` cookie flag by `NODE_ENV`), `GET /api/calendar/ics/$secret` (`Cache-Control: public, s-maxage=3600`), `GET /api/daily-content` (public cache 3600 with stale-while-revalidate as today), `GET/POST /api/push/dispatch` (Bearer `CRON_SECRET` or `PUSH_DISPATCH_SECRET`, same logic, `maxDuration` set in the Vercel function config), `POST /api/push/subscribe`, `GET /api/quran` (`s-maxage=604800`), `GET /api/ramadan-timetable` (86400), `GET /api/ramadan` (3600), `GET /api/timings` (3600). Extract each handler's logic into a plain function taking a `Request` and returning a `Response` (e.g. `handleTimings(request)` in `src/server/api/*.ts`) so Vitest can call it without a framework; the route file only wires it.

**Interfaces:**
- Produces: `handleX(request: Request): Promise<Response>` per route; the exact response headers recorded in the Next.js app are asserted in tests (copy them from the current `route.ts` files).

- [ ] **Step 1:** For each route, port the logic and write a Vitest test with the same inputs the existing handler accepts: status codes, JSON shape, `Cache-Control`; for `push/dispatch`: 401 without secret, 200 with `CRON_SECRET`; for the Google callback: state mismatch is rejected.
- [ ] **Step 2:** Update `vercel.json` cron path if needed and `.github/workflows/reminders-cron.yml` unchanged.
- [ ] **Step 3:** Acceptance: every handler test passes; `curl` against the built server returns the same headers as the Next.js app for the public GET routes. Commit `feat(migrate): API routes as server routes`.

### Task 9: PWA, service worker and push

**Files:** Create `public/manifest.webmanifest` and real icons (192/512 PNG, maskable) generated from the existing brand mark; modify `public/sw.js` (keep push handlers; add an app-shell cache with a versioned cache name and a network-first strategy for HTML, cache-first for hashed assets; fix the notification icon, currently `/next.svg`), `src/routes/__root.tsx` (manifest link, theme-color, `apple-touch-icon`), `settings-content.tsx` and `prayer-times-widget.tsx` (registration unchanged); delete the unused create-next-app SVGs from `public/`.

- [ ] **Step 1:** Playwright test: manifest is served with the right content type, the service worker registers and becomes active, the page loads offline after the first visit (shell only).
- [ ] **Step 2:** Acceptance: installable per Lighthouse PWA checks on a local build; push subscription flow unchanged. Commit `feat(migrate): PWA manifest, icons and service worker`.

### Task 10: SEO files and metadata

**Files:** Create `src/routes/robots[.]txt.ts` and `src/routes/sitemap[.]xml.ts` (same URLs and logic, using `SITE_URL` falling back to `VERCEL_PROJECT_PRODUCTION_URL`), per-route `head()` metadata for public pages (title, description, canonical, `og:*`, `hreflang` bn/en), JSON-LD for the landing page, a generated OG image route if cheap (otherwise a static `public/og.png`).

- [ ] **Step 1:** Tests: sitemap lists the public routes only and none of `_app` routes; robots disallows `/api/` and `_app` paths; canonical URLs use `SITE_URL`.
- [ ] **Step 2:** Acceptance: `curl /robots.txt` and `/sitemap.xml` match the Next.js output (diff them); each public page has a unique title. Commit `feat(migrate): SEO routes and metadata`.

### Task 11: Env, tests, CI and cleanup

**Files:** Modify `.env.example` (rename the vars per the Global Constraints; add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`; document the fallback names), `README.md` and `docs/ARCHITECTURE.md`, `docs/AGENTS.md` (framework references), `package.json` (remove leftover Next dependencies, review `@supabase/ssr` use), `scripts/` (anything importing Next), `src/lib/supabase/middleware.ts` (delete). Add Playwright config and promote the Task 4-6 smoke tests to `e2e/` run in CI against the built server with a placeholder database URL for the routes that do not need data.

- [ ] **Step 1:** Remove the temporary `tsc` exclude for `src/app`; delete `src/app` entirely; `rg "next/"` and `rg "next-intl"` return nothing in `src/`, `scripts/` and config.
- [ ] **Step 2:** Acceptance: CI is green (lint, tsc, vitest, build, Playwright smoke). Commit `chore(migrate): remove Next.js leftovers and finish env migration`.

### Task 12: Preview verification and cutover checkpoint

**Files:** none (verification and docs only): update `docs/superpowers/specs/2026-11-02-tanstack-migration-design.md` with the preview results.

- [ ] **Step 1:** Create a Vercel preview of this branch (the existing project builds branch previews; set the framework preset to TanStack Start for this branch or in project settings only with the founder's approval) and run, with the founder supplying Clerk DEVELOPMENT keys for the preview: sign-up, sign-in, sign-out, a protected server function, the planner save/load, locale switch, theme, the Google calendar connect flow, push subscribe, cron route with the secret, every page in the Task 5 smoke list.
- [ ] **Step 2:** Compare Lighthouse (mobile) for `/` between the Next.js production URL and the preview; record numbers.
- [ ] **Step 3:** Go/no-go against the criteria in the migration spec (end of week 4). On GO: schedule the cutover (point the production domain at the new deployment, keep the Next.js deployment as a rollback for two weeks, re-verify production environment variables for the new names). On NO-GO: stop and report.

---

## Self-review

- **Coverage of the inventory:** 26 pages/layouts (Tasks 4-6, 3 for auth pages), 14 route handlers (Task 8), 6 action files (Task 7; legacy `auth.ts` deleted), env rename (Global Constraints + Task 11), `next-intl` 44 files (Task 2 shim), `@clerk/nextjs` 9 files (Task 3), `next/link` 18 + `next/navigation` 11 (Task 4), cached fetches (Task 6), `proxy.ts` (Task 3), PWA gaps (Task 9), SEO routes (Task 10), CI (Tasks 1, 11).
- **Not covered here (Part C of the billing plan):** the Stripe webhook route, billing server functions, gating and pricing UI; they follow after this migration on the new stack.
- **Verified in the spike:** build/Vercel preset, raw-body route, server-function rejection, `use-intl` with the existing JSON, service worker serving. **Unverified until Task 12:** Clerk sign-in, Nitro 3 beta behavior in production, real Lighthouse numbers.
