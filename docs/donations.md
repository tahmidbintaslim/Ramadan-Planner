# Card donations (Stripe)

Ramadan Planner is free and has no paywall. Card donations are optional sadaqah, mainly for the diaspora. bKash and Nagad stay as the local option (copy a number, Send Money; nothing is processed in the app).

**Status: TEST MODE ONLY.** The founder approved Stripe test mode. Do not add live keys until every step under [Go-live](#go-live-founder-only) is done.

## How it works

1. `/support` shows a "Give by card" card when `VITE_STRIPE_DONATIONS_ENABLED=true` at build time. The donor picks a currency (USD, GBP, EUR or BDT), an amount and "once" or "monthly" (monthly only for USD/GBP/EUR).
2. The page POSTs to `/api/donations/checkout`. The server validates the request with zod, converts the amount to minor units and creates a Stripe Checkout Session:
   - one-time: `mode: "payment"`, `submit_type: "donate"`;
   - monthly: `mode: "subscription"` with `recurring.interval: "month"`;
   - both use inline `price_data` on the product in `STRIPE_DONATION_PRODUCT_ID`, so no Price objects are created;
   - metadata `{ app: "ramadan-planner", frequency }` on the session and on the PaymentIntent or Subscription; a signed-in user's Clerk id is added as `clerk_user_id` in Stripe metadata only;
   - Stripe Checkout has no Bengali locale, so Bengali users get `locale: "auto"` (English users get `"en"`).
3. The donor pays on Stripe's hosted page. No card data reaches the app. Stripe sends them back to `/support?donation=success` or `/support?donation=cancel`, where a gentle, dismissible banner is shown.
4. Stripe calls `POST /api/stripe/webhook`. The signature is verified against the raw body with `STRIPE_WEBHOOK_SECRET`, then one row per event is written to the anonymous `donations` table:
   - `checkout.session.completed` (and `checkout.session.async_payment_succeeded`) for a paid one-time donation;
   - `invoice.paid` for each month of a monthly donation (the subscription's first invoice included, so the subscription checkout itself is not counted twice);
   - `charge.refunded` for the newly refunded part of a payment already in the ledger.

   Events without `metadata.app = "ramadan-planner"` are ignored: the Stripe account also holds other products. `stripe_event_id` is unique, so redeliveries are no-ops.
5. `GET /api/donations/summary` returns totals per month and currency (gross and refunded) and a donor count, cached 5 minutes. The "স্বচ্ছতা" (transparency) card on `/support` shows it. It only ever shows recorded numbers, or an honest empty or error state.

The donation UI follows `PRODUCT.md`: no feature is locked, there are no pop-ups, and nothing asks for money outside `/support` (so never during sehri, iftar or prayer).

### Privacy

The `donations` table holds no donor PII: no name, email, address, card details or Clerk id. It keeps the Stripe event id, the PaymentIntent id, the subscription id for monthly donors, the amount, currency, frequency, status, the billing country when Stripe has one, and the time. RLS is on, and the API roles (`anon`, `authenticated`) have no grants.

The donor count is the number of distinct one-time payments plus distinct monthly subscriptions. With no PII it cannot recognise the same person giving twice, so it counts them twice.

### Monthly donors: cancelling

A monthly donor comes back with the Checkout Session id on the success URL. The page stores it in this browser's `localStorage` (`rp_donation_monthly_session`) and removes it from the address bar. The "Change or stop monthly gift" button posts it to `/api/donations/portal`. The server retrieves the session, checks that it is this app's subscription checkout and opens a Stripe customer portal session for its customer.

Limits: this only works on the device and browser used to donate. Donors on another device can cancel from the link in Stripe's emails (turn on customer emails, below) or by writing to the project. Signed-in donors are not linked to a Stripe customer, on purpose: there is no customer table.

## Environment variables

| Name | Where | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | server | `sk_test_...`, or better a restricted `rk_test_...` key with Checkout Sessions write, Customer portal write and Invoices read |
| `STRIPE_WEBHOOK_SECRET` | server | `whsec_...` of the webhook endpoint (or the one `stripe listen` prints locally) |
| `STRIPE_DONATION_PRODUCT_ID` | server | `prod_...` of the donation product (test mode: "Ramadan Planner Sadaqah") |
| `VITE_STRIPE_DONATIONS_ENABLED` | build time, public | `true` shows the card form; anything else hides it. Changing it needs a redeploy |

All four are listed, without values, in `.env.example`. Never commit keys. Without the secret key or the product id, checkout answers `503`. Without the webhook secret, the webhook answers `503` so Stripe keeps retrying.

## Test-mode setup

1. In the Stripe dashboard, switch to **test mode** on the Devsaround account.
2. Product: "Ramadan Planner Sadaqah" already exists (metadata `kind=donation`). Copy its id into `STRIPE_DONATION_PRODUCT_ID`.
3. API key: create a restricted test key (Developers > API keys > Create restricted key) with
   - Checkout Sessions: write,
   - Customer portal: write,
   - Invoices: read.

   Put it in `STRIPE_SECRET_KEY`.
4. Customer portal: open Settings > Billing > Customer portal in test mode, allow "Cancel subscriptions" (and "Update payment methods" if wanted), and save once. Stripe refuses portal sessions until a configuration is saved.
5. Customer emails (optional): Settings > Customer emails > "Successful payments" sends receipts with a manage link.
6. Database: apply `supabase/migrations/009_donations.sql` to the test database (not done by this branch).
7. Webhook endpoint for a deployed preview: Developers > Webhooks > Add endpoint, URL `https://<preview-host>/api/stripe/webhook`, events
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `invoice.paid`
   - `charge.refunded`

   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
8. Set `VITE_STRIPE_DONATIONS_ENABLED=true` on the preview environment only and redeploy.

Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined), `4000 0025 0000 3155` (3-D Secure). Any future expiry and any CVC.

### Local testing

```bash
# .env.local: STRIPE_SECRET_KEY=sk_test_..., STRIPE_DONATION_PRODUCT_ID=prod_..., VITE_STRIPE_DONATIONS_ENABLED=true
npm run dev

# In another terminal (Stripe CLI, logged in to the test account):
stripe listen --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,charge.refunded
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET and restart the dev server.

# Optional: replay events without paying
stripe trigger checkout.session.completed
```

`stripe trigger` creates objects without `metadata.app`, so the webhook answers `{ ok: true, result: "ignored" }`. To see rows appear, donate through `/support` with a test card.

### Automated tests

- Unit tests (Vitest, no network, Stripe mocked):
  - `src/lib/donations.test.ts`: validation, bounds, minor units;
  - `src/lib/stripe.test.ts`: signature verification, signed locally with Stripe's test helper;
  - `src/server/donations-ledger.test.ts`: event mapping, idempotency, refunds;
  - `src/server/api/stripe-webhook.test.ts`;
  - `src/server/api/donations.test.ts`: checkout, rate limit, summary, portal;
  - `src/components/support/card-donation.test.tsx`: the form, banners and transparency card.
- E2E (`e2e/support.spec.ts`): the card form with the checkout endpoint mocked; it asserts the redirect to the returned URL. It needs a build with `VITE_STRIPE_DONATIONS_ENABLED=true` (CI's Node e2e build sets it) and skips itself otherwise.

## Rate limiting

Checkout and portal allow 10 requests per IP per 10 minutes, counted in memory per server instance. Separate Vercel instances count separately, so this is a speed bump, not a guarantee. For a hard global limit, add a Vercel Firewall rate-limit rule on `/api/donations/*`.

## Currencies

- USD, GBP, EUR: 1 to 10,000, once or monthly.
- BDT: 100 to 500,000, one-time only. Stripe lists BDT as a supported card presentment currency. It is converted to the account's settlement currency, so the donor's bank may add a foreign-transaction fee. The minimum is 100 because Stripe rejects charges below about USD 0.50 after conversion.

## Go-live (founder only)

Do **all** of these before any live key goes into any environment:

1. **Receiving entity.** Decide which legal entity receives donations, and confirm it can hold a live Stripe account in its country. Stripe does not support Bangladesh as an account country. The Devsaround account must be the right entity, or a separate account must be opened for this project (recommended, so other products' keys and events are not mixed in).
2. **Bangladesh foreign-donation compliance.** If the project or anyone receiving funds is in Bangladesh, foreign contributions may fall under the Foreign Donations (Voluntary Activities) Regulation Act 2016, administered by the NGO Affairs Bureau, and Bangladesh Bank foreign-exchange rules. Get advice and any registration or approval needed before accepting money from abroad. Do not describe donations as tax-deductible (`taxDeductible` in `src/config/support.ts`) unless the entity can issue such receipts.
3. **Honest copy.** Re-read the bn/en copy on `/support` against the final entity: who receives the money, what it pays for, and the refund policy.
4. **Live setup.** In live mode, repeat the test setup: product, restricted live key, customer portal, webhook endpoint for `https://<production-host>/api/stripe/webhook` with the four events, and customer emails.
5. **Database.** Apply `supabase/migrations/009_donations.sql` to production.
6. **Production env.** Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_DONATION_PRODUCT_ID` (live values) in Vercel, then `VITE_STRIPE_DONATIONS_ENABLED=true`, and redeploy.
7. **Smoke test.** Make a small live donation, check that the row and the transparency card appear, then refund it and check the refund row.

## Notes

- `supabase/migrations/005_billing.sql` (the dropped Free/Plus subscription tables) was never applied to production and was deleted, so the numbering skips 005. If a non-production database did apply it, drop `billing_customers`, `subscriptions`, `stripe_events` and `entitlement_grants` by hand.
- The Stripe client is pinned to API version `2026-10-28.endive`, matching the installed `stripe` SDK.
