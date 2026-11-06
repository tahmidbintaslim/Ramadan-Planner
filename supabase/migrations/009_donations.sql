-- Ramadan Planner: anonymous card-donation ledger (Stripe, optional sadaqah).
--
-- NOT APPLIED YET. Apply it once, by hand, before the Stripe webhook is pointed at a deployment
-- (see docs/donations.md).
--
-- Note on 005: 005_billing.sql (billing_customers, subscriptions, stripe_events, entitlement_grants for the
-- dropped Free/Plus plan) was NEVER applied to production; the audit found none of those tables. The file was
-- deleted, so the numbering skips it. If some non-production database did apply it, drop those four tables by
-- hand; this migration does not touch them.
--
-- Privacy: no donor PII. No name, email, address, card or Clerk id; only the billing country when Stripe has
-- one. Rows are written only by the server (POST /api/stripe/webhook) and read only by the server for the
-- public, aggregated GET /api/donations/summary.

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stripe event id (evt_...). UNIQUE makes webhook retries and duplicate deliveries a no-op.
  stripe_event_id TEXT NOT NULL UNIQUE,
  -- PaymentIntent id (pi_...) of the payment; refund rows repeat the refunded payment's id.
  stripe_object_id TEXT NOT NULL,
  -- Subscription id (sub_...) for monthly donations, so the donor count counts a monthly donor once.
  stripe_subscription_id TEXT,
  -- Amount in the currency's minor unit (cents, pence, paisa). Refund rows hold the refunded part, positive.
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('usd', 'gbp', 'eur', 'bdt')),
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'monthly')),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded')),
  -- ISO 3166-1 alpha-2 billing country, only when present.
  country TEXT CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_stripe_object_id ON public.donations(stripe_object_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON public.donations(created_at);

-- RLS on with no policies, and no grants to the API roles: PostgREST (anon / authenticated) can neither read
-- nor write. Only the server's database connection (table owner / service role) reaches this table.
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.donations FROM anon, authenticated;
