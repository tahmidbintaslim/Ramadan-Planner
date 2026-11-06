// Prints the sha256 CSP source of every inline <script> a running server renders, and marks which ones are
// the same on every page (static: can be pinned in vercel.json's script-src) and which change per page or
// per request (dynamic: need a nonce). Re-run after upgrading TanStack Router/Start, next-themes or Clerk, or
// after editing the inline scripts in src/routes/__root.tsx / src/lib/auto-night.ts, and update vercel.json.
// Usage: node scripts/csp-inline-hashes.mjs http://localhost:3801 [/path ...]
import crypto from "node:crypto";

const [base, ...rest] = process.argv.slice(2);
if (!base) {
  console.error("usage: csp-inline-hashes.mjs <baseUrl> [/path ...]");
  process.exit(2);
}
const paths = rest.length ? rest : ["/", "/today", "/quran", "/welcome", "/no-such-page"];
// Signed-out Clerk dev-browser cookies, as in e2e/fixtures.ts, so a fake-key server renders without a handshake.
const headers = { Cookie: "__clerk_db_jwt=dvb_fake; __client_uat=0" };

const seen = new Map(); // hash -> { pages: Set, preview }
for (const path of paths) {
  const html = await (await fetch(new URL(path, base), { headers })).text();
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m;
    if (/\bsrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs)) continue;
    const hash = `'sha256-${crypto.createHash("sha256").update(body, "utf8").digest("base64")}'`;
    const entry = seen.get(hash) ?? { pages: new Set(), preview: body.slice(0, 60).replace(/\s+/g, " ") };
    entry.pages.add(path);
    seen.set(hash, entry);
  }
}
for (const [hash, { pages, preview }] of seen) {
  const kind = pages.size === paths.length ? "static " : "DYNAMIC";
  console.log(`${kind} ${hash}  ${preview}`);
}
