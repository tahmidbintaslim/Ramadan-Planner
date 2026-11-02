// Live CSRF / auth-boundary check for the Task 12 go/no-go. It does not start a server.
// Usage: npm run check:csrf -- <baseUrl> <serverFnId> [webhookPath]
//   baseUrl     e.g. http://localhost:3000 or a Vercel preview URL
//   serverFnId  id of a POST server function behind authMiddleware (the id after /_serverFn/ in the
//               browser's network tab; in dev, the createClientRpc("...") argument of the module source)
//   webhookPath unauthenticated POST server route, default /api/_webhook-check
// The target server needs Clerk env vars (VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY) set in ITS env;
// for local runs use development keys or clearly fake well-formed ones. Never commit keys.
const [base, fnId, webhookPath = "/api/_webhook-check"] = process.argv.slice(2);
if (!base || !fnId) {
  console.error("usage: check-csrf.mjs <baseUrl> <serverFnId> [webhookPath]");
  process.exit(2);
}
const fn = `${base}/_serverFn/${fnId}`;
// Seroval-framed `{ data: undefined }`; the function's input does not matter for these checks.
const body = '{"t":{"t":10,"i":0,"p":{"k":[],"v":[]},"o":0},"f":127,"m":[]}';
const rpc = { "x-tsr-serverfn": "true", "content-type": "application/json" };
const cookie = { Cookie: "__session=eyJhbGciOiJSUzI1NiJ9.e30.sig; __client_uat=1700000000" };

const checks = [
  ["signed-out same-origin POST -> 401", fn, { method: "POST", headers: { ...rpc, Origin: base }, body }, [401]],
  ["cross-origin POST + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie, Origin: "https://evil.example" }, body }, [403]],
  ["Sec-Fetch-Site: same-site + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie, "Sec-Fetch-Site": "same-site" }, body }, [403]],
  ["no Origin/Sec-Fetch-Site/Referer + cookie -> 403", fn, { method: "POST", headers: { ...rpc, ...cookie }, body }, [403]],
  ["GET on the POST function -> rejected", fn, { headers: rpc }, [403, 405]],
  ["webhook POST, Origin stripe.com, no cookie -> 200", `${base}${webhookPath}`, { method: "POST", headers: { Origin: "https://stripe.com" }, body: "{}" }, [200]],
];

let failed = 0;
for (const [name, url, init, expected] of checks) {
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  // A 401 must carry the serialized error, never a result.
  const ok = expected.includes(res.status) && !(res.status === 401 && !text.includes('"error"'));
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (got ${res.status}) ${ok ? "" : text.slice(0, 200)}`);
}
process.exit(failed ? 1 : 0);
