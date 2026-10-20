# Architecture

## Frontend

- Next.js 16 App Router, React 19
- Server Components by default; Client Components for interactive trackers and forms
- shadcn/ui + Tailwind CSS 4
- next-intl with Bengali as the default locale and English second (locale stored in the `NEXT_LOCALE` cookie)

## Auth

- Clerk. `src/proxy.ts` runs `clerkMiddleware()`; `/sign-in` and `/sign-up` render Clerk components.
- `getAppAuthUser()` in `src/lib/auth/server.ts` maps the Clerk user ID to a stable UUID (SHA-256 based) that is used as `user_profiles.id` and as `user_id` everywhere else.
- Supabase Auth is not used. `src/actions/auth.ts` and the forms in `src/components/auth/` are leftovers from it and are not reachable from the app.

## Data

- One PostgreSQL database, hosted on Supabase.
- Prisma 7 with the `pg` adapter (`src/lib/prisma.ts`) for daily content, Quran, hadith, announcements, admin, push subscriptions and delivery logs, and calendar links.
- `supabase-js` with the service role key (`src/lib/supabase/server.ts`), on the server only, for planner data in `src/actions/planner.ts`: daily logs, prayer goals, plan tasks, reminder rules and profile settings.
- The service role bypasses row-level security, so user isolation comes from application code: every server query filters by the signed-in user's ID. See [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md).
- Guests use the same screens with data in `localStorage` (`src/hooks/use-guest-data.ts`).

## Content vs user data

- Daily content (day 1-30), Quran and hadith are shared and cacheable.
- User logs are private and scoped to the signed-in user.

## Key services

- Timings (`src/lib/prayer-times.ts`): prayer, sehri and iftar times plus the Hijri date per location and time zone, from IslamicAPI when a key is set and AlAdhan otherwise, cached in memory for 24 hours.
- Quran (`src/lib/quran.ts`): reads the seeded tables and falls back to quranapi.pages.dev when they are empty or the database is unreachable.
- Reminders: rule storage in `reminder_rules`; delivery through the ICS feed, Google Calendar sync and web push (`/api/push/dispatch`, see [reminders.md](reminders.md)).
- Calendar (`src/lib/calendar.ts`, `src/lib/google-calendar.ts`): ICS feed and Google Calendar sync.
