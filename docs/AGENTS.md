# AGENTS.md

## Project Overview: Ramadan Planner (BD-first)

Goal: A high-performance TanStack Start (React 19) website for Bangladeshi Muslims (primary language Bengali) with secondary English for expats. Users can sign up/login (social login), plan Ramadan goals, track daily Ramadan activity, and receive reminders/announcements with calendar sync and dynamic date/time by location/timezone.

## Tech Stack

- Frontend: TanStack Start (TanStack Router, Vite, Nitro), Tailwind CSS
- UI Components: shadcn/ui
- Auth: Clerk
- Database: PostgreSQL on Supabase, accessed through Prisma 7 (server only)
- Testing: Vitest (unit); Playwright smoke tests in `e2e/` against the built server (`npm run test:e2e`).
- Hosting: Vercel

## Development Rules (Non-negotiable)

- ALWAYS use TypeScript with strict types.
- Use shadcn/ui components. Do not build primitives from scratch unless necessary.
- Styling: Tailwind utility classes; avoid CSS modules.
- i18n: Bengali default, English secondary. No hardcoded UI strings.
- Verification: After every feature change, run `npm run lint`.

## Critical Commands

- Dev: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Test: `npm run test`

## Architecture Defaults

- Server-only code (Prisma, secrets, service role) lives in `src/server/` and is reached through server functions (`src/actions/*`) or server routes; components never import it directly.
- Public pages: SEO-first (per-route `head()` via `pageHead` in `src/lib/seo.ts`), cache headers where possible.
- Authenticated pages: privacy-first, noindex.
- Data layer: server queries bypass RLS (Prisma connects as the owner), so every query must filter by the signed-in user's ID from `getAppAuthUser()`; never trust a client `user_id`.

## Definition of Done (DoD)

A change is "done" only when:

1. UX matches shadcn/ui patterns + mobile-first layout
2. BN/EN translations added for all user-facing text
3. User scope validated on every new query
4. `npm run lint` passes
5. `npm run build` passes
6. Tests added/updated when behavior changes
