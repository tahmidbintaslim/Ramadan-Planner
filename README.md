# Ramadan Planner

A free, Bengali-first Ramadan companion: prayer, sehri and iftar times for your district, a daily amal planner, the Quran, sourced duas and reminders. English is the second language.

[![CI](https://github.com/tahmidbintaslim/Ramadan-Planner/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tahmidbintaslim/Ramadan-Planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/tahmidbintaslim/Ramadan-Planner)](LICENSE)
[![Live demo: guest mode and content](https://img.shields.io/badge/live%20demo-guest%20%2B%20content-green)](https://ramadan-planner-puce.vercel.app)

**Live demo:** [ramadan-planner-puce.vercel.app](https://ramadan-planner-puce.vercel.app). Guest mode and the database-backed content (daily content, hadith, announcements) work. Accounts run on a Clerk development instance, so treat sign-in as a test setup. See [Status](#status) for exactly what works there.

You can use the app as a guest, with your data kept in the browser, or sign in to save it to the database.

| Landing page (Bengali) | Dashboard (English, dark theme) | Quran reader |
| --- | --- | --- |
| [![Landing page in Bengali with the "start free" and "see live demo" buttons](docs/images/landing.png)](docs/images/landing.png) | [![Dashboard showing the days until Ramadan, today's prayer, sehri and iftar times for Dhaka, and the iftar countdown](docs/images/dashboard.png)](docs/images/dashboard.png) | [![Surah Al-Fatiha with Arabic text, Bengali and English translations and a recitation player](docs/images/quran-reader.png)](docs/images/quran-reader.png) |

Screenshots taken from the live demo on 2026-10-25.

### Guest walk-through

![A 27-second recording of the live demo in guest mode: the dashboard with Dhaka prayer, sehri and iftar times and the iftar countdown, the Ramadan 1448 timetable, ticking Fajr, Dhuhr and Asr in the Today tracker, the tasbih counter, and Surah Al-Fatiha in the Quran reader](docs/images/guest-demo.gif)

Recorded on 2026-10-26 with Playwright against the live demo, as a guest (no sign-in), with the browser location set to Dhaka and the time zone to Asia/Dhaka. Everything shown is guest data kept in the browser; nothing in the recording is saved to an account.

## Features

What this branch ships (the live demo may lag behind it; see [Status](#status)):

- **আজ (Today):** the next prayer and its countdown, Sehri and Iftar, the five prayer times, one sourced card for the moment (the sehri niyyah, the iftar dua, or the day's ayah) and a link to today's amal. Times come from the AlAdhan API (Karachi method, Hanafi Asr) for the district chosen at first run; IslamicAPI is used first when a key is set. Every time follows the 12-hour or 24-hour setting.
- **সময়সূচি (Sehri & Iftar Timetable):** the 30-day timetable for the stored district, or Dhaka (Asia/Dhaka) when none is stored; print and share. Outside Ramadan it shows the next one.
- **আমল (Amal):** today's checklist by time of day, the salah tracker (five prayers), Quran khatm progress, your own goals and an optional Ramadan journal. In the last ten nights it switches to the night view with the odd nights and the Laylatul Qadr dua.
- **কুরআন (Quran):** 114 surahs with Arabic (Amiri Quran), Bengali and English text and recitation audio, with "pick up from here". It reads from the database and falls back to [quranapi.pages.dev](https://quranapi.pages.dev).
- **দোয়া ও যিকির (Duas & Adhkar):** the sehri niyyah, the iftar dua and the Laylatul Qadr dua with Arabic, transliteration, meaning and source.
- Digital tasbih, the zakat calculator (you enter the nisab at today's gold or silver price; the app assumes none), prayer and Sehri/Iftar reminders (private ICS feed, Google Calendar sync, web push), Sadaqah & Support, and admin announcements.
- Bengali first, English second; light, night and auto themes; text size ("লেখা ও থিম").

Hidden until they work (`src/config/features.ts`; reachable only by URL, as a "coming soon" page, noindex): Hadith, Islamic Books, Islamic Quiz.

Limitations:

- Your progress is saved on this device for guests (or in your account when signed in). Times and Quran pages you have already opened keep working offline; anything new needs a connection.
- Announcements have no place on the screens yet (the old dashboard that showed them is retired).
- The niyyah and iftar dua Arabic lines are pending scholar review (marked in `src/lib/duas.ts`).

### Credits

Icons: [Hugeicons](https://hugeicons.com) (the free Islamic icon set and the MIT-licensed free stroke-rounded icons, hand-ported in `src/components/icons/islamic-icons.tsx`). Fonts: Tiro Bangla, Noto Sans/Serif Bengali, Noto Sans, Noto Serif, Noto Serif Display, Noto Naskh Arabic and Amiri Quran (SIL Open Font License), self-hosted via Fontsource.
## Tech stack

| Layer | What it uses |
| --- | --- |
| App | TanStack Start (TanStack Router, Vite, Nitro), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, use-intl (Bengali default, English) |
| Auth | Clerk (`clerkMiddleware()` in `src/start.ts`, `src/lib/auth/server.ts`, `src/server/auth-middleware.ts`) |
| Database | PostgreSQL hosted on Supabase |
| Data access | Prisma 7 with the `pg` adapter, on the server only, for all data (content, Quran, hadith, announcements, push, calendar and the planner data in `src/server/planner-impl.ts`). The Supabase Data API (REST) is not used |
| Tests | Vitest (unit), Playwright (e2e smoke against the built server) |
| Hosting | Vercel |

## Architecture

```mermaid
flowchart LR
  browser["Browser<br/>guest data in localStorage<br/>service worker for push"]
  app["TanStack Start app on Vercel<br/>pages, server functions, API routes"]
  clerk["Clerk<br/>sign-in"]
  db[("Supabase Postgres")]
  prayer["AlAdhan API<br/>(IslamicAPI when a key is set)"]
  quran["quranapi.pages.dev<br/>Quran fallback"]
  google["Google Calendar API"]
  cron["Scheduler, every 5 min<br/>(not set up; GitHub Actions<br/>runs hours apart here)"]
  pushsvc["Browser push services"]
  calapps["Calendar apps"]

  browser -->|HTTPS| app
  app --> clerk
  app -->|"Prisma (pg)"| db
  app --> prayer
  app --> quran
  app --> google
  cron -->|"GET /api/push/dispatch<br/>Bearer CRON_SECRET"| app
  app -->|web push| pushsvc --> browser
  calapps -->|private ICS feed| app
```

Supabase Auth is not used. Clerk user IDs are mapped to stable UUIDs (`src/lib/auth/server.ts`) and every server query filters by that ID. Prisma connects as the database owner, which bypasses Postgres row-level security, so the scoping in application code is what protects these queries. RLS is enabled with no grants for the API roles (`supabase/migrations/006_enable_rls.sql`) so the Data API exposes nothing. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md).

## Getting started

### Prerequisites

- Node.js 22 (see `.nvmrc`) and npm 10
- For signed-in features: a Postgres database (a Supabase project works) and a Clerk application
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

Open http://localhost:3000. Clerk needs keys even in development (the TanStack SDK has no keyless mode): set `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from a Clerk development instance. Prayer times, the timetable, the Quran reader (through its fallback), the guest tracker, plan, reminders list, tasbih and zakat work. Daily content, hadith, announcements and anything saved to an account need the database.

`npm run dev` first runs `scripts/generateVapidKeys.mjs`, which writes new VAPID keys into `.env.local` on every start (other lines and comments are kept). That breaks existing push subscriptions. If you rely on push locally, run `npx vite dev --port 3000` instead.

### Full setup

Fill in `.env.local`. [`.env.example`](.env.example) lists every variable the app and scripts read, with a comment for each. The minimum for signed-in use is `DATABASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Only `VITE_*` variables reach the browser; the Next.js-era `NEXT_PUBLIC_*` names are deprecated but still read as fallbacks (the table at the top of `.env.example` maps old to new). Without Clerk keys the server fails on every page. Clearly fake, well-formed keys (as in `.github/workflows/ci.yml`) are enough to render the signed-out pages for tests, as long as the browser carries Clerk's dev-browser cookie (the e2e fixtures set it); signing in needs real keys.

#### Database

There is no one-command schema setup yet. The SQL in `supabase/migrations` was written for Supabase Auth: it points `user_id` foreign keys at `auth.users`, where Clerk users never exist, so saving a profile fails on a fresh database. `prisma/schema.prisma` was introspected from the live database and also models Supabase's `auth` schema. Until a baseline Prisma migration replaces both, a new database needs fixing by hand after running the SQL files in order: drop the foreign key from `user_profiles.id` to `auth.users` and the `on_auth_user_created` trigger on `auth.users`, then point every other `user_id` foreign key (including `push_delivery_logs` and `admin_users`) at `user_profiles(id)`.

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
npm run translations:check
npm test        # Vitest unit tests
NITRO_PRESET=vercel npm run build   # Vercel output in .vercel/output; needs DATABASE_URL set, any well-formed URL works
```

CI then builds the Node server (`npm run build`, output in `.output/`), starts it with a placeholder `DATABASE_URL` and fake Clerk keys, and runs the Playwright smoke tests (`npm run test:e2e`, specs in `e2e/`), `scripts/pwa-check.mjs` and `scripts/check-csrf.mjs --auto`. Locally, export the same placeholder variables, then:

```bash
npm run build && PORT=3001 npm start &
npm run test:e2e              # E2E_NETWORK=1 also runs the checks that call third-party APIs
BASE_URL=http://localhost:3001 npm run check:pwa
npm run check:csrf -- http://localhost:3001 --auto
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Generate VAPID keys, then start the dev server |
| `npm run build` | `prisma generate` and `vite build` (Node server in `.output/`; `NITRO_PRESET=vercel` writes `.vercel/output/`) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests against a running built server |
| `npm run check:pwa` / `npm run check:csrf` | PWA and CSRF/auth-boundary checks against a running server |
| `npm run translations:check` | List keys missing from `src/messages/en.json` or `bn.json` |
| `npm run seed:quran` / `npm run seed:daily-content` | Seed content tables |
| `npm run vapid:generate` | Write a new VAPID key pair to `.env.local` |

## Deployment

The app is deployed on Vercel through its GitHub integration: each pull request gets a preview deployment and `main` deploys to production at [ramadan-planner-puce.vercel.app](https://ramadan-planner-puce.vercel.app). Set the variables from `.env.example` in the Vercel project settings, including `SITE_URL` (for this deployment, `https://ramadan-planner-puce.vercel.app`): robots.txt, sitemap.xml, canonical links and Open Graph URLs use it, and without it they fall back to the deprecated `NEXT_PUBLIC_SITE_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL`. Vite inlines `VITE_*` values at build time, so redeploy after changing them. `vercel.json` schedules one daily call to the push dispatcher; [Push reminders](#push-reminders) explains what else has to call it.

## Push reminders

`GET /api/push/dispatch` sends every push reminder that fell due in the last 10 minutes and records each send in `push_delivery_logs`, so overlapping runs do not send twice. It requires `Authorization: Bearer <CRON_SECRET>`. A reminder is only sent if a call lands within those 10 minutes; missed ones are not sent later. So something has to call the endpoint every 5 minutes.

Nothing in this repo does that reliably yet:

- Vercel Hobby crons run at most once a day (the one in `vercel.json` runs at 00:00 UTC).
- `.github/workflows/reminders-cron.yml` asks GitHub for a run every 5 minutes, but GitHub treats schedules as best effort. On this repository the 19 scheduled runs between 23 and 26 October 2026 started 2 to 5.5 hours apart, which would send only a few percent of reminders.

To turn push on, point a scheduler that keeps a 5-minute interval at the endpoint with the Bearer header, for example cron-job.org, Upstash QStash, Supabase `pg_cron` or a Vercel Pro cron. The GitHub workflow can run alongside it once you add the repository secrets `PUSH_DISPATCH_URL` (for example `https://your-domain/api/push/dispatch`) and `CRON_SECRET` (the same value as the deployment's); without them it exits without calling anything. Details in [docs/reminders.md](docs/reminders.md).

Known blocker: in this repo's schema, `push_delivery_logs.user_id` (like `admin_users.user_id`) references `auth.users`. If the live database matches, every delivery log insert fails for Clerk users and the endpoint answers 503 without sending. The fix is to point that foreign key at `user_profiles(id)`.

## Project structure

```text
src/
  routes/       File-based routes: pages (_app.* signed-in shell, _auth.* Clerk pages),
                API server routes (api/), robots.txt and sitemap.xml
  actions/      Server-function wrappers called by components (planner, announcements, ...)
  server/       Server-only implementations, auth/CSRF/error middleware, API handlers
  components/   UI grouped by feature; shadcn/ui primitives in ui/
  lib/          Prayer times, Ramadan dates and timetable, Quran, push schedule,
                calendar, auth and the Prisma client (unit tests sit next to them)
  i18n/         use-intl provider and locale loader
  messages/     bn.json and en.json
  start.ts      Request middleware (CSRF, Clerk) and global server-function middleware
prisma/         schema.prisma (introspected from the live database)
supabase/       SQL migrations, written for Supabase Auth (see Database)
scripts/        Content seeding, VAPID key generation, translation check
public/sw.js    Service worker: push notifications, offline page, cached build assets
e2e/            Playwright smoke tests (run in CI against the built server)
docs/           Architecture, API, data model, reminders, security, product spec
```

## Status

This is a personal project. The live deployment is a demo, not a supported service.

Live demo, checked 2026-10-26 (the Supabase database was restored that day):

- Works: landing page, dashboard with prayer, sehri and iftar times and the Ramadan 1448 timetable, the Quran list and reader, the guest tracker, plan and reminders lists, tasbih, zakat, and switching between Bengali and English. A guest's ticks and lists are kept in the browser (`localStorage`) and survive a reload.
- Works from the database: `/api/daily-content` returns the day's ayah, hadith and dua (200), the Today page shows them, the hadith page lists 63 editions (10 collections in 9 languages) with their chapters, and `/api/announcements` answers 200 (with no announcements published yet). The Quran API reads the database first and falls back to quranapi.pages.dev; its response does not say which one served it.
- Not checked: anything that saves to an account (logs, goals, reminders, profile, ICS links, Google Calendar sync). Sign-in runs on a Clerk development instance (`pk_test_` key), which is meant for testing, and the Clerk keys are set for the Production environment only, so Vercel preview deployments run without them.
- Not running: push reminders, because no scheduler calls the dispatcher every 5 minutes (see [Push reminders](#push-reminders)).

Known issues:

- The schema is not reproducible from this repo yet (see [Database](#database)).
- Push reminders need an external 5-minute scheduler (see [Push reminders](#push-reminders)).
- In English, the default location label still reads "ঢাকা, বাংলাদেশ", because the default is hard-coded in Bengali.
- Revoking an ICS link stops new requests, but the feed response is CDN-cached for up to an hour plus a 6-hour stale window.
- There is no rate limiting on push subscribe or calendar sync.

Next steps: move Clerk to a production instance (and add preview keys), add a baseline Prisma migration with the foreign keys pointed at `user_profiles(id)`, then finish the features in [docs/ROADMAP.md](docs/ROADMAP.md).

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
