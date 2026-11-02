# Freemium billing (R1): design spec

Date: 2026-11-02. Status: draft for founder review. Scope: release R1 of `docs/STRATEGY.md` (billing, entitlements, gating). Cloud sync, new content features and marketing work are separate specs.

## Goal

Add a Free/Plus plan to Ramadan Planner, paid through Stripe, with every Plus feature enforced on the server. Success: a user can start a 7-day card-required trial, pay, manage or cancel in the Stripe portal, and gets or loses Plus access within seconds of the webhook, with no way to reach Plus data without an entitlement.

## Decisions (from the founder)

- Plans: Free (local tracker, prayer times, Quran, tasbih, zakat, 3 reminders) and Plus ($3/mo or $24/yr; cloud sync, unlimited reminders and push, calendar sync, plus later R2/R3 content).
- Trial: 7 days, card required.
- Existing accounts are grandfathered with a snapshot grant.
- The business entity is in a Stripe-supported country. Stripe test mode only until launch.
- Never gated: prayer times, Quran, core tracking, or a user's existing data. After a downgrade, data stays readable and new Plus writes are blocked.

## Framework update (2026-11-02)

The founder chose to move the app from Next.js to **TanStack Start** (see `docs/STRATEGY.md` section 8 and the phased plan). This spec stays valid with these substitutions: server actions become server functions behind an auth middleware; the webhook becomes a TanStack server route at `src/routes/api/stripe/webhook.ts` (reads `request.text()` for the signature check); `NEXT_PUBLIC_APP_URL` is renamed if the new build tool needs a different public prefix. All billing logic lives in framework-free modules in `src/lib/` so it is identical on either framework.

## Architecture

Server is the only source of truth for plan status. UI locks are cosmetic.

```
Clerk user -> getAppAuthUser() -> userId (UUID)
Checkout/Portal actions (src/actions/billing.ts) -> Stripe
Stripe webhook (/api/stripe/webhook) -> billing tables (service role)
getEntitlement(userId) -> { plan, status, source }   <- single source
requirePlus(userId) -> called by every Plus action/route
```

### Data (`supabase/migrations/005_billing.sql` plus Prisma models)

- `billing_customers(user_id pk -> user_profiles, stripe_customer_id unique)`
- `subscriptions(id pk, user_id, status, price_id, current_period_end, trial_end, cancel_at_period_end, event_created, updated_at)`
- `stripe_events(id pk, type, processed_at)` for idempotency
- `entitlement_grants(user_id pk, source, expires_at)` for grandfathering and comps

RLS is enabled with no policies (Clerk is used, so `auth.uid()` never matches); all access goes through server code. The grandfather migration inserts a `legacy_signup` grant for every `user_profiles` row created before the launch date, as a one-time snapshot.

### Entitlement rule (`src/lib/entitlements.ts`)

Plus if: a valid grant exists, or the subscription status is `active` or `trialing`, or `past_due` within a 5-day grace window. Otherwise Free. Constant `FREE_REMINDER_LIMIT = 3`.

### Stripe (`src/lib/stripe.ts`, `src/actions/billing.ts`)

- Hosted Checkout, subscription mode, `trial_period_days: 7`, `payment_method_collection: "always"`, `trial_settings.end_behavior.missing_payment_method = "cancel"`.
- Client sends only `interval: "month" | "year"` (zod). Price IDs come from env (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`); success and cancel URLs are derived from `NEXT_PUBLIC_APP_URL`.
- Customer created lazily with idempotency key `cust-<userId>`; `client_reference_id` and `metadata.user_id` / `clerk_id` on customer and subscription. Always pass `customer=`.
- Customer Portal: payment method, invoices, cancel at period end, monthly/yearly switch limited to the two prices.
- Objects tagged `metadata.app=ramadan-planner`, `lookup_key` `rp_plus_monthly` / `rp_plus_yearly`. Trial abuse: one trial per card fingerprint and per `stripe_customer_id`; rate-limit checkout creation.

### Webhook (`src/app/api/stripe/webhook/route.ts`)

Node runtime, raw body via `req.text()`, `constructEvent` signature check, insert event id first (duplicate returns 200), re-fetch the subscription from Stripe rather than trusting the payload, reject prices outside the allowlist, return 5xx on failure so Stripe retries. Handles `checkout.session.completed`, `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid|payment_failed`, `charge.refunded` (full refunds revoke access), `customer.deleted`. Out-of-order guard: apply only if `event.created >= subscriptions.event_created`.

### Gating points

- `createReminderRuleAction` and re-enable in `updateReminderRuleAction` (`src/actions/planner.ts`): free users capped at 3 enabled rules.
- `/api/push/dispatch`: free users send at most 3 enabled rules (oldest first).
- `/api/calendar/ics/[secret]` and `/api/calendar/google/*`: 403 when not Plus; shorten the CDN cache on gated responses.
- Cloud writes for daily logs, goals and tasks: **deferred to R2.** Gating them needs the local-first fallback, otherwise signed-in free users could not save. In R1 they stay as they are.
- A test asserts the gated reminder actions call the entitlement check.

### Security notes for R1

No logging of full Stripe events; update `docs/SECURITY_PRIVACY.md` (Stripe as sub-processor). Billing tables are read and written only through server code (Prisma).

### Changes after checking the code (2026-11-02)

- Splitting the service-role Supabase client is **out of R1**: every planner action in `src/actions/planner.ts` reads and writes with that key because RLS has no policies for Clerk users. Splitting it needs a different data-access design; tracked as a risk, not a task.
- Changing the admin check to ids only is **out of R1**: it would lock out admins configured through `ADMIN_EMAILS`.
- Per-checkout rate limiting is **out of R1** (no rate-limit package is installed). Trial abuse is limited by giving the trial only to a user who has never had a subscription.

### UI

`/pricing` (Free vs Plus, monthly/yearly toggle, trial CTA), a billing section in Settings (plan, renewal date, manage button, past-due banner linking to the portal), an `UpgradeGate` component for locked features. All strings in Bengali and English (`translations:check` must pass). Soft gates for previews, a hard gate only for the reminder limit.

## Testing

Vitest: `getEntitlement` matrix (grant, active, trialing, past_due inside/outside grace, canceled), webhook signature rejection, duplicate event, out-of-order event, price allowlist, reminder-cap enforcement, the "every Plus action calls requirePlus" check. Manual end-to-end with Stripe test cards (success, decline, 3DS) and the Stripe CLI webhook forwarder. Test mode only.

## Out of scope for this spec

Cloud-sync merge logic, streaks/stats, Laylatul Qadr, duas/quiz/books, PWA work, regional or BDT pricing, emails, marketing pages. Each gets its own spec after R1.

## Open items before launch (not blockers for building)

Confirm the entity country with Stripe; decide on a separate Stripe account; production Clerk instance; a working 5-minute scheduler for push; tax registration (Stripe Tax) and refund policy wording.
