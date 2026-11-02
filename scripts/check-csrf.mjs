// Live CSRF / auth-boundary check for the Task 12 go/no-go. It does not start a server.
// Usage: npm run check:csrf -- <baseUrl> <serverFnId> [webhookPath]
//   baseUrl     e.g. http://localhost:3000 or a Vercel preview URL
//   serverFnId  id of a POST server function behind authMiddleware (the id after /_serverFn/ in the
//               browser's network tab; in dev, the createClientRpc("...") argument of the module source)
//   webhookPath optional extra CSRF-exempt POST route to probe (e.g. /api/stripe/webhook once it exists);
//               it must answer anything but 403 to a cross-site, cookieless POST.
// Server routes probed (real ones): POST /api/push/subscribe and PATCH/DELETE /api/announcements/<id>
// (cookie-authenticated, CSRF-checked), POST /api/push/dispatch (secret-authenticated, CSRF-exempt) and
// GET /api/quran (public read, never origin-checked).
// The target server needs Clerk env vars (VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY) set in ITS env;
// for local runs use development keys or clearly fake well-formed ones. Never commit keys. Do not set a real
// CRON_SECRET/PUSH_DISPATCH_SECRET in a shell you run this from: the script never sends one.
const [base, fnId, webhookPath] = process.argv.slice(2);
if (!base || !fnId) {
  console.error("usage: check-csrf.mjs <baseUrl> <serverFnId> [webhookPath]");
  process.exit(2);
}
const fn = `${base}/_serverFn/${fnId}`;
// Seroval-framed `{ data: undefined }`; the function's input does not matter for these checks.
const body = '{"t":{"t":10,"i":0,"p":{"k":[],"v":[]},"o":0},"f":127,"m":[]}';
const rpc = { "x-tsr-serverfn": "true", "content-type": "application/json" };
const cookie = { Cookie: "__session=eyJhbGciOiJSUzI1NiJ9.e30.sig; __client_uat=1700000000" };
const evil = { Origin: "https://evil.example" };
const json = { "content-type": "application/json" };
const sub = JSON.stringify({ endpoint: "https://push.example/x", keys: { p256dh: "p", auth: "a" } });
const ann = `${base}/api/announcements/44444444-4444-4444-8444-444444444444`;
const NOT_403 = [200, 201, 204, 400, 401, 404, 500, 502, 503];

const checks = [
  // Server functions
  ["fn: signed-out same-origin POST -> 401", fn, { method: "POST", headers: { ...rpc, Origin: base }, body }, [401], true],
  ["fn: cross-origin POST + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie, ...evil }, body }, [403]],
  ["fn: Sec-Fetch-Site: same-site + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie, "Sec-Fetch-Site": "same-site" }, body }, [403]],
  ["fn: no Origin/Sec-Fetch-Site/Referer + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie }, body }, [403]],
  ["fn: GET on the POST function -> rejected", fn, { headers: rpc }, [403, 405]],
  // Mutating, cookie-authenticated server routes
  ["route: cross-origin POST /api/push/subscribe + cookie -> 403", `${base}/api/push/subscribe`, { method: "POST", headers: { ...json, ...cookie, ...evil }, body: sub }, [403]],
  ["route: Sec-Fetch-Site: cross-site POST /api/push/subscribe -> 403", `${base}/api/push/subscribe`, { method: "POST", headers: { ...json, ...cookie, "Sec-Fetch-Site": "cross-site" }, body: sub }, [403]],
  ["route: headerless POST /api/push/subscribe + cookie -> 403", `${base}/api/push/subscribe`, { method: "POST", headers: { ...json, ...cookie }, body: sub }, [403]],
  ["route: same-origin POST /api/push/subscribe signed out -> 401", `${base}/api/push/subscribe`, { method: "POST", headers: { ...json, Origin: base }, body: sub }, [401]],
  ["route: cross-origin POST /api/announcements + cookie -> 403", `${base}/api/announcements`, { method: "POST", headers: { ...json, ...cookie, ...evil }, body: "{}" }, [403]],
  ["route: cross-origin PATCH /api/announcements/<id> + cookie -> 403", ann, { method: "PATCH", headers: { ...json, ...cookie, ...evil }, body: "{}" }, [403]],
  ["route: cross-origin DELETE /api/announcements/<id> + cookie -> 403", ann, { method: "DELETE", headers: { ...cookie, ...evil } }, [403]],
  ["route: same-origin DELETE /api/announcements/<id> signed out -> 401", ann, { method: "DELETE", headers: { Origin: base } }, [401]],
  // Exempt and safe routes
  ["exempt: cross-site POST /api/push/dispatch, no secret -> 401 (secret auth, not CSRF)", `${base}/api/push/dispatch`, { method: "POST", headers: { Origin: "https://cron.example" } }, [401]],
  ["safe: cross-site GET /api/quran -> not 403", `${base}/api/quran`, { headers: { ...evil, "Sec-Fetch-Site": "cross-site" } }, NOT_403],
];
if (webhookPath) {
  checks.push([`exempt: cross-site POST ${webhookPath}, no cookie -> not 403`, `${base}${webhookPath}`, { method: "POST", headers: { Origin: "https://stripe.com" }, body: "{}" }, NOT_403]);
}

let failed = 0;
for (const [name, url, init, expected, mustCarryError] of checks) {
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  // A server-function 401 must carry the serialized error, never a result.
  const ok = expected.includes(res.status) && !(mustCarryError && !text.includes('"error"'));
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (got ${res.status}) ${ok ? "" : text.slice(0, 200)}`);
}
process.exit(failed ? 1 : 0);
