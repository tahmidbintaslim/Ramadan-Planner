-- Ramadan Planner: give each Ramadan its own daily logs.
--
-- daily_logs was unique on (user_id, day) with day 1-30 and no year, so next Ramadan's day 1 would
-- overwrite this Ramadan's day 1. Logs now carry the Hijri year of the Ramadan they belong to
-- (ramadan_year); the app derives it from the user's local date (hijriYearForDate in
-- src/lib/ramadan-date.ts) and keys reads and writes by (user_id, ramadan_year, day).
--
-- Existing rows are backfilled as 1448. If a database holds logs from Ramadan 1447 (Feb-Mar 2026)
-- that should stay out of Ramadan 1448, set those first, e.g.
--   update public.daily_logs set ramadan_year = 1447 where log_date < date '2026-06-01';
-- after the backfill below and before relying on the data.
--
-- Not applied automatically: run it once, as the table owner. Prisma connects as the owner and
-- bypasses RLS (auth is Clerk), so no policies change here.

begin;

alter table public.daily_logs add column if not exists ramadan_year integer;

update public.daily_logs set ramadan_year = 1448 where ramadan_year is null;

alter table public.daily_logs alter column ramadan_year set default 1448;
alter table public.daily_logs alter column ramadan_year set not null;

alter table public.daily_logs drop constraint if exists daily_logs_ramadan_year_check;
alter table public.daily_logs
  add constraint daily_logs_ramadan_year_check check (ramadan_year between 1400 and 1600);

-- The old one-log-per-day key: a constraint from 001 (UNIQUE(user_id, day)) or a unique index from
-- `prisma db push` (@@unique([userId, day])); both are named daily_logs_user_id_day_key.
alter table public.daily_logs drop constraint if exists daily_logs_user_id_day_key;
drop index if exists public.daily_logs_user_id_day_key;

-- The new key, named as Prisma names @@unique([userId, ramadanYear, day]).
alter table public.daily_logs drop constraint if exists daily_logs_user_id_ramadan_year_day_key;
drop index if exists public.daily_logs_user_id_ramadan_year_day_key;
create unique index daily_logs_user_id_ramadan_year_day_key
  on public.daily_logs (user_id, ramadan_year, day);

commit;
