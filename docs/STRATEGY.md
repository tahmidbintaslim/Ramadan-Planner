# Ramadan Planner: freemium strategy (draft, 2026-11-02)

Status: research synthesis, awaiting founder decisions. Not a spec. Sources: four read-only research passes (market, marketing, pricing/Stripe, product audit). Figures marked *(est.)* are unsourced or unverified and must be checked before use.

## 1. Decisions

Resolved by the founder: **#1 entity** is in a Stripe-supported country (still confirm the exact country when going live); **#4** existing accounts are grandfathered; **#5** the trial requires a card. Still open: #2 (separate Stripe account, recommended), #3 (confirmed as the recommendation unless changed), #6 (regional pricing, later track).

| # | Question | Why it blocks | Recommendation |
|---|---|---|---|
| 1 | Where is the legal entity? Can it hold a Stripe account? | Stripe Tax and Managed Payments do not list Bangladesh as a business location; Bangladesh as a Stripe account country is **unconfirmed**. Live mode may be impossible. | Verify on Stripe's supported-countries page. If unsupported: Stripe Atlas (US) or Paddle / Lemon Squeezy as merchant of record (about 5% + fees). |
| 2 | Separate Stripe account for this product? | The test account holds unrelated ScopeLock products; key mix-ups are likely. | Yes. At minimum tag objects `metadata.app=ramadan-planner` and use restricted keys. |
| 3 | What is "cloud sync" for free signed-in users? | Defines the gate in `src/actions/planner.ts`. | Free = local only. Plus = daily logs, goals, tasks, reminders in the cloud. Downgrade keeps data readable, blocks new writes. |
| 4 | Grandfathering | Existing signed-in users already get DB storage. | Snapshot grant (`entitlement_grants`, `source='legacy_signup'`) for accounts created before launch. Not a rule. |
| 5 | Trial: card required? | Conflicting advice. | Card up front (Stripe default, far less trial abuse). A no-card trial is possible but needs extra abuse controls. |
| 6 | Regional pricing and Bangladesh payments | $24/yr is roughly 2,900 BDT *(est.)*; Stripe cards are unreliable in BD. | Stripe (USD/GBP/EUR) for diaspora now; a local route (bKash/SSLCommerz or Play Billing) is a separate later track. |

## 2. Market and competitors

- Bangladesh: roughly 150M Muslims, inferred from a Pew table. West Bengal and diaspora figures are unverified. No seasonality data was found; pull Sensor Tower or Similarweb numbers.
- Paid benchmarks: Muslim Pro $34.99/yr, Tarteel $99/yr (US App Store, one 2026 guide). Free/ad-free anchors: Pillars, Quran.com. Ratings were not retrievable.
- Bangla apps found (Quran Bangla, Romjan Calendar, Muslim Bangla) are basic or ad-supported.
- Whitespace: Bengali-first planner, tracker plus 30-day plan, guest mode without signup, no ads, calendar sync and push, Laylatul Qadr mode.
- Proposed pricing: $3/mo or $24/yr (diaspora, USD/GBP/EUR). Bangladesh/West Bengal regional price about $8-10/yr *(est.)*, on a route that works there.

## 3. Plans

| | Free (always) | Plus |
|---|---|---|
| Core | Local tracker, prayer/sehri/iftar times, timetable, Quran, tasbih, zakat, 3 reminders | Cloud sync across devices, unlimited reminders and push, Google/ICS calendar sync |
| Depth | 7-day streak and week summary | Full history and stats, Quran khatam pacing |
| Content | Sleep dhikr checklist | Laylatul Qadr mode, duas, quiz, books |

Rule: never gate prayer times, Quran reading, core tracking, or a user's existing data.

## 4. Product backlog (about 15 weeks to Ramadan 1448, around 17 Feb 2027)

**R1, weeks 1-5: billing and gating**
1. `src/lib/entitlements.ts` (`getEntitlement`, `requirePlus`), enforced server-side in every Plus action and route.
2. Billing tables (`billing_customers`, `subscriptions`, `stripe_events`, `entitlement_grants`) in `supabase/migrations/005_billing.sql` plus Prisma models.
3. Stripe: Checkout (subscription mode, 7-day trial), Customer Portal, webhook (raw body, signature check, idempotent event table, re-fetch the subscription).
4. Enforce the 3-reminder cap (`createReminderRuleAction`, push dispatch); gate ICS/Google calendar routes.
5. Split the Supabase service-role client (webhooks/cron only) from a user-scoped client.
6. PWA manifest, icons, offline shell (today `sw.js` is push-only).
7. Tests for auth mapping, entitlements, webhook handler.

**R2, weeks 6-11:** cloud sync with local merge, streaks, history/stats, Laylatul Qadr mode, sleep dhikr, khatam planner, duas.

**R3, weeks 12-15:** printable timetable, Hijri calendar, charity tracker, Eid/Shawwal follow-on, quiz, books (licensing), family goals (stretch, first to drop). Weeks 14-15 reserved for hardening.

## 5. Stripe design

- Hosted Checkout, subscription mode; two prices on one product, `lookup_keys` `rp_plus_monthly` and `rp_plus_yearly`.
- `client_reference_id` plus `metadata.user_id` / `clerk_id` on customer and subscription; the Clerk-derived UUID is a one-way hash, so store both.
- Entitlement: Plus if status is `active` or `trialing`, or `past_due` inside a grace window (3-7 days), or a valid grant.
- Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid|payment_failed`, `charge.refunded`, `customer.deleted`.
- Security: never accept price IDs from the client; allowlist prices from env; rate-limit checkout; one trial per card fingerprint; no full-event logging.
- Tax: Stripe Tax (EU/UK VAT, US states); Bangladesh VAT needs an adviser.
- Dunning: Smart Retries plus failed-payment emails, an in-app "update payment method" banner.

## 6. Go-to-market

- Positioning: the Bengali-first Ramadan companion; ad-free and private. Taglines are drafts for a native editor.
- Personas: Bangladeshi students/professionals (free first); diaspora families in the UK, US and Gulf (best payers, target annual); mosque admins (free share kit, defer B2B).
- Channels by cost-effectiveness: SEO (Bengali and English; per-district timetable pages), Facebook groups, WhatsApp/Messenger sharing, short video, mosque partnerships, scholar review, Product Hunt last.
- Timeline: weeks 1-2 production Clerk, analytics, waitlist; 3-5 SEO pages and scholar reviewer; 6-8 closed beta of 50-100 users; 9-10 soft launch with 7-day trial; 11-14 pre-Ramadan push and early-bird annual; Ramadan push mid-month before the last ten nights; after Eid retention content (Shawwal six fasts, Dhul Hijjah, Muharram).
- Seasonality risk: heavy churn after Eid. Push annual plans; consider a fixed-term Ramadan pass.
- Lifecycle email/push: waitlist countdown, trial day 0/2/5/6, receipt, exit survey, win-backs.
- Targets *(est., unsourced)*: 1,500-3,000 waitlist, 150-400 paid, $1.5-4k first season. Replace with beta data.
- Risks: religious content accuracy (scholar review, cite sources, error-report link); no charity-linked claims without a registered partner; no fake urgency.

## 8. Tech stack decision (founder, 2026-11-02): TanStack Start

- **Why:** a lighter, more explicit stack than Next.js, while keeping React so components, shadcn/Radix and Tailwind carry over. SvelteKit was considered and rejected for now: it needs a full UI rewrite and has only community Clerk packages, which is too much risk for a Ramadan deadline.
- **Evidence checked:** TanStack Start declared 1.0 stable on 13 Oct 2026; Vercel deploys it through Nitro; server functions with auth middleware and server routes (`request.text()`) cover billing's needs. The week-1 local spike (2026-11-02, see `docs/superpowers/specs/2026-11-02-tanstack-migration-design.md`) corrected two earlier notes: `@clerk/tanstack-react-start` 1.7.9 is npm `latest` with no beta tag (the "beta" label was only on an older docs page; it needs Clerk Core 3), and the TanStack advisory CVE-2026-102989 (critical reflected XSS in server-function responses, dated 30 Sep 2026) is fixed in react-start 1.168.60 / start-server-core 1.169.39. Sign-in itself is still untested.
- **Not verified:** the claim that top brands are moving to Svelte or TanStack, i18n under TanStack SSR (`use-intl` vs Paraglide), and the Clerk beta's stability.
- **Safeguards:** billing core is framework-free; production stays on Next.js until cutover; a go/no-go checkpoint at the end of week 4 falls back to Next.js if the port slips.
- **Timeline shift:** a 4-6 week migration phase pushes the closed beta from December to mid-January; public launch stays in early February; SEO pages are built in the new framework (server-rendered). Marketing channels, positioning and pricing are unchanged.
- **TanStack showcase (founder idea):** after cutover and a stable production release, submit the site at https://tanstack.com/showcase/submit and announce it on the TanStack and developer channels. The submission page lists no criteria ("projects selected by the TanStack team"), so selection is not guaranteed; email support@tanstack.com if the form is unclear. This is a developer-audience, low-cost, English-side bump, not a driver of Bengali-speaking users. Do not submit before the site actually runs on TanStack Start.
- **New marketing asset:** a smaller JavaScript payload on low-end Android phones and slow mobile networks in Bangladesh. Measure it with Lighthouse and WebPageTest in the spike, and only advertise it if the numbers hold.

## 7. Launch blockers found in the repo

- Auth runs on a Clerk **development** instance; production Clerk is required.
- Push reminders need a scheduler that actually runs every 5 minutes.
- Service-role key bypasses RLS everywhere; one missed `userId` filter leaks data or breaks gating.
- Only pure libs have tests; none for actions, auth mapping or routes.
- Admin check falls back to an email list; use `AdminUser` ids.
