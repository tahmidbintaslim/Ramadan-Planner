-- 008: store the ICS feed secret as a SHA-256 hash instead of plaintext.
--
-- The feed URL /api/calendar/ics/<secret> is a bearer credential. Until now calendar_links.ics_secret held
-- it in plaintext, with no index (every feed request was a sequential scan). The app now:
--   * writes only ics_secret_hash = lowercase hex SHA-256 of the UTF-8 secret, and leaves ics_secret NULL;
--   * looks a feed up by hashing the incoming token and matching ics_secret_hash, OR (legacy rows this
--     migration has not reached) ics_secret = token, and on a legacy match rewrites the row to the hash.
--
-- Apply this BEFORE deploying the code that reads ics_secret_hash (Prisma selects the column, so requests
-- touching calendar_links fail until it exists). Idempotent; safe to re-run.

ALTER TABLE public.calendar_links
  ADD COLUMN IF NOT EXISTS ics_secret_hash TEXT DEFAULT NULL;

-- Unique: a hash identifies exactly one feed, and the lookup is an index probe.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_links_ics_secret_hash_key
  ON public.calendar_links (ics_secret_hash);

-- Backfill: hash the existing plaintext secrets (same encoding as the app: hex of sha256 over UTF-8 bytes;
-- sha256(bytea) is built in since PostgreSQL 11, no pgcrypto needed), then drop the plaintext. Existing feed
-- URLs keep working because the app hashes the incoming token.
UPDATE public.calendar_links
SET ics_secret_hash = encode(sha256(convert_to(ics_secret, 'UTF8')), 'hex')
WHERE ics_secret IS NOT NULL
  AND btrim(ics_secret) <> ''
  AND ics_secret_hash IS NULL;

UPDATE public.calendar_links
SET ics_secret = NULL
WHERE ics_secret IS NOT NULL
  AND ics_secret_hash IS NOT NULL;

COMMENT ON COLUMN public.calendar_links.ics_secret_hash IS
  'Lowercase hex SHA-256 of the ICS feed secret. The plaintext secret is shown to the user once and never stored.';
COMMENT ON COLUMN public.calendar_links.ics_secret IS
  'DEPRECATED: legacy plaintext ICS secret. Always NULL for rows written by the current app; drop once empty.';
