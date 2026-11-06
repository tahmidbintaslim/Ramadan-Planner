# Architecture

## Frontend

- TanStack Start (TanStack Router file routes in `src/routes/`, Vite, Nitro with the Vercel preset), React 19
- Pages render on the server (SSR) and hydrate; route loaders fetch data through server functions (`createServerFn`), whose bodies live in server-only modules under `src/server/`
- shadcn/ui + Tailwind CSS 4
- use-intl with Bengali as the default locale and English second (locale stored in the `NEXT_LOCALE` cookie, read by the root loader)

## Auth

- Clerk. `src/start.ts` runs the CSRF middleware and `clerkMiddleware()` on every request; `/sign-in` and `/sign-up` render Clerk components. Server functions that need a user go through `authMiddleware` (`src/server/auth-middleware.ts`), which answers 401 when signed out.
- `getAppAuthUser()` in `src/lib/auth/server.ts` maps the Clerk user ID to a stable UUID (SHA-256 based) that is used as `user_profiles.id` and as `user_id` everywhere else.
- Supabase Auth is not used.

## Data

- One PostgreSQL database, hosted on Supabase.
- Prisma 7 with the `pg` adapter (`src/lib/prisma.ts`), on the server only, for everything: daily content, Quran, hadith, announcements, admin, push subscriptions and delivery logs, calendar links, and the planner data in `src/server/planner-impl.ts` (daily logs, prayer goals, plan tasks, reminder rules and profile settings). The Supabase Data API (REST) is not used.
- Prisma connects as the database owner and bypasses row-level security, so user isolation comes from application code: every server query filters by the signed-in user's ID. See [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md).
- Guests use the same screens with data in `localStorage` (`src/hooks/use-guest-data.ts`).

## Content vs user data

- Daily content (day 1-30), Quran and hadith are shared and cacheable.
- User logs are private and scoped to the signed-in user.

## Key services

- Timings (`src/lib/prayer-times.ts`): prayer, sehri and iftar times plus the Hijri date per location and time zone, from IslamicAPI when a key is set and AlAdhan otherwise, cached in memory for 24 hours.
- Quran (`src/lib/quran.ts`): reads the seeded tables and falls back to quranapi.pages.dev when they are empty or the database is unreachable.
- Reminders: rule storage in `reminder_rules`; delivery through the ICS feed, Google Calendar sync and web push (`/api/push/dispatch`, see [reminders.md](reminders.md)).
- Calendar (`src/lib/calendar.ts`, `src/lib/google-calendar.ts`): ICS feed and Google Calendar sync.
