-- Applied to production 2026-11-09. First-party, cookieless usage events (page views and feature actions) for the
-- admin dashboard. Server-only: RLS on with no policies, so the anon/authenticated roles can neither read nor write.
create table if not exists public.usage_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 48),
  path text not null default '' check (char_length(path) <= 120),
  user_id uuid null,
  locale text not null default '' check (char_length(locale) <= 5)
);
create index if not exists usage_events_at_idx on public.usage_events (at);
create index if not exists usage_events_name_at_idx on public.usage_events (name, at);
alter table public.usage_events enable row level security;
