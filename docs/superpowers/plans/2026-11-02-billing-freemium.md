# Freemium Billing and TanStack Start Migration: Phased Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Free/Plus billing on TanStack Start before Ramadan 1448 (about 17 Feb 2027).

**Architecture:** Billing logic is plain TypeScript with explicit inputs (user id, Stripe client, database), so it does not import Next.js or TanStack and ports unchanged. Part A builds that core now. Part B migrates the app from Next.js to TanStack Start behind a go/no-go checkpoint. Part C adds thin framework adapters (webhook route, server functions, pricing UI) on the migrated app. If Part B fails its checkpoint, Part C is written against Next.js instead.

**Tech Stack:** TanStack Start 1.x (Vite, Nitro on Vercel), React 19, Clerk (`@clerk/tanstack-react-start`, beta), Prisma 7, supabase-js, zod, Vitest, `stripe`, i18n library chosen in the Part B spike.

**Specs:** `docs/superpowers/specs/2026-11-02-billing-freemium-design.md` (billing) and `docs/superpowers/specs/2026-11-02-tanstack-migration-design.md` (framework).

## Global Constraints

- Plus price: $3/month and $24/year, 7-day trial, card required (`payment_method_collection: "always"`, `trial_settings.end_behavior.missing_payment_method = "cancel"`).
- Plus = grant, or status `active`/`trialing`, or `past_due` within a 5-day grace window. `FREE_REMINDER_LIMIT = 3`.
- The server enforces everything; the client sends only `interval: "month" | "year"`. Price IDs come from env (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`); redirect URLs come from `NEXT_PUBLIC_APP_URL` (renamed in Part B if the framework needs a different prefix).
- Stripe test mode only; no live keys in the repo; tag Stripe objects `metadata.app=ramadan-planner`.
- Part A modules live in `src/lib/` and must not import `next/*`, `@clerk/nextjs`, or any TanStack package.
- Message files keep key parity between `bn` and `en`; the translation check must pass.
- Production stays on Next.js until the migration passes its checkpoint and cutover.
- Never gate prayer times, Quran, core tracking, or daily log/goal/task writes (R2).

## Review Focus

- Webhook delivered twice, or `subscription.updated` before `created` → one correct row.
- Event with a price outside the allowlist → rejected, no entitlement.
- `past_due` at the edge of the grace window; grandfathered user with a canceled subscription; expired grant.
- Free user at exactly 3 enabled reminders re-enabling a fourth → blocked; Plus → allowed.
- Migrated app: signed-out user opening a protected server function → rejected, not an empty success.

---

## Part A: framework-free billing core (weeks 1-2, on the current branch)

### Task A1: Dependency, migration, Prisma models

**Files:** Modify `package.json` (add `stripe`), `prisma/schema.prisma`; create `supabase/migrations/005_billing.sql`.

**Interfaces:** Produces Prisma models `BillingCustomer {userId @id, stripeCustomerId @unique}`, `Subscription {id @id, userId, status, priceId, currentPeriodEnd?, trialEnd?, cancelAtPeriodEnd, eventCreated}`, `StripeEvent {id @id, type, processedAt}`, `EntitlementGrant {userId @id, source, expiresAt?}`, all in the `public` schema with snake_case `@map`; relations on `UserProfile`.

- [ ] **Step 1:** `npm i stripe`; commit the lockfile with the code.
- [ ] **Step 2:** Write `005_billing.sql`: four tables with `user_id uuid references public.user_profiles(id) on delete cascade`, RLS enabled with no policies, an index on `subscriptions(user_id)`, and a final `insert into public.entitlement_grants (user_id, source) select id, 'legacy_signup' from public.user_profiles on conflict do nothing` (the one-time grandfather snapshot).
- [ ] **Step 3:** Add the Prisma models; run `npx prisma validate` and `npx prisma generate`. Expected: both succeed.
- [ ] **Step 4:** `npx tsc --noEmit`. Expected: no errors. Commit `feat(billing): billing tables and grandfather snapshot`.

### Task A2: Entitlements

**Files:** Create `src/lib/entitlements.ts`, `src/lib/entitlements.test.ts`.

**Interfaces:** Produces `FREE_REMINDER_LIMIT = 3`, `PAST_DUE_GRACE_DAYS = 5`, `type Plan = "free" | "plus"`, `type PlanSource = "grant" | "subscription" | "none"`, `resolvePlan(input: { grant: { expiresAt: Date | null } | null; subscription: { status: string; currentPeriodEnd: Date | null } | null; now: Date }): { plan: Plan; source: PlanSource }`, `getEntitlement(userId: string, now?: Date): Promise<{ plan: Plan; source: PlanSource }>`, `canEnableAnotherReminder(plan: Plan, enabledCount: number): boolean`.

- [ ] **Step 1:** Write failing tests: no rows → free/none; unexpired and null-expiry grant → plus/grant; expired grant → free; `active`, `trialing` → plus/subscription; `past_due` with period end 4 days ago → plus, 6 days ago → free; `canceled`, `incomplete` → free; grant plus canceled subscription → plus/grant; `canEnableAnotherReminder`: free at 2 → true, free at 3 → false, plus at 50 → true.
- [ ] **Step 2:** `npx vitest run src/lib/entitlements.test.ts` → FAIL. Implement the pure functions; `getEntitlement` loads the grant and newest subscription through `prisma` and delegates to `resolvePlan`.
- [ ] **Step 3:** Re-run → PASS. Commit `feat(billing): entitlement resolution`.

### Task A3: Stripe client and price allowlist

**Files:** Create `src/lib/stripe.ts`, `src/lib/stripe.test.ts`.

**Interfaces:** Produces `getStripe(): Stripe` (lazy singleton, pinned `apiVersion`; throws only when called without `STRIPE_SECRET_KEY`), `priceIdForInterval(interval: "month" | "year"): string`, `isAllowedPrice(priceId: string): boolean`, `trialDaysFor(hasHadSubscription: boolean): number` (7, or 0 if ever subscribed), `intervalSchema` (zod enum of `"month" | "year"`).

- [ ] **Step 1:** Failing tests with `vi.stubEnv` for both price vars: correct mapping; `isAllowedPrice("price_other")` and `isAllowedPrice("")` false; missing env makes `priceIdForInterval` throw; `trialDaysFor(false) === 7`, `trialDaysFor(true) === 0`; `intervalSchema.safeParse("week").success === false`.
- [ ] **Step 2:** Run → FAIL; implement (importing the module must not need the secret key); run → PASS. Commit `feat(billing): stripe client and price allowlist`.

### Task A4: Webhook event processing

**Files:** Create `src/lib/stripe-events.ts`, `src/lib/stripe-events.test.ts`.

**Interfaces:** Consumes `isAllowedPrice`. Produces `applyStripeEvent(event: Stripe.Event, deps: { retrieveSubscription(id: string): Promise<Stripe.Subscription>; db: BillingDb }): Promise<"applied" | "duplicate" | "ignored">` with `BillingDb { recordEvent(id: string, type: string): Promise<boolean>; userIdForCustomer(customerId: string): Promise<string | null>; linkCustomer(userId: string, customerId: string): Promise<void>; upsertSubscription(row: SubscriptionRow): Promise<void>; getEventCreated(subscriptionId: string): Promise<number | null> }` and `prismaBillingDb: BillingDb`.

- [ ] **Step 1:** Failing tests with an in-memory `BillingDb`: same event id twice → `"duplicate"`, one write; `customer.subscription.updated` older than stored `eventCreated` → `"ignored"`; price outside the allowlist → `"ignored"`, no row; `checkout.session.completed` links `client_reference_id` to the customer then upserts the re-fetched subscription; `customer.subscription.deleted` stores `canceled`; fully refunded `charge.refunded` marks the subscription `canceled`, partial refund changes nothing; unknown type → `"ignored"`.
- [ ] **Step 2:** Run → FAIL. Implement: record the event id first, always re-fetch the subscription from Stripe, map the user through `billing_customers`. Handled types: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `customer.deleted`.
- [ ] **Step 3:** Run → PASS; `npx tsc --noEmit`. Commit `feat(billing): stripe event processing`.

### Task A5: Checkout, portal and plan-limit services

**Files:** Create `src/lib/billing-service.ts`, `src/lib/billing-service.test.ts`, `src/lib/plus-limits.ts`, `src/lib/plus-limits.test.ts`.

**Interfaces:** Consumes `getStripe`, `priceIdForInterval`, `trialDaysFor`, `getEntitlement`. Produces `startCheckout(userId: string, interval: "month" | "year", deps: { stripe: Stripe; db: CustomerDb; appUrl: string }): Promise<{ url: string }>`, `openPortal(userId: string, deps): Promise<{ url: string } | { error: "no_customer" }>`, `limitRulesForPlan<T extends { createdAt: Date; enabled: boolean }>(rules: T[], plan: Plan): T[]` (Plus: all; free: the 3 oldest enabled).

- [ ] **Step 1:** Failing tests with a fake Stripe: checkout passes `customer`, `client_reference_id = userId`, `payment_method_collection: "always"`, trial days 7 for first-time and omitted for returning users, and `success_url`/`cancel_url` built only from `appUrl`; the customer is created with idempotency key `cust-<userId>` and `metadata.app = "ramadan-planner"`; portal without a customer → `{ error: "no_customer" }`; `limitRulesForPlan` cases: free with 5 enabled → 3 oldest; disabled rules not counted; plus → all; empty.
- [ ] **Step 2:** Run → FAIL; implement; run → PASS. Commit `feat(billing): checkout, portal and plan limit services`.

---

## Part B: migrate to TanStack Start (weeks 1-6, own branch, spec first)

Per the migration spec, Part B starts with a one-week spike whose findings decide the i18n library and confirm Clerk. The detailed migration task list is written after the spike, because those two choices change many tasks. Fixed outline:

### Task B1: Spike on a throwaway branch (week 1)

- [ ] **Step 1:** Scaffold TanStack Start with the Nitro Vercel preset next to the existing app; render one real page (prayer times) and one protected server function, behind Clerk, with the chosen i18n approach reading the existing `bn`/`en` message files.
- [ ] **Step 2:** Deploy that spike as a Vercel preview. Verify: Clerk sign-in and sign-out, a server function that rejects signed-out calls, a server route that reads `request.text()`, Bengali text and font rendering, PWA service worker registration.
- [ ] **Step 3:** Write `docs/superpowers/specs/2026-11-02-tanstack-migration-design.md` with the results: i18n choice (`use-intl` if it works with SSR, otherwise Paraglide), the Clerk SDK version and any workarounds, the route map, and go/no-go criteria.
- [ ] **Step 4:** Founder reviews. **Go** → write the migration task list (routes, server functions replacing `src/actions/*`, middleware, components, service worker, tests, SEO) and continue. **No-go** → stay on Next.js and write Part C against it.

### Task B2: Migration execution (weeks 2-5)

Written after B1. Checkpoint at the end of week 4: every route ported, all existing tests passing, preview deployed with real data. If it is not met, fall back to Next.js and keep the Part A work.

### Task B3: Cutover (week 6)

Point the production domain at the TanStack deployment, keep the Next.js deployment as a rollback for two weeks, re-verify Vercel production variables.

---

## Part C: billing adapters on the migrated app (weeks 5-8, after B)

Each adapter is thin: authenticate, validate, call a Part A function. Names below are interfaces; file paths follow the migrated route layout.

### Task C1: Webhook server route

- [ ] **Step 1:** Failing test for the handler function `handleStripeWebhook(rawBody: string, signature: string | null, deps): Promise<Response>`: missing signature → 400; bad signature → 400; valid → 200 for applied, duplicate and ignored; a thrown error from `applyStripeEvent` → 500.
- [ ] **Step 2:** Implement `handleStripeWebhook` in `src/lib/stripe-webhook.ts` (verify with `getStripe().webhooks.constructEvent`); register it as a POST handler in `src/routes/api/stripe/webhook.ts` that passes `await request.text()` and the `stripe-signature` header. Log only event id and type.

### Task C2: Billing server functions

- [ ] **Step 1:** Create `createCheckoutSession`, `createPortalSession` and `getBillingStatus` server functions behind the auth middleware; validate with `intervalSchema`; call `startCheckout`/`openPortal`/`getEntitlement` with the authenticated user id.
- [ ] **Step 2:** Test that each rejects an unauthenticated call and that a bad interval returns `invalid_input`.

### Task C3: Gating

- [ ] **Step 1:** In the migrated reminder server functions, return `plus_required` when `canEnableAnotherReminder` is false on create, and on update only when a disabled rule is turned on.
- [ ] **Step 2:** In the push dispatcher, filter each user's rules through `limitRulesForPlan`. In the ICS route return 403 `plus_required` with `Cache-Control: no-store` for free users. In the Google connect route send free users to `/pricing`.
- [ ] **Step 3:** Run the full test suite, `tsc`, lint.

### Task C4: Pricing page, billing settings, i18n

- [ ] **Step 1:** Add the `billing` message namespace to both languages (Bengali copy from the strategy doc, flagged for native review).
- [ ] **Step 2:** Build the public `/pricing` route (server-rendered, per-page metadata), the billing section in Settings (plan, renewal or trial end, manage button, past-due banner), and an `UpgradeGate` component. Check translation parity, lint, types.

### Task C5: Config, docs, Stripe test setup, end-to-end check

- [ ] **Step 1:** Add the four Stripe env vars to `.env.example`; document billing, the webhook and grandfathering in `docs/ARCHITECTURE.md` and `docs/SECURITY_PRIVACY.md`.
- [ ] **Step 2:** **Founder confirmation first, and the Stripe connector must be re-authorized:** create the test-mode product "Ramadan Planner Plus", two prices ($3/month, $24/year, lookup keys `rp_plus_monthly`/`rp_plus_yearly`) and the portal configuration.
- [ ] **Step 3:** With test keys and `stripe listen`, complete Checkout with `4242 4242 4242 4242`, then `4000 0000 0000 0341`, then cancel in the portal; confirm entitlement flips match the spec. Run the whole suite and a production build.

---

## Self-review

- **Spec coverage:** data and grandfathering (A1), entitlement rule (A2), allowlist and trial rule (A3), webhook events (A4, C1), Checkout/Portal and customer mapping (A5, C2), gating (A5, C3), UI and i18n (C4), config and end-to-end (C5), framework switch (B1-B3). Still deferred: daily-log gating, Supabase client split, admin ids, checkout rate limiting.
- **Type consistency:** `Plan`, `resolvePlan`, `getEntitlement`, `canEnableAnotherReminder`, `isAllowedPrice`, `trialDaysFor`, `applyStripeEvent`, `startCheckout`, `openPortal`, `limitRulesForPlan` are defined once and reused.
- **Unverified and to confirm in B1:** exact Clerk TanStack API names (its SDK is in beta), the server-function input-validator method name, `use-intl` under TanStack SSR.
