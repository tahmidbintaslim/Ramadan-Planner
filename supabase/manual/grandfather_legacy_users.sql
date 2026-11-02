-- ONE-TIME SCRIPT, run manually at the billing cutover. NEVER add this to supabase/migrations:
-- re-running it later (or in an environment seeded from prod) would give permanent Plus to users
-- who signed up after launch.
--
-- Grants permanent Plus ('legacy_signup') to every user created before the launch cutoff.
-- Usage (cutoff is required; quote it as a SQL literal):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v launch_cutoff="'2027-01-15T00:00:00Z'" \
--     -f supabase/manual/grandfather_legacy_users.sql
-- Idempotent per user (ON CONFLICT DO NOTHING); safe to re-run with the SAME cutoff.

\if :{?launch_cutoff}
\else
  \echo 'launch_cutoff is required, e.g. -v launch_cutoff="''2027-01-15T00:00:00Z''"'
  \quit
\endif

WITH granted AS (
  INSERT INTO public.entitlement_grants (user_id, source)
  SELECT id, 'legacy_signup' FROM public.user_profiles
  -- created_at is nullable (001_initial_schema.sql); a profile without one cannot be shown to be
  -- post-launch, so it counts as legacy rather than losing access.
  WHERE created_at IS NULL OR created_at < :launch_cutoff::timestamptz
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id
)
SELECT count(*) AS legacy_grants_inserted FROM granted;
