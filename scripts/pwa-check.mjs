/* eslint-disable @typescript-eslint/no-unused-expressions -- terse ok/fail ternaries in a script */
// PWA check against a BUILT server (`npm run build`, then `npm start` with the placeholder env from
// .github/workflows/ci.yml):
//   BASE_URL=http://localhost:3001 PWCHROME=/usr/bin/google-chrome node scripts/pwa-check.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= "1"; // lets context.route cover service worker fetches
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
let failures = 0;
const fail = (m) => { failures += 1; console.log("  FAIL", m); };
const ok = (m) => console.log("  ok  ", m);

const browser = await chromium.launch({ executablePath: process.env.PWCHROME, args: ["--no-sandbox", "--no-proxy-server"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([
  { name: "__clerk_db_jwt", value: "dvb_fake", url: BASE },
  { name: "__client_uat", value: "0", url: BASE },
]);
const page = await ctx.newPage();
await page.route(/clerk\.accounts\.dev|clerk\.com|clerk-telemetry|vercel/, (r) => r.abort());

console.log("manifest");
const mres = await ctx.request.get(`${BASE}/manifest.webmanifest`);
/^application\/manifest\+json/.test(mres.headers()["content-type"] ?? "") ? ok(`content-type ${mres.headers()["content-type"]}`) : fail(`content-type ${mres.headers()["content-type"]}`);
const manifest = await mres.json();
manifest.display === "standalone" && manifest.start_url === "/" ? ok("standalone, start_url /") : fail("display/start_url");
for (const icon of manifest.icons) {
  const r = await ctx.request.get(BASE + icon.src);
  r.status() === 200 && r.headers()["content-type"] === "image/png" ? ok(`${icon.src} (${icon.purpose}) png`) : fail(`${icon.src} ${r.status()} ${r.headers()["content-type"]}`);
}
const sw = await ctx.request.get(`${BASE}/sw.js`);
sw.status() === 200 && /javascript/.test(sw.headers()["content-type"] ?? "") ? ok("sw.js served as javascript") : fail("sw.js");

console.log("head links");
await page.goto(`${BASE}/duas`, { waitUntil: "load" });
(await page.locator('link[rel="manifest"]').getAttribute("href")) === "/manifest.webmanifest" ? ok("manifest link") : fail("manifest link");
(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href")) ? ok("apple-touch-icon link") : fail("apple-touch-icon link");
(await page.locator('meta[name="theme-color"]').getAttribute("content")) === "#F3F8F6" ? ok("theme-color (light)") : fail("theme-color");

console.log("service worker");
// Registered from /duas (a static page outside the landing).
const state = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const w = reg.active;
  if (!w) return "none";
  if (w.state !== "activated") await new Promise((res) => w.addEventListener("statechange", () => w.state === "activated" && res()));
  return w.state;
});
state === "activated" ? ok("registered and active") : fail(`state ${state}`);
await page.reload({ waitUntil: "load" }); // now controlled
await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
(await page.evaluate(() => !!navigator.serviceWorker.controller)) ? ok("page controlled") : fail("page not controlled");

console.log("browse, then check caches");
// App pages only (the old landing prayer-times widget, now removed, unregistered workers on localhost).
for (const p of ["/today", "/quran"]) await page.goto(BASE + p, { waitUntil: "load" });
await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
await page.goto(`${BASE}/duas`, { waitUntil: "load" });
await page.evaluate(() => fetch("/api/quran?surah=1").catch(() => {}));
const cached = await page.evaluate(async () => {
  const out = [];
  for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push({ name, url: new URL(r.url).pathname + new URL(r.url).search });
  return out;
});
console.log("   cached:", cached.map((c) => c.url).join(", "));
cached.some((c) => c.url.startsWith("/api/")) ? fail("an /api/ response is cached") : ok("no /api/ entry in cache");
cached.some((c) => c.url.startsWith("/assets/")) ? ok("hashed assets cached") : fail("no /assets/ entry cached");
cached.filter((c) => !c.url.startsWith("/assets/") && !["/offline.html", "/manifest.webmanifest"].includes(c.url) && !c.url.startsWith("/icons/")).length
  ? fail("unexpected cached entries (page HTML?)") : ok("only static shell + assets cached");
new Set(cached.map((c) => c.name)).size === 1 && /^ramadan-planner-v\d+$/.test(cached[0].name) ? ok(`versioned cache ${cached[0].name}`) : fail("cache naming");

console.log("offline page re-cached lazily");
// The install step tolerates a failed precache; an online navigation must put the offline page back.
await page.evaluate(async () => { for (const n of await caches.keys()) await (await caches.open(n)).delete("/offline.html"); });
await page.goto(`${BASE}/duas`, { waitUntil: "load" });
const recached = await page
  .waitForFunction(async () => !!(await caches.match("/offline.html")), null, { timeout: 10000 })
  .then(() => true, () => false);
recached ? ok("offline.html back in the cache after an online navigation") : fail("offline.html not re-cached");

console.log("offline");
(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration("/")) && !!navigator.serviceWorker.controller))
  ? ok("worker still registered and controlling before going offline")
  : fail("worker not registered/controlling before going offline");
// context.setOffline blocks the navigation before the worker sees it, so cut the network behind the worker
// instead: with PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 context.route also covers worker fetches.
await ctx.route(`${BASE}/**`, (r) => r.abort("internetdisconnected"));
// One retry: the first offline navigation can race the worker (e.g. a just-restarted worker).
let offlineShown = false;
let lastError = "";
for (let attempt = 1; attempt <= 2 && !offlineShown; attempt++) {
  try {
    await page.goto(`${BASE}/today`, { waitUntil: "load" });
    await page.locator("[data-offline]").waitFor({ timeout: 10000 });
    offlineShown = true;
    if (attempt > 1) console.log("   (offline shell shown on the retry)");
  } catch (e) {
    lastError = e.message.split("\n")[0];
  }
}
offlineShown ? ok("offline shell shown for /today") : fail(`offline shell not shown: ${lastError}`);
await ctx.unroute(`${BASE}/**`);

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL OK");
process.exit(failures ? 1 : 0);
