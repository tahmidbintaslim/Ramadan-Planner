-- Ramadan Planner: lock down the Supabase Data API (PostgREST) with row-level security.
--
-- Why this is safe for the app:
--   * Auth is Clerk, not Supabase Auth. auth.uid() is always NULL for this app's users, so the old
--     auth.uid() policies from migrations 001-004 never matched anyone; they are dropped here.
--   * The app reaches the database only through Prisma, which connects as the table owner (postgres)
--     and therefore bypasses RLS. User isolation is enforced in application code (every query is
--     keyed by the Clerk-derived user id; see src/server/*-impl.ts). Nothing uses the Data API any
--     more (supabase-js was removed), so service_role is granted nothing.
--   * RLS + no grants means the anon/authenticated API roles can read only the public reference
--     content below, and nothing else, even if a future GRANT is added by mistake.
--
-- Not applied automatically: review, then run it once (Supabase SQL editor or psql as postgres).
-- It is idempotent (drop ... if exists, revoke, enable) and runs in one transaction.

begin;

-- ── 1. Enable RLS on every public table ─────────────────────────────────

alter table public.daily_content      enable row level security;
alter table public.announcements      enable row level security;
alter table public.quran_surahs       enable row level security;
alter table public.quran_ayahs        enable row level security;
alter table public.quran_reciters     enable row level security;
alter table public.hadith_editions    enable row level security;
alter table public.hadith             enable row level security;
alter table public.user_profiles      enable row level security;
alter table public.daily_logs         enable row level security;
alter table public.prayer_goals       enable row level security;
alter table public.plan_tasks         enable row level security;
alter table public.reminder_rules     enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_logs enable row level security;
alter table public.calendar_links     enable row level security;
alter table public.admin_users        enable row level security;

-- _prisma_migrations exists only where Prisma Migrate has run; enable it when present.
do $$
begin
  if to_regclass('public._prisma_migrations') is not null then
    execute 'alter table public._prisma_migrations enable row level security';
  end if;
end
$$;

-- ── 2. Drop the legacy Supabase Auth policies (names from migrations 001-004) ──
-- auth.uid() / auth.role() policies: never true for Clerk users, and service_role needs none.

drop policy if exists "Users can read own plan tasks"   on public.plan_tasks;
drop policy if exists "Users can insert own plan tasks" on public.plan_tasks;
drop policy if exists "Users can update own plan tasks" on public.plan_tasks;
drop policy if exists "Users can delete own plan tasks" on public.plan_tasks;

drop policy if exists "Users can read own prayer goals"   on public.prayer_goals;
drop policy if exists "Users can insert own prayer goals" on public.prayer_goals;
drop policy if exists "Users can update own prayer goals" on public.prayer_goals;
drop policy if exists "Users can delete own prayer goals" on public.prayer_goals;

drop policy if exists "Admins can read own admin row"       on public.admin_users;
drop policy if exists "Service role can manage admin users" on public.admin_users;

drop policy if exists "Users can read own delivery logs"      on public.push_delivery_logs;
drop policy if exists "Service role can manage delivery logs" on public.push_delivery_logs;

-- The same kind of policies on the other user tables (001), in case a database still has them.
drop policy if exists "Users can read own profile"   on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

drop policy if exists "Users can read own logs"   on public.daily_logs;
drop policy if exists "Users can insert own logs" on public.daily_logs;
drop policy if exists "Users can update own logs" on public.daily_logs;
drop policy if exists "Users can delete own logs" on public.daily_logs;

drop policy if exists "Users can read own reminders"   on public.reminder_rules;
drop policy if exists "Users can insert own reminders" on public.reminder_rules;
drop policy if exists "Users can update own reminders" on public.reminder_rules;
drop policy if exists "Users can delete own reminders" on public.reminder_rules;

drop policy if exists "Users can manage own subscriptions"  on public.push_subscriptions;
drop policy if exists "Users can manage own calendar links" on public.calendar_links;

-- Reference-table policies from 001/002: replaced by the explicit read-only policies below.
drop policy if exists "Anyone can read daily content"          on public.daily_content;
drop policy if exists "Service role can manage daily content"  on public.daily_content;
drop policy if exists "Anyone can read active announcements"   on public.announcements;
drop policy if exists "Service role can manage announcements"  on public.announcements;
drop policy if exists "Anyone can read quran surahs"           on public.quran_surahs;
drop policy if exists "Service role can manage quran surahs"   on public.quran_surahs;
drop policy if exists "Anyone can read quran ayahs"            on public.quran_ayahs;
drop policy if exists "Service role can manage quran ayahs"    on public.quran_ayahs;
drop policy if exists "Anyone can read reciters"               on public.quran_reciters;
drop policy if exists "Service role can manage reciters"       on public.quran_reciters;

-- ── 3. Start from nothing: revoke every API-role privilege in public ──────
-- service_role is included: nothing uses the Data API, so it needs no table access either.

revoke all on all tables    in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke all on all functions in schema public from anon, authenticated, service_role;

-- Future objects created by postgres (Prisma, the SQL editor) get no API-role privileges either.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;

-- The API roles may see the schema (needed for the reference-content reads below), nothing more.
grant usage on schema public to anon, authenticated;

-- ── 4. Public, read-only reference content ───────────────────────────────

grant select on public.daily_content   to anon, authenticated;
grant select on public.quran_surahs    to anon, authenticated;
grant select on public.quran_ayahs     to anon, authenticated;
grant select on public.quran_reciters  to anon, authenticated;
grant select on public.hadith_editions to anon, authenticated;
grant select on public.hadith          to anon, authenticated;
grant select on public.announcements   to anon, authenticated;

drop policy if exists "Public read daily content"   on public.daily_content;
drop policy if exists "Public read quran surahs"    on public.quran_surahs;
drop policy if exists "Public read quran ayahs"     on public.quran_ayahs;
drop policy if exists "Public read quran reciters"  on public.quran_reciters;
drop policy if exists "Public read hadith editions" on public.hadith_editions;
drop policy if exists "Public read hadith"          on public.hadith;
drop policy if exists "Public read active announcements" on public.announcements;

create policy "Public read daily content"   on public.daily_content   for select to anon, authenticated using (true);
create policy "Public read quran surahs"    on public.quran_surahs    for select to anon, authenticated using (true);
create policy "Public read quran ayahs"     on public.quran_ayahs     for select to anon, authenticated using (true);
create policy "Public read quran reciters"  on public.quran_reciters  for select to anon, authenticated using (true);
create policy "Public read hadith editions" on public.hadith_editions for select to anon, authenticated using (true);
create policy "Public read hadith"          on public.hadith          for select to anon, authenticated using (true);

-- Announcements only inside their active window (columns start_at / end_at, prisma/schema.prisma).
create policy "Public read active announcements" on public.announcements
  for select to anon, authenticated
  using (start_at <= now() and (end_at is null or end_at >= now()));

-- ── 5. User data and internals: no grants, no policies ───────────────────
-- RLS on + no policy = no rows for any API role. The explicit revokes document the intent and
-- undo any grant made since step 3 ran in another session.

revoke all on public.user_profiles      from anon, authenticated;
revoke all on public.daily_logs         from anon, authenticated;
revoke all on public.prayer_goals       from anon, authenticated;
revoke all on public.plan_tasks         from anon, authenticated;
revoke all on public.reminder_rules     from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_delivery_logs from anon, authenticated;
revoke all on public.calendar_links     from anon, authenticated;
revoke all on public.admin_users        from anon, authenticated;

do $$
begin
  if to_regclass('public._prisma_migrations') is not null then
    execute 'revoke all on public._prisma_migrations from anon, authenticated';
  end if;
end
$$;

-- Any other table in public (e.g. the billing tables from 005, or one added outside these files):
-- RLS on, no API-role access. The reference tables above keep their grants.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in (
        'daily_content', 'announcements', 'quran_surahs', 'quran_ayahs', 'quran_reciters',
        'hadith_editions', 'hadith'
      )
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated, service_role', t.tablename);
  end loop;
end
$$;

commit;
