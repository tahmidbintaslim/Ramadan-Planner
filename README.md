# Ramadan Planner

**Live demo:** [ramadan-planner-puce.vercel.app](https://ramadan-planner-puce.vercel.app) (working demo, partly down: its database is unreachable, so daily content and announcements do not load there, and its current build also shows an empty Quran list. Sign-in runs on a Clerk development instance. Prayer times and the guest tracker work.)

A Bengali-first web app for planning and tracking Ramadan, with English as a second language. You can use it as a guest, with data kept in your browser, or sign in to save it to the database.

## Features

- Prayer, sehri and iftar times for your location from the AlAdhan API (Karachi method, Hanafi Asr), with the Hijri date and per-country Hijri offsets.
- Ramadan status banner and countdown.
- Today tracker: the five daily prayers plus Taraweeh and Tahajjud, Quran progress, a daily checklist, a day task, a journal and "My Dua".
- Goals and a pre-Ramadan plan.
- Quran reader: 114 surahs with Arabic, Bengali and English text and recitation audio. Reads from the database and falls back to [quranapi.pages.dev](https://quranapi.pages.dev) when the database is empty or unreachable.
- Hadith browser (from the database, seeded from hadithapi.com).
- Tasbih counter and zakat calculator.
- Reminder rules, delivered as a private ICS feed, through Google Calendar sync, or as web push. Push needs the scheduler described in [Push reminders](#push-reminders).
- Admin announcements.

Not built yet: Islamic books, a duas collection and a quiz (their pages say "coming soon"), plus the Laylatul Qadr mode and sleep dhikr checklist in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Stack

| Layer | What it uses |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, next-intl (Bengali default, English) |
| Auth | Clerk (`src/proxy.ts`, `src/lib/auth/server.ts`) |
| Database | PostgreSQL hosted on Supabase |
| Data access | Prisma 7 with the `pg` adapter for content, Quran, hadith, announcements, push and calendar data; `supabase-js` with the service role key, on the server only, for planner data (daily logs, goals, plan tasks, reminder rules, profile) in `src/actions/planner.ts` |
| Tests | Vitest |
| Hosting | Vercel |

Supabase Auth is not used. Clerk user IDs are mapped to stable UUIDs (`src/lib/auth/server.ts`) and every server query filters by that ID. The service role key bypasses Postgres row-level security, so the RLS policies in `supabase/migrations` do not protect these queries; the scoping in application code does.

## Getting started

You need Node.js 22, npm, a Supabase project (Postgres plus its REST API, which the planner actions use) and a Clerk application.

```bash
npm ci
cp .env.example .env.local   # then fill in the values
```

`.env.example` lists every variable with a comment. The minimum to run the app is `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

### Database

There is no one-command schema setup yet. The SQL in `supabase/migrations` was written for Supabase Auth: it points `user_id` foreign keys at `auth.users`, where Clerk users never exist, so saving a profile fails on a fresh database. `prisma/schema.prisma` was introspected from the live database and also models Supabase's `auth` schema. Until a baseline Prisma migration replaces both, a new database needs those foreign keys pointed at `user_profiles(id)` by hand after running the SQL files in order.

Seed content (each script reads `DIRECT_URL` or `DATABASE_URL` from `.env.local`):

```bash
npm run seed:quran           # surahs, ayahs, reciters from quranapi.pages.dev
npm run seed:daily-content   # day 1-30 content
npx tsx scripts/seed-hadith.ts   # needs HADITHAPI_KEY
```

### Run

```bash
npm run dev
```

`npm run dev` first runs `scripts/generateVapidKeys.mjs`, which writes new VAPID keys to `.env.local` every time. That breaks existing push subscriptions. If you rely on push locally, run `npx next dev --turbopack` instead.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Generate VAPID keys, then start the dev server |
| `npm run build` | `prisma generate` and `next build` (needs `DATABASE_URL` set; any well-formed URL works for a build) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npx tsc --noEmit` | Type check |
| `npm run translations:check` | List keys missing from `src/messages/en.json` or `bn.json` |
| `npm run seed:quran` / `npm run seed:daily-content` | Seed content tables |
| `npm run vapid:generate` | Write a new VAPID key pair to `.env.local` |

## Push reminders

`GET /api/push/dispatch` sends every push reminder that fell due in the last 10 minutes and records each send in `push_delivery_logs`, so overlapping runs do not send twice. It requires `Authorization: Bearer <CRON_SECRET>`.

Vercel Hobby crons run at most once a day (the one in `vercel.json` runs at 00:00 UTC), so `.github/workflows/reminders-cron.yml` calls the endpoint every 5 minutes. To turn it on, add two repository secrets under Settings > Secrets and variables > Actions:

- `PUSH_DISPATCH_URL`: for example `https://your-domain/api/push/dispatch`
- `CRON_SECRET`: the same value as the deployment's `CRON_SECRET`

Without them the workflow exits without calling anything. GitHub can start scheduled runs late and pauses them after 60 days without repository activity.

Known blocker: in this repo's schema, `push_delivery_logs.user_id` (like `admin_users.user_id`) references `auth.users`. If the live database matches, every delivery log insert fails for Clerk users and the endpoint answers 503 without sending. The fix is to point that foreign key at `user_profiles(id)`.

## Known issues

- The schema is not reproducible from this repo yet (see [Database](#database)).
- `/api/ramadan-timetable` only scans the previous, current and next two Gregorian months, so outside that range (for Ramadan 1448, before December 2026) the landing page timetable shows an error.
- Revoking an ICS link stops new requests, but the feed response is CDN-cached for up to an hour plus a 6-hour stale window.
- There is no rate limiting on push subscribe or calendar sync.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit
- [docs/api.md](docs/api.md): API routes and response shapes
- [docs/reminders.md](docs/reminders.md) and [docs/calendar-sync.md](docs/calendar-sync.md): reminder channels
- [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md): data isolation and secrets
- [docs/db.md](docs/db.md) and [docs/DATA_MODEL.md](docs/DATA_MODEL.md): tables
- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) and [docs/ROADMAP.md](docs/ROADMAP.md): plans, including features not built yet

## License

[MIT](LICENSE)
