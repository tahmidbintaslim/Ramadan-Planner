# Security hardening

This page covers the platform-level protections: HTTP headers, the CSP, rate limiting, the canonical-host redirect, and decisions that need someone with access to the Vercel and Supabase dashboards. Data isolation and secrets are in [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md).

## Deploy order

1. Apply `supabase/migrations/008_ics_secret_hash.sql` **before** deploying the code that reads `calendar_links.ics_secret_hash`. Prisma selects that column, so ICS feeds, ICS link creation and Google sync fail until it exists. The migration is idempotent. It hashes the existing secrets and clears the plaintext, and existing feed URLs keep working.
2. Deploy.
3. On the preview deployment, check the headers (see [Checking the headers](#checking-the-headers)).

## Response headers

`vercel.json` sets these on every response (`"source": "/(.*)"`):

| Header | Value | Why |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing of API JSON or uploads into script/HTML. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Paths (for example the ICS secret URL) never leak to other sites in `Referer`. |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=()` | Location is used for prayer times; camera and microphone never. |
| `X-Frame-Options` | `DENY` | No framing (clickjacking). `frame-ancestors 'none'` in the CSP does the same for modern browsers. |
| `Content-Security-Policy-Report-Only` | see below | Reported, not enforced, until it is proven against real traffic. |

The Node server build (`npm run build` without `NITRO_PRESET`, used locally and by e2e) sends the same headers: `vite.config.ts` copies the `"/(.*)"` rule from `vercel.json` into Nitro route rules (`src/config/security-headers.ts`). `vercel.json` is the single source of truth. Vercel builds leave the headers to `vercel.json`, so they are not sent twice.

### Content Security Policy (Report-Only)

```
default-src 'self';
script-src 'self'
  'sha256-xscK79fMu9z153gt8TpeaTbKTyJnOKxS2xLDWgDmc90='   theme-color pre-hydration script (src/routes/__root.tsx)
  'sha256-w7NdUm/7kBaUmzyuBCjDUPefwwqNgPQDkm7HtLmQzmg='   next-themes pre-hydration script (theme-provider.tsx props)
  'sha256-WBdaHO0Km8lSuTtyGyZ0irW414W/MYySk4PnhsmVk7s='   AUTO_NIGHT_SCRIPT (src/lib/auto-night.ts)
  'sha256-zFML+AEdb/HsbX66VlYzBOqJKNNHs5/WNGYP8JiblyY='   TanStack Router scroll restoration
  'sha256-X2wrMMbXwF8YlnD9Zhh8bF9hOUNwmZzsH/31YtmkwZM='   TanStack Start stream bootstrap ($_TSR)
  'sha256-Jdi69ME7KHmQVBh2HLO6sVZfO4LiHOzmuLUGaT2UEUs='   TanStack Start stream end
  'sha256-REkTQ3mZNdOnZ0xWxlKdqBEAWdIVpJdIT6tm57gvq8Y='   TanStack Start stream boundary cleanup
  https://*.clerk.accounts.dev https://clerk.ramadanplanner.tahmid.space   Clerk frontend API (clerk-js)
  https://challenges.cloudflare.com                                       Clerk bot protection (Turnstile)
  https://va.vercel-scripts.com                                           Vercel Analytics (debug script)
  https://js.stripe.com;                                                  Stripe.js (donations)
style-src 'self' 'unsafe-inline';                 Clerk and Radix inject inline styles at runtime
img-src 'self' data: blob: https://img.clerk.com;
font-src 'self' data:;                            fonts are self-hosted (@fontsource)
connect-src 'self' https://*.clerk.accounts.dev https://clerk.ramadanplanner.tahmid.space
  https://clerk-telemetry.com https://api.stripe.com;
media-src 'self' https://*.mp3quran.net https://everyayah.com https://the-quran-project.github.io
  https://github.com https://raw.githubusercontent.com;      Quran audio URLs returned by /api/quran
worker-src 'self' blob:;                          /sw.js; Clerk uses blob workers
frame-src https://challenges.cloudflare.com https://js.stripe.com https://checkout.stripe.com;
form-action 'self' https://checkout.stripe.com;
manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

How the hosts were found:

- **Clerk**: a publishable key is `pk_(test|live)_` plus base64 of `<frontend-api-host>$`. Development instances use `<slug>.clerk.accounts.dev` (hence the wildcard). The production instance will use `clerk.ramadanplanner.tahmid.space`. Once production runs on the production instance, drop `*.clerk.accounts.dev`.
- **Quran audio**: `/api/quran?surah=N` returns `audio[].originalUrl` on `serverN.mp3quran.net` (the reader plays `originalUrl` first) and `audio[].url` on `github.com`, which redirects to `raw.githubusercontent.com`. Ayah audio in the source data uses `everyayah.com` and `the-quran-project.github.io`.
- **Vercel Analytics**: production loads `/_vercel/insights/script.js` and posts to `/_vercel/insights/*` (same origin). `va.vercel-scripts.com` is the debug/dev script.
- **Stripe**: Checkout is a top-level redirect to `checkout.stripe.com`. Stripe.js and its frames are on `js.stripe.com`, and its API is `api.stripe.com`.

#### Inline scripts: hashes now, nonces before enforcing

Run `node scripts/csp-inline-hashes.mjs <baseUrl>` against a running build to list every inline script with its hash, marked static or DYNAMIC.

- **Static (pinned above)**: the theme-color script in `__root.tsx`, the next-themes script (fixed by the `ThemeProvider` props), `AUTO_NIGHT_SCRIPT`, and TanStack's scroll-restoration and stream scripts. These hashes change when the script text changes, or when TanStack Router/Start or next-themes is upgraded. Re-run the script then and update `vercel.json` (`src/config/security-headers.test.ts` checks the policy shape, not the hash values).
- **Dynamic (not hashable)**:
  - `$_TSR.router=…`: TanStack Start's per-request dehydrated router state. It differs on every page.
  - `window.__clerk_init_state = …`: Clerk's SSR state. It is constant while signed out but carries the session when signed in.

  Report-Only will report these two on every page. Before switching to an enforced `Content-Security-Policy`, move to a per-request nonce:
  1. Generate a nonce per request in a request middleware (`src/start.ts`).
  2. Pass it to the router (`createRouter({ ssr: { nonce } })` in `src/router.tsx`) so Start puts it on its scripts.
  3. Put it on the hand-written inline scripts.
  4. Send the CSP header from the server, with `'nonce-…' 'strict-dynamic'`, instead of from `vercel.json`. A static file cannot carry a per-request nonce.

  `@clerk/tanstack-react-start` 1.7.9 has no nonce option for its init-state script. Check for one when upgrading; otherwise that script needs a hash of its signed-out form plus `'strict-dynamic'`, or a wrapper.
- Measured on the Node build (Chrome, signed out, `/`, `/today`, `/quran/1`, `/timetable`, `/settings`): the only reports are those two dynamic scripts. There is also one `'unsafe-eval'` report on pages that load the planner chunk. It comes from Zod 4's feature probe (`try { Function("") } catch {}`), which falls back to its non-JIT path when blocked. To silence it, call `z.config({ jitless: true })` once at startup; do not add `'unsafe-eval'`.
- No reporting endpoint is configured yet: violations show in the browser console. To collect them, add `report-to`/`report-uri` pointing at a collector, for example Sentry's CSP endpoint.

#### Checking the headers

It has not been verified that Vercel applies `vercel.json` `headers` and `redirects` to the TanStack Start (Nitro, Build Output API) deployment. Check on the first preview:

```sh
curl -sI https://<preview>.vercel.app/ | grep -iE 'x-frame|nosniff|referrer|permissions|content-security'
curl -sI https://ramadan-planner-puce.vercel.app/today   # after promotion: 308 to the canonical host
```

If they are missing, move the rules into Nitro `routeRules` for the Vercel preset too (Nitro writes them into `.vercel/output/config.json`), and remove them from `vercel.json` so they are not sent twice.

## Rate limiting

**The real layer is the Vercel Firewall.** The app also has a small best-effort limiter (`src/server/rate-limit.ts`, wired in `src/server/api/rate-limited.ts`). It is an in-memory token bucket of 60 requests per minute per client IP, with separate buckets for `/api/timings`, `/api/ramadan`, `/api/ramadan-timetable` and `/api/push/subscribe`. Over the limit it answers 429 with `Retry-After`.

- It is per instance. Vercel runs many instances and recycles them, so a determined client gets roughly 60 × instances per minute. It only blunts one noisy client on one warm instance.
- The IP comes from Vercel's `x-real-ip` (then `x-vercel-forwarded-for` / `x-forwarded-for`), which the edge overwrites. Direct connections to the Node server have none of these headers and are not limited, so local runs and e2e are unaffected.

### Recommended Vercel Firewall rules

Configure these in Project → Firewall → Configure → New Rule (or with `vercel firewall` / the REST API). Start each in **Log** mode for a day, then switch it to **Rate Limit / Deny**.

```jsonc
[
  {
    "name": "Public proxies: 60/min per IP",
    "description": "AlAdhan/IslamicAPI-backed endpoints; a cache miss calls upstream.",
    "conditionGroup": [
      { "conditions": [{ "type": "path", "op": "re", "value": "^/api/(timings|ramadan|ramadan-timetable)$" }] }
    ],
    "action": {
      "mitigate": {
        "action": "rate_limit",
        "rateLimit": { "algo": "fixed_window", "window": 60, "limit": 60, "keys": ["ip"], "action": "deny" },
        "actionDuration": "5m"
      }
    }
  },
  {
    "name": "Push subscribe: 10/min per IP",
    "conditionGroup": [
      { "conditions": [
        { "type": "path", "op": "eq", "value": "/api/push/subscribe" },
        { "type": "method", "op": "eq", "value": "POST" }
      ] }
    ],
    "action": {
      "mitigate": {
        "action": "rate_limit",
        "rateLimit": { "algo": "fixed_window", "window": 60, "limit": 10, "keys": ["ip"], "action": "deny" },
        "actionDuration": "10m"
      }
    }
  },
  {
    "name": "ICS feeds: 30/min per IP",
    "description": "Bearer-secret URLs; slows down guessing. Calendar clients poll every few hours.",
    "conditionGroup": [
      { "conditions": [{ "type": "path", "op": "pre", "value": "/api/calendar/ics/" }] }
    ],
    "action": {
      "mitigate": {
        "action": "rate_limit",
        "rateLimit": { "algo": "fixed_window", "window": 60, "limit": 30, "keys": ["ip"], "action": "deny" },
        "actionDuration": "10m"
      }
    }
  },
  {
    "name": "Server functions: 120/min per IP",
    "conditionGroup": [
      { "conditions": [{ "type": "path", "op": "pre", "value": "/_serverFn/" }] }
    ],
    "action": {
      "mitigate": {
        "action": "rate_limit",
        "rateLimit": { "algo": "fixed_window", "window": 60, "limit": 120, "keys": ["ip"], "action": "deny" },
        "actionDuration": "5m"
      }
    }
  }
]
```

Also turn on the managed **Bot Protection** and **AI bots** rulesets (Log first). Never put a rate-limit or challenge rule in front of `/api/push/dispatch`: Vercel Cron cannot pass a challenge, and the route is already protected by the shared secret.

## Canonical host

`vercel.json` sends a 308 from `ramadan-planner-puce.vercel.app` to `https://ramadanplanner.tahmid.space`, keeping the path (`has: [{ type: "host" }]`, so it only fires on that host).

- Preview deployments (`ramadan-planner-<hash>-<team>.vercel.app`, `ramadan-planner-git-<branch>-<team>.vercel.app`) do not match and are not redirected.
- `/api/push/dispatch` is excluded so the cron entry point is never redirected.
- If the project has another production alias on `*.vercel.app` (Project → Domains), add a second rule with that exact host. Do not use a `.*\.vercel\.app` pattern: it would catch preview hosts too.

## Push subscriptions (SSRF)

The dispatcher POSTs to every stored endpoint, so an endpoint is an outbound request target. `src/lib/push-endpoint.ts` sets the rules:

- Only https on the default port, with no credentials.
- Only these hosts: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`, `*.push.apple.com`.
- `p256dh` is at most 200 chars and `auth` at most 100.
- Each user keeps at most 10 subscriptions; the oldest are pruned.

The dispatcher re-checks every stored row before sending and deletes rows that fail.

## ICS feeds

- `Cache-Control: private, no-store`, so a revoked link stops working at once.
- Only the SHA-256 of the secret is stored, with a unique index. The legacy plaintext column is matched for old rows and rewritten to the hash on first use.

## Other hardening in this change

- The `ADMIN_EMAILS` check accepts only an email whose Clerk `verification.status` is `"verified"`.
- OAuth redirect URIs come from `APP_URL`/`SITE_URL`. In production they never come from the request Host; the fallback is `https://ramadanplanner.tahmid.space`. Set `APP_URL` in the Vercel project anyway.
- The `NEXT_LOCALE` cookie is `Secure` in production.
- The CSRF exemption for `/api/stripe/webhook` is removed until the signature-verified webhook route exists. The donations change re-adds both together.

## Open item: a second app shares the Supabase project

The audit found another application's schema (`shikhbo`, including a table holding an `app_secret`) in the **same Supabase project** as this app. Nothing was changed. Both apps share one Postgres instance, one set of database roles, one service-role key, one Data API and one backup/PITR timeline. A leaked credential, a bad migration, a grant mistake or an outage in either app therefore reaches both, and the other app's secrets sit one `GRANT` away from this app's roles.

**Recommendation:** move one of the apps to its own Supabase project (`pg_dump --schema=<schema>` and restore into the new project). Then rotate the database password, the service-role key and that app's `app_secret`. Until then, keep RLS enabled on every table in both schemas, do not grant the Data API roles `USAGE` on either schema, and treat the database credentials as shared with the other app.
