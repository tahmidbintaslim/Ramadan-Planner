# Ramadan Planner

A Bengali-first web app for planning and tracking Ramadan: prayer, sehri and iftar times for your location, a daily ibadah tracker, a Quran reader and reminders. English is the second language.

[![CI](https://github.com/tahmidbintaslim/Ramadan-Planner/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tahmidbintaslim/Ramadan-Planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/tahmidbintaslim/Ramadan-Planner)](LICENSE)
[![Live demo: partial](https://img.shields.io/badge/live%20demo-partial-yellow)](https://ramadan-planner-puce.vercel.app)

**Live demo:** [ramadan-planner-puce.vercel.app](https://ramadan-planner-puce.vercel.app). It works in guest mode only for now: the database behind it is unreachable. See [Status](#status) for exactly what works there.

You can use the app as a guest, with your data kept in the browser, or sign in to save it to the database.

| Landing page (Bengali) | Dashboard (English, dark theme) | Quran reader |
| --- | --- | --- |
| [![Landing page in Bengali with the "start free" and "see live demo" buttons](docs/images/landing.png)](docs/images/landing.png) | [![Dashboard showing the days until Ramadan, today's prayer, sehri and iftar times for Dhaka, and the iftar countdown](docs/images/dashboard.png)](docs/images/dashboard.png) | [![Surah Al-Fatiha with Arabic text, Bengali and English translations and a recitation player](docs/images/quran-reader.png)](docs/images/quran-reader.png) |

Screenshots taken from the live demo on 2026-10-25.

## Features

- Prayer, sehri and iftar times for your location from the AlAdhan API (Karachi method, Hanafi Asr), with the Hijri date and per-country Hijri offsets. IslamicAPI is used first when a key is set.
- Ramadan status banner with a countdown, and a 30-day sehri and iftar timetable. Outside Ramadan it shows the next one.
- Today tracker: the five daily prayers plus Taraweeh and Tahajjud, Quran progress, a daily checklist, a day task, a journal and "My Dua".
- Goals and a pre-Ramadan plan.
- Quran reader: 114 surahs with Arabic, Bengali and English text and recitation audio. It reads from the database and falls back to [quranapi.pages.dev](https://quranapi.pages.dev) when the database is empty or unreachable.
- Hadith browser (from the database, seeded from hadithapi.com).
- Tasbih counter and zakat calculator.
- Reminder rules, delivered as a private ICS feed, through Google Calendar sync (OAuth tokens encrypted with AES-256-GCM), or as web push. Push needs the scheduler described in [Push reminders](#push-reminders).
- Admin announcements.
- Light, dark and system themes, and a font size control.

Not built yet: Islamic books, a duas collection and a quiz (their pages say "coming soon"), plus the Laylatul Qadr mode and sleep dhikr checklist in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Tech stack

| Layer | What it uses |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, next-intl (Bengali default, English) |
| Auth | Clerk (`src/proxy.ts`, `src/lib/auth/server.ts`) |
| Database | PostgreSQL hosted on Supabase |
| Data access | Prisma 7 with the `pg` adapter for content, Quran, hadith, announcements, push and calendar data; `supabase-js` with the service role key, on the server only, for planner data (daily logs, goals, plan tasks, reminder rules, profile) in `src/actions/planner.ts` |
| Tests | Vitest |
| Hosting | Vercel |

## Architecture

```mermaid
flowchart LR
  browser["Browser<br/>guest data in localStorage<br/>service worker for push"]
  app["Next.js app on Vercel<br/>pages, server actions, API routes"]
  clerk["Clerk<br/>sign-in"]
  db[("Supabase Postgres")]
  prayer["AlAdhan API<br/>(IslamicAPI when a key is set)"]
  quran["quranapi.pages.dev<br/>Quran fallback"]
  google["Google Calendar API"]
  cron["GitHub Actions<br/>reminders cron, every 5 min"]
  pushsvc["Browser push services"]
  calapps["Calendar apps"]

  browser -->|HTTPS| app
  app --> clerk
  app -->|"Prisma (pg) and supabase-js"| db
  app --> prayer
  app --> quran
  app --> google
  cron -->|"GET /api/push/dispatch<br/>Bearer CRON_SECRET"| app
  app -->|web push| pushsvc --> browser
  calapps -->|private ICS feed| app
```

Supabase Auth is not used. Clerk user IDs are mapped to stable UUIDs (`src/lib/auth/server.ts`) and every server query filters by that ID. The service role key bypasses Postgres row-level security, so the RLS policies in `supabase/migrations` do not protect these queries; the scoping in application code does. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md).

## Getting started

### Prerequisites

- Node.js 22 (see `.nvmrc`) and npm 10
- For signed-in features: a Supabase project (Postgres plus its REST API, which the planner actions use) and a Clerk application
- Optional: a Google OAuth client for calendar sync, and VAPID keys for push

### Run it locally without any accounts

This runs the guest features against no database. It was checked from a clean clone on 2026-10-25.

```bash
git clone https://github.com/tahmidbintaslim/Ramadan-Planner.git
cd Ramadan-Planner
npm ci
cp .env.example .env.local
# In .env.local, set DATABASE_URL to any well-formed URL, for example
# DATABASE_URL=postgresql://dev:dev@localhost:5432/dev
npm run dev
```

Open http://localhost:3000. With the Clerk keys empty, `npm run dev` starts Clerk in keyless mode with temporary keys. Prayer times, the timetable, the Quran reader (through its fallback), the guest tracker, plan, reminders list, tasbih and zakat work. Daily content, hadith, announcements and anything saved to an account need the database.

`npm run dev` first runs `scripts/generateVapidKeys.mjs`, which writes new VAPID keys to `.env.local` on every start. That breaks existing push subscriptions. If you rely on push locally, run `npx next dev --turbopack` instead.

### Full setup

Fill in `.env.local`. [`.env.example`](.env.example) lists every variable the app and scripts read, with a comment for each. The minimum for signed-in use is `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. `npm start` and Vercel deployments fail on every page without real Clerk keys.

#### Database

There is no one-command schema setup yet. The SQL in `supabase/migrations` was written for Supabase Auth: it points `user_id` foreign keys at `auth.users`, where Clerk users never exist, so saving a profile fails on a fresh database. `prisma/schema.prisma` was introspected from the live database and also models Supabase's `auth` schema. Until a baseline Prisma migration replaces both, a new database needs those foreign keys pointed at `user_profiles(id)` by hand after running the SQL files in order.

Seed content (each script reads `DIRECT_URL` or `DATABASE_URL` from `.env.local`):

```bash
npm run seed:quran               # surahs, ayahs, reciters from quranapi.pages.dev
npm run seed:daily-content       # day 1-30 content
npx tsx scripts/seed-hadith.ts   # needs HADITHAPI_KEY
```

### Test and build

These are the steps CI runs (`.github/workflows/ci.yml`):

```bash
npm run lint
npx tsc --noEmit
npm test        # Vitest unit tests
npm run build   # prisma generate + next build; needs DATABASE_URL set, any well-formed URL works
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Generate VAPID keys, then start the dev server |
| `npm run build` | `prisma generate` and `next build` |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run translations:check` | List keys missing from `src/messages/en.json` or `bn.json` |
| `npm run seed:quran` / `npm run seed:daily-content` | Seed content tables |
| `npm run vapid:generate` | Write a new VAPID key pair to `.env.local` |

## Deployment

The app is deployed on Vercel through its GitHub integration: each pull request gets a preview deployment and `main` deploys to production at [ramadan-planner-puce.vercel.app](https://ramadan-planner-puce.vercel.app). Set the variables from `.env.example` in the Vercel project settings; Next.js inlines `NEXT_PUBLIC_*` values at build time, so redeploy after changing them. `vercel.json` schedules one daily call to the push dispatcher; [Push reminders](#push-reminders) explains the 5-minute scheduler.

## Push reminders

`GET /api/push/dispatch` sends every push reminder that fell due in the last 10 minutes and records each send in `push_delivery_logs`, so overlapping runs do not send twice. It requires `Authorization: Bearer <CRON_SECRET>`.

Vercel Hobby crons run at most once a day (the one in `vercel.json` runs at 00:00 UTC), so `.github/workflows/reminders-cron.yml` calls the endpoint every 5 minutes. To turn it on, add two repository secrets under Settings > Secrets and variables > Actions:

- `PUSH_DISPATCH_URL`: for example `https://your-domain/api/push/dispatch`
- `CRON_SECRET`: the same value as the deployment's `CRON_SECRET`

Without them the workflow exits without calling anything. GitHub can start scheduled runs late and pauses them after 60 days without repository activity. Details in [docs/reminders.md](docs/reminders.md).

Known blocker: in this repo's schema, `push_delivery_logs.user_id` (like `admin_users.user_id`) references `auth.users`. If the live database matches, every delivery log insert fails for Clerk users and the endpoint answers 503 without sending. The fix is to point that foreign key at `user_profiles(id)`.

## Project structure

```text
src/
  app/          App Router pages ((app), (auth)) and API routes (api/)
  actions/      Server actions: planner data, announcements, integrations, locale
  components/   UI grouped by feature; shadcn/ui primitives in ui/
  lib/          Prayer times, Ramadan dates and timetable, Quran, push schedule,
                calendar, auth, Prisma and Supabase clients (unit tests sit next to them)
  messages/     bn.json and en.json for next-intl
  proxy.ts      Clerk middleware
prisma/         schema.prisma (introspected from the live database)
supabase/       SQL migrations, written for Supabase Auth (see Database)
scripts/        Content seeding, VAPID key generation, translation check
public/sw.js    Service worker that shows push notifications
docs/           Architecture, API, data model, reminders, security, product spec
```

## Status

This is a personal project. The live deployment is a demo, not a supported service.

Live demo, checked 2026-10-25:

- Works: landing page, dashboard with prayer, sehri and iftar times and the Ramadan 1448 timetable, the Quran list and reader (served by the quranapi.pages.dev fallback), the guest tracker, plan and reminders lists, tasbih, zakat, and switching between Bengali and English.
- Does not work: the database behind the demo is unreachable, so `/api/daily-content` and `/api/announcements` answer 503, the hadith page shows no hadith, and anything that saves to an account (logs, goals, reminders, profile, ICS links, Google Calendar sync) fails. Sign-in runs on a Clerk development instance. Push reminders are not sent there, because the repository has no `PUSH_DISPATCH_URL` or `CRON_SECRET` secrets.

Known issues:

- The schema is not reproducible from this repo yet (see [Database](#database)).
- In English, the default location label still reads "ঢাকা, বাংলাদেশ", because the default is hard-coded in Bengali.
- Revoking an ICS link stops new requests, but the feed response is CDN-cached for up to an hour plus a 6-hour stale window.
- There is no rate limiting on push subscribe or calendar sync.

Next steps: restore the demo database and move Clerk to a production instance, add a baseline Prisma migration with the foreign keys pointed at `user_profiles(id)`, then finish the features in [docs/ROADMAP.md](docs/ROADMAP.md).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit
- [docs/api.md](docs/api.md): API routes and response shapes
- [docs/reminders.md](docs/reminders.md) and [docs/calendar-sync.md](docs/calendar-sync.md): reminder channels
- [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md): data isolation and secrets
- [docs/db.md](docs/db.md) and [docs/DATA_MODEL.md](docs/DATA_MODEL.md): tables
- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) and [docs/ROADMAP.md](docs/ROADMAP.md): plans, including features not built yet

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run the four commands under [Test and build](#test-and-build); CI runs the same ones on every pull request to `main`. Keep user-facing strings in both `src/messages/bn.json` and `src/messages/en.json` (`npm run translations:check` lists gaps).

## License

[MIT](LICENSE). Copyright (c) 2026 Tahmid Bin Taslim Rafi.
