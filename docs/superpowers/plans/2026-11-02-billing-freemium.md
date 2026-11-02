# Freemium Billing (R1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Free/Plus plans with Stripe Checkout, Customer Portal, webhook-synced subscriptions and server-side gating of the reminder cap, push dispatch and calendar sync.

**Architecture:** Billing state lives in four new tables read and written through Prisma only. A pure `resolvePlan` function turns (grant, subscription, now) into a plan; `getEntitlement(userId)` loads the rows and calls it. Stripe events are applied by a testable `applyStripeEvent` that the webhook route calls after verifying the signature. UI locks are cosmetic.

**Tech Stack:** Next.js 16 App Router, Clerk, Prisma 7 (`pg` adapter), supabase-js (existing planner actions), zod 4, Vitest, `stripe` (new dependency), next-intl.

**Spec:** `docs/superpowers/specs/2026-11-02-billing-freemium-design.md`

## Global Constraints

- Plus price: $3/month and $24/year, 7-day trial, card required (`payment_method_collection: "always"`, `trial_settings.end_behavior.missing_payment_method = "cancel"`).
- Plus = grant, or status `active`/`trialing`, or `past_due` within a 5-day grace window. Free reminder limit: `FREE_REMINDER_LIMIT = 3`.
- Server enforces everything; the client sends only `interval: "month" | "year"`. Price IDs come from env (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`); redirect URLs come from `NEXT_PUBLIC_APP_URL`.
- Stripe test mode only; no live keys in the repo. Tag Stripe objects `metadata.app=ramadan-planner`.
- All user-facing strings exist in `src/messages/bn.json` and `src/messages/en.json`; `npm run translations:check` must pass.
- Tests are `src/**/*.test.ts` (Vitest, node environment). Never log full Stripe events.
- Do not gate prayer times, Quran, core tracking, or daily log/goal/task writes (R2).

## Review Focus

- Webhook delivered twice, or `subscription.updated` arriving before `created` → one correct row, no double effect.
- Event for a price outside the allowlist → rejected, no entitlement.
- `past_due` exactly at the end of the grace window → Free; inside → Plus.
- Free user at exactly 3 enabled reminders re-enabling a disabled one → blocked; Plus user → allowed.
- Grandfathered user with a canceled subscription → still Plus; expired grant → Free.

---

### Task 1: Dependency, migration, Prisma models

**Files:**
- Modify: `package.json` (add `stripe`), `prisma/schema.prisma`
- Create: `supabase/migrations/005_billing.sql`

**Interfaces:**
- Produces Prisma models (all `@@schema("public")`, snake_case `@map`): `BillingCustomer {userId @id, stripeCustomerId @unique}`, `Subscription {id @id, userId, status, priceId, currentPeriodEnd?, trialEnd?, cancelAtPeriodEnd, eventCreated}`, `StripeEvent {id @id, type, processedAt}`, `EntitlementGrant {userId @id, source, expiresAt?}`; `UserProfile` gains the relations.

- [ ] **Step 1:** `npm i stripe` and commit the lockfile change with the code.
- [ ] **Step 2:** Write `005_billing.sql` creating the four tables with `user_id uuid references public.user_profiles(id) on delete cascade`, `alter table ... enable row level security` with no policies, an index on `subscriptions(user_id)`, and a final statement `insert into public.entitlement_grants (user_id, source) select id, 'legacy_signup' from public.user_profiles on conflict do nothing` (the grandfather snapshot, run once at migration time).
- [ ] **Step 3:** Add the four Prisma models and relations; run `npx prisma validate` and `npx prisma generate`. Expected: both succeed.
- [ ] **Step 4:** `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 5:** Commit `feat(billing): billing tables and grandfather snapshot`.

### Task 2: Entitlements

**Files:**
- Create: `src/lib/entitlements.ts`, `src/lib/entitlements.test.ts`

**Interfaces:**
- Produces: `FREE_REMINDER_LIMIT = 3`, `PAST_DUE_GRACE_DAYS = 5`, `type Plan = "free" | "plus"`, `type PlanSource = "grant" | "subscription" | "none"`, `resolvePlan(input: { grant: { expiresAt: Date | null } | null; subscription: { status: string; currentPeriodEnd: Date | null } | null; now: Date }): { plan: Plan; source: PlanSource }`, `getEntitlement(userId: string, now?: Date): Promise<{ plan: Plan; source: PlanSource }>`, `canEnableAnotherReminder(plan: Plan, enabledCount: number): boolean`.

- [ ] **Step 1:** Write failing tests for `resolvePlan`: no rows → free/none; unexpired and null-expiry grant → plus/grant; expired grant → free; `active` and `trialing` → plus/subscription; `past_due` with `currentPeriodEnd` 4 days ago → plus, 6 days ago → free; `canceled` and `incomplete` → free; grant plus canceled subscription → plus/grant. For `canEnableAnotherReminder`: free at 2 → true, free at 3 → false, plus at 50 → true.
- [ ] **Step 2:** Run `npx vitest run src/lib/entitlements.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the three pure functions; `getEntitlement` loads the user's grant and newest subscription through `prisma` and delegates to `resolvePlan`.
- [ ] **Step 4:** Re-run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(billing): entitlement resolution`.

### Task 3: Stripe client and price allowlist

**Files:**
- Create: `src/lib/stripe.ts`, `src/lib/stripe.test.ts`

**Interfaces:**
- Produces: `getStripe(): Stripe` (lazy singleton from `STRIPE_SECRET_KEY`, pinned `apiVersion`; throws a clear error if the key is unset, only when called), `priceIdForInterval(interval: "month" | "year"): string`, `isAllowedPrice(priceId: string): boolean` (true only for the two env prices), `trialDaysFor(hasHadSubscription: boolean): number` (7, or 0 if the user ever had a subscription), `intervalSchema` (zod enum).

- [ ] **Step 1:** Write failing tests with `vi.stubEnv` for both price vars: `priceIdForInterval` maps correctly; `isAllowedPrice("price_other")` and `isAllowedPrice("")` are false; unset env makes `priceIdForInterval` throw; `trialDaysFor(false) === 7`, `trialDaysFor(true) === 0`; `intervalSchema.safeParse("week").success === false`.
- [ ] **Step 2:** Run `npx vitest run src/lib/stripe.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Importing the module must not require `STRIPE_SECRET_KEY` (builds run without it).
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(billing): stripe client and price allowlist`.

### Task 4: Webhook processing and route

**Files:**
- Create: `src/lib/stripe-events.ts`, `src/lib/stripe-events.test.ts`, `src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `isAllowedPrice`, `getStripe`.
- Produces: `applyStripeEvent(event: Stripe.Event, deps: { retrieveSubscription(id: string): Promise<Stripe.Subscription>; db: BillingDb }): Promise<"applied" | "duplicate" | "ignored">`, where `BillingDb` is a small interface (`recordEvent(id, type): Promise<boolean>` returning false if already recorded; `userIdForCustomer(customerId)`; `linkCustomer(userId, customerId)`; `upsertSubscription(row)`; `getEventCreated(subscriptionId)`), with a Prisma-backed implementation exported as `prismaBillingDb`.

- [ ] **Step 1:** Write failing tests with an in-memory `BillingDb` and stubbed `retrieveSubscription`: (a) the same event id twice → second returns `"duplicate"` and writes once; (b) `customer.subscription.updated` whose `created` is older than the stored `eventCreated` → `"ignored"`, row unchanged; (c) subscription with a price outside the allowlist → `"ignored"` and no row; (d) `checkout.session.completed` links `client_reference_id` to the customer, then upserts the re-fetched subscription (status, `price_id`, period end, trial end, `cancel_at_period_end`); (e) `customer.subscription.deleted` stores status `canceled`; (f) `charge.refunded` fully refunded → subscription marked `canceled`, partial refund → no change; (g) unknown event type → `"ignored"`.
- [ ] **Step 2:** Run `npx vitest run src/lib/stripe-events.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `applyStripeEvent`: record the event id first, always re-fetch the subscription from Stripe instead of trusting the payload, map the customer to the user through `billing_customers`. Handled types: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `customer.deleted`.
- [ ] **Step 4:** Implement `POST` in the route: `export const runtime = "nodejs"`, read `await req.text()`, verify with `getStripe().webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` (400 on failure or a missing header), call `applyStripeEvent`, return 200 for applied/duplicate/ignored and 500 on a thrown error so Stripe retries. Log only the event id and type.
- [ ] **Step 5:** Re-run the test, then `npx tsc --noEmit`. Expected: PASS and no errors.
- [ ] **Step 6:** Commit `feat(billing): stripe webhook`.

### Task 5: Checkout and Portal actions

**Files:**
- Create: `src/actions/billing.ts`, `src/actions/billing.test.ts`

**Interfaces:**
- Consumes: `getAppAuthUser`, `getStripe`, `priceIdForInterval`, `trialDaysFor`, `intervalSchema`.
- Produces (`"use server"`): `createCheckoutSessionAction(interval: "month" | "year"): Promise<ActionResult<{ url: string }>>`, `createPortalSessionAction(): Promise<ActionResult<{ url: string }>>`, `getEntitlementAction(): Promise<ActionResult<{ plan: Plan; renewsAt: string | null; cancelAtPeriodEnd: boolean; status: string | null }>>`. `ActionResult` is the type exported from `src/actions/planner.ts`.

- [ ] **Step 1:** Write failing tests with the Stripe client and Prisma mocked: invalid interval → `invalid_input` and no Stripe call; signed-out → `unauthorized`; the checkout session gets `customer`, `client_reference_id = user id`, `subscription_data.trial_period_days = 7` for a first-time user and omitted for a returning one, `payment_method_collection: "always"`, and `success_url`/`cancel_url` built from `NEXT_PUBLIC_APP_URL` (a client-supplied URL is never accepted); the customer is created with idempotency key `cust-<userId>` and `metadata.app = "ramadan-planner"`; a portal request without a customer → `no_customer`.
- [ ] **Step 2:** Run `npx vitest run src/actions/billing.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the three actions per the spec; create the Stripe customer lazily and persist it in `billing_customers`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(billing): checkout and portal actions`.

### Task 6: Server-side gating

**Files:**
- Modify: `src/actions/planner.ts` (`createReminderRuleAction` ~690, `updateReminderRuleAction` ~738), `src/app/api/push/dispatch/route.ts`, `src/app/api/calendar/ics/[secret]/route.ts`, `src/app/api/calendar/google/connect/route.ts`
- Create: `src/lib/plus-limits.ts`, `src/lib/plus-limits.test.ts`

**Interfaces:**
- Consumes: `getEntitlement`, `canEnableAnotherReminder`, `FREE_REMINDER_LIMIT`.
- Produces: `limitRulesForPlan<T extends { createdAt: Date; enabled: boolean }>(rules: T[], plan: Plan): T[]` (Plus returns all; free returns the first `FREE_REMINDER_LIMIT` enabled rules, oldest first).

- [ ] **Step 1:** Write failing tests for `limitRulesForPlan`: free with 5 enabled → the 3 oldest; free ignores disabled rules when counting; plus returns all; empty list.
- [ ] **Step 2:** Run `npx vitest run src/lib/plus-limits.test.ts`. Expected: FAIL; then implement; re-run. Expected: PASS.
- [ ] **Step 3:** In `createReminderRuleAction`, after `requireUserId`, count the user's enabled rules and, when `enabled` is true and `!canEnableAnotherReminder(plan, count)`, return `{ ok: false, error: "plus_required" }`. In `updateReminderRuleAction`, apply the same check only when the update turns a disabled rule on (not on edits to already-enabled rules).
- [ ] **Step 4:** In the push dispatcher, resolve each user's plan once and filter their rules through `limitRulesForPlan` before scheduling. In the ICS route, call `getEntitlement(calendarLink.userId)` and return 403 `{ error: "plus_required" }` with `Cache-Control: no-store` when free. In the Google `connect` route, redirect signed-in free users to `/pricing` instead of starting OAuth.
- [ ] **Step 5:** Run `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 6:** Commit `feat(billing): gate reminder cap, push and calendar sync`.

### Task 7: Pricing page, settings billing section, i18n

**Files:**
- Create: `src/app/pricing/page.tsx`, `src/components/billing/pricing-content.tsx`, `src/components/billing/upgrade-gate.tsx`, `src/components/billing/billing-section.tsx`
- Modify: `src/components/settings/settings-content.tsx`, `src/components/reminders/` (show the `plus_required` error with a link to `/pricing`), `src/messages/bn.json`, `src/messages/en.json`, `src/app/sitemap.xml`

**Interfaces:**
- Consumes: `createCheckoutSessionAction`, `createPortalSessionAction`, `getEntitlementAction`.
- Produces: `<UpgradeGate feature={string}>` (children for Plus, a lock card linking to `/pricing` otherwise), `<BillingSection />`.

- [ ] **Step 1:** Add a `billing` message namespace to both language files: plan names, monthly/yearly toggle labels, trial CTA, "cancel anytime", the free and Plus feature lists from the spec, the past-due banner, and the `plus_required` message. Use the strategy doc's Bengali draft copy and mark it for native review in the PR description.
- [ ] **Step 2:** Build the pricing page (public, indexable, metadata via `generateMetadata`) with the monthly/yearly toggle; the CTA calls `createCheckoutSessionAction` and redirects, and signed-out users are sent to sign-in first. Use the existing `ui/` components.
- [ ] **Step 3:** Add `BillingSection` to Settings: current plan, renewal or trial-end date, "Manage billing" (portal), and a past-due banner linking to the portal.
- [ ] **Step 4:** Run `npm run translations:check`, `npm run lint`, `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(billing): pricing page and billing settings`.

### Task 8: Config, docs, Stripe test setup, end-to-end check

**Files:**
- Modify: `.env.example`, `docs/ARCHITECTURE.md`, `docs/SECURITY_PRIVACY.md`, `README.md` (Features and setup)

- [ ] **Step 1:** Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` to `.env.example` with one-line comments (test keys only until launch). Document billing, the webhook, grandfathering and Stripe as a sub-processor in the two docs.
- [ ] **Step 2:** **Needs founder confirmation first:** create the Stripe test-mode product "Ramadan Planner Plus" and two recurring prices ($3/month, $24/year; `lookup_key` `rp_plus_monthly` / `rp_plus_yearly`; `metadata.app=ramadan-planner`) and configure the Customer Portal (cancel at period end, plan switch limited to the two prices). Report the price IDs; do not paste secrets anywhere.
- [ ] **Step 3:** With test keys in `.env.local`, run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, complete Checkout with card `4242 4242 4242 4242`, and confirm the subscription row shows `trialing` and Settings shows Plus. Repeat with `4000 0000 0000 0341` (card attaches, later charge fails) and cancel through the portal. Expected: entitlement flips match the spec.
- [ ] **Step 4:** Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (with the CI placeholder `DATABASE_URL`). Expected: all pass.
- [ ] **Step 5:** Commit `docs(billing): config and docs`.

---

## Self-review

- **Spec coverage:** data and grandfathering (T1), entitlement rule (T2), allowlist and trial rule (T3), webhook events, idempotency, ordering, refunds (T4), Checkout/Portal and customer mapping (T5), reminder cap, push, ICS and Google gating (T6), pricing/settings/gate UI and i18n (T7), env, docs, Stripe objects and end-to-end test (T8). Deferred and recorded in the spec: daily-log gating, Supabase client split, admin ids, checkout rate limiting.
- **Type consistency:** `Plan`, `resolvePlan`, `getEntitlement`, `canEnableAnotherReminder`, `isAllowedPrice`, `trialDaysFor`, `applyStripeEvent`, `limitRulesForPlan` are defined once and used with the same names.
- **Known risks:** `getAppAuthUser` calls Clerk on every request (adds latency to billing actions); previews need the Vercel Preview environment variables before this branch can deploy; the Bengali copy needs native review.
