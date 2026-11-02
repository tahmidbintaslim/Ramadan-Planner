/* eslint-disable @typescript-eslint/no-unused-expressions -- terse ok/fail ternaries in a script */
// Smoke test against a BUILT server (npm run build && node .output/server/index.mjs).
//   BASE_URL=http://localhost:3001 PWCHROME=/path/to/chrome SHOTS=/tmp/shots node scripts/smoke.mjs
// Needs the `playwright` package; never installs browsers. Fake/dev Clerk keys go in the server's env only.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  "/", "/dashboard", "/today", "/plan", "/quran", "/reminders", "/duas", "/books", "/quiz",
  "/tasbih", "/zakat", "/settings", "/admin/announcements",
];
// Console noise that does not come from the app: network failures to external APIs (sandbox is offline) and
// Clerk's dev-keys banner/telemetry.
const IGNORE = [/Failed to load resource/i, /net::ERR_/i, /ERR_FAILED/i, /clerk/i, /development keys/i];
const HYDRATION = /hydrat|did not match|server rendered html|text content does not match/i;

let failures = 0;
const fail = (m) => { failures += 1; console.log("  FAIL", m); };
const ok = (m) => console.log("  ok  ", m);

const browser = await chromium.launch({ executablePath: process.env.PWCHROME, args: ["--no-sandbox", "--no-proxy-server"] });

async function open(path, locale) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Pretend a dev-browser/signed-out Clerk client so the fake-key server skips the Clerk handshake redirect.
  const cookies = [
    { name: "__clerk_db_jwt", value: "dvb_fake", url: BASE },
    { name: "__client_uat", value: "0", url: BASE },
  ];
  if (locale) cookies.push({ name: "NEXT_LOCALE", value: locale, url: BASE });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  // No network to Clerk/Vercel from the sandbox (and none wanted): fail those requests fast.
  await page.route(/clerk\.accounts\.dev|clerk\.com|clerk-telemetry|vercel/, (r) => r.abort());
  const msgs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) msgs.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => msgs.push(`pageerror: ${e.message}`));
  // Same-origin /api/* responses the page's widgets fetched (path+query -> status).
  const apis = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === new URL(BASE).origin && u.pathname.startsWith("/api/")) apis.push({ url: u.pathname + u.search, status: r.status() });
  });
  const res = await page.goto(BASE + path, { waitUntil: "load" });
  // Bounded idle wait: Chromium never reports a fetch with `Cache-Control: no-store` as finished while its body
  // is unread, and the announcements strip skips the body of a non-OK answer (the 503 without a database).
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  return { ctx, page, res, msgs, apis };
}

// Data-backed routes. No database exists in the sandbox: surah pages fall back to quranapi.pages.dev for the
// loader (title/meta), hadith pages must show their controlled error card (HTTP 503), never raw errors.
const LEAK = /prisma|127\.0\.0\.1|localhost:5432|ECONNREFUSED|Can't reach database/i;

console.log("/quran/1 (loader + head)");
{
  const { ctx, page, res, msgs } = await open("/quran/1");
  res.status() === 200 ? ok("HTTP 200") : fail(`status ${res.status()}`);
  const title = await page.title();
  /Al-Faatiha/.test(title) && /সূরা 1/.test(title) ? ok(`title "${title}"`) : fail(`title "${title}"`);
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  robots === "index, follow" ? ok("robots index, follow (overrides _app noindex)") : fail(`robots ${robots}`);
  const canon = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
  (process.env.SITE_URL ? canon === `${process.env.SITE_URL.replace(/\/$/, "")}/quran/1` : canon === null)
    ? ok(`canonical ${canon}`)
    : fail(`canonical ${canon}`);
  (await page.locator("main").first().isVisible()) ? ok("main rendered") : fail("no main");
  msgs.some((m) => HYDRATION.test(m)) ? fail("hydration warning") : ok("no hydration warning");
  await ctx.close();
}

// API-backed widgets (Task 8 server routes). quran/timings/ramadan need outbound HTTPS to quranapi.pages.dev
// and api.aladhan.com; without network they show their own error states and these checks report it.
const apiOk = (apis, prefix) => apis.find((a) => a.url.startsWith(prefix) && a.status === 200);

console.log("/quran/1 verse text (GET /api/quran?surah=1)");
{
  const { ctx, page, apis } = await open("/quran/1");
  await page.locator("main [dir=rtl].font-arabic").nth(6).waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  apiOk(apis, "/api/quran?surah=1") ? ok("GET /api/quran?surah=1 -> 200") : fail(`api calls ${JSON.stringify(apis)}`);
  const verses = page.locator("main [dir=rtl].font-arabic");
  const n = await verses.count();
  const first = n ? (await verses.nth(1).innerText()).trim() : "";
  n >= 7 && /[\u0600-\u06FF]{3,}/.test(first) ? ok(`${n} Arabic blocks, e.g. "${first.slice(0, 30)}"`) : fail(`verses not rendered (${n})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quran-1-verses.png` });
  await ctx.close();
}

console.log("/quran surah list (GET /api/quran)");
{
  const { ctx, page, apis } = await open("/quran");
  apiOk(apis, "/api/quran") ? ok("GET /api/quran -> 200") : fail(`api calls ${JSON.stringify(apis)}`);
  (await page.getByText(/Al-Baqara|আল-বাকারা/).first().isVisible().catch(() => false)) ? ok("surah list rendered") : fail("surah list missing");
  await ctx.close();
}

console.log("landing widgets (GET /api/timings, /api/quran, /api/ramadan-timetable)");
{
  const { ctx, page, apis, msgs } = await open("/");
  // The timetable sits further down; scroll so lazily mounted widgets fetch too.
  await page.mouse.wheel(0, 20000);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  for (const prefix of ["/api/timings", "/api/quran", "/api/ramadan-timetable"]) {
    const hit = apiOk(apis, prefix);
    hit ? ok(`${hit.url.slice(0, 70)} -> 200`) : fail(`${prefix}: ${JSON.stringify(apis.filter((a) => a.url.startsWith(prefix)))}`);
  }
  const text = await page.locator("main").first().innerText();
  /[০-৯0-9]{1,2}:[০-৯0-9]{2}/.test(text) ? ok("prayer/sehri/iftar times rendered") : fail("no times on the landing page");
  const relevant = msgs.filter((m) => !IGNORE.some((r) => r.test(m)));
  relevant.length ? fail(`console: ${relevant.join(" | ")}`) : ok("no console errors");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home-widgets.png`, fullPage: true });
  await ctx.close();
}

for (const path of ["/today", "/dashboard"]) {
  console.log(`${path} Ramadan status / timings (GET /api/ramadan${path === "/dashboard" ? ", /api/timings" : ""})`);
  const { ctx, apis } = await open(path);
  for (const prefix of path === "/dashboard" ? ["/api/ramadan?", "/api/timings"] : ["/api/ramadan?"]) {
    const hit = apiOk(apis, prefix);
    hit ? ok(`${hit.url.slice(0, 70)} -> 200`) : fail(`${prefix}: ${JSON.stringify(apis.filter((a) => a.url.startsWith(prefix.replace("?", ""))))}`);
  }
  await ctx.close();
}

for (const bad of ["/quran/999", "/quran/0", "/quran/abc", "/hadith/nope/does-not-exist-x"]) {
  console.log(`${bad} (404 or controlled error)`);
  const { ctx, page, res } = await open(bad);
  const body = await page.content();
  LEAK.test(body) ? fail("raw database/host text in the page") : ok("no database/host text");
  if (bad.startsWith("/quran")) {
    res.status() === 404 ? ok("HTTP 404") : fail(`status ${res.status()}`);
    (await page.getByText(/পাতা পাওয়া যায়নি|Page not found/).first().isVisible()) ? ok("root not-found page") : fail("not-found page missing");
  } else {
    // Without a database the edition cannot be looked up: 503 with the error card (404 once a DB answers).
    [404, 503].includes(res.status()) ? ok(`HTTP ${res.status()}`) : fail(`status ${res.status()}`);
  }
  await ctx.close();
}

console.log("/hadith (list, no database)");
{
  const { ctx, page, res } = await open("/hadith");
  res.status() === 503 ? ok("HTTP 503") : fail(`status ${res.status()}`);
  const body = await page.content();
  LEAK.test(body) ? fail("raw database/host text in the page") : ok("no database/host text");
  (await page.locator("main p").first().isVisible()) ? ok("controlled message shown") : fail("no message");
  await ctx.close();
}

console.log("client-side navigation to /hadith (server-function RPC path)");
{
  const { ctx, page, msgs } = await open("/today");
  await page.locator('a[href="/hadith"]:visible').first().click();
  await page.waitForURL("**/hadith", { timeout: 15000 });
  await page.getByText(/হাদিস পাঠ|Hadith/).first().waitFor({ state: "visible", timeout: 15000 });
  const text = await page.locator("main").first().innerText();
  LEAK.test(text) ? fail("raw database/host text after client navigation") : ok("no database/host text");
  /পাওয়া যায়নি|ব্যর্থ|Failed|No hadith|error/i.test(text) ? ok(`controlled state "${text.replace(/\s+/g, " ").slice(0, 60)}"`) : fail(`unexpected: ${text.slice(0, 80)}`);
  msgs.some((m) => HYDRATION.test(m)) ? fail("hydration warning") : ok("no hydration warning");
  await ctx.close();
}

for (const route of ROUTES) {
  console.log(route);
  const { ctx, page, res, msgs } = await open(route);
  res.status() === 200 ? ok("HTTP 200") : fail(`status ${res.status()}`);
  // /admin/announcements has no heading for a signed-out visitor (just the "sign in" sentence, as before).
  const heading = page
    .locator(route === "/admin/announcements" ? "main p" : "main h1, main h2, main [data-slot=card-title], h1")
    .first();
  (await heading.isVisible().catch(() => false)) ? ok(`heading/text "${(await heading.innerText()).slice(0, 40)}"`) : fail("no visible heading/text");
  const relevant = msgs.filter((m) => !IGNORE.some((r) => r.test(m)));
  relevant.length ? fail(`console: ${relevant.join(" | ")}`) : ok("no console errors");
  msgs.some((m) => HYDRATION.test(m)) ? fail("hydration warning") : ok("no hydration warning");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${route === "/" ? "home" : route.slice(1).replace(/\//g, "-")}.png` });
  await ctx.close();
}

for (const path of ["/", "/today"]) {
  console.log(`locale ${path}`);
  const texts = {};
  for (const loc of ["en", "bn"]) {
    const { ctx, page, msgs } = await open(path, loc);
    const lang = await page.locator("html").getAttribute("lang");
    texts[loc] = (await page.locator("main").first().innerText()).slice(0, 200);
    lang === loc ? ok(`html lang=${lang}`) : fail(`lang ${lang} for ${loc}`);
    if (msgs.some((m) => HYDRATION.test(m))) fail(`hydration warning in ${loc}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/locale-${path === "/" ? "home" : "today"}-${loc}.png` });
    await ctx.close();
  }
  texts.en !== texts.bn && /[a-z]{3}/i.test(texts.en) && /[ঀ-৿]/.test(texts.bn)
    ? ok("English and Bengali text differ (bn has Bengali script)")
    : fail("language did not flip");
}

console.log("guest Today persistence");
{
  // The salah tracker's prayers are toggle buttons (filled = done); the checklist below uses checkboxes.
  const { ctx, page } = await open("/today");
  const fajr = page.getByRole("button", { name: /^(ফজর|Fajr)/ }).first();
  await fajr.waitFor({ state: "visible", timeout: 15000 });
  const done = async () => (await fajr.getAttribute("class"))?.includes("bg-primary text-primary-foreground") ?? false;
  const box = page.getByRole("checkbox").first();
  const before = await done();
  const boxBefore = await box.isChecked();
  await fajr.click();
  await box.click();
  await page.waitForTimeout(500);
  const after = await done();
  const boxAfter = await box.isChecked();
  after !== before ? ok(`Fajr toggled ${before} -> ${after}`) : fail("Fajr did not toggle");
  boxAfter !== boxBefore ? ok(`checklist checkbox toggled ${boxBefore} -> ${boxAfter}`) : fail("checkbox did not toggle");
  await page.reload({ waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const fajr2 = page.getByRole("button", { name: /^(ফজর|Fajr)/ }).first();
  await fajr2.waitFor({ state: "visible", timeout: 15000 });
  const box2 = page.getByRole("checkbox").first();
  ((await fajr2.getAttribute("class"))?.includes("bg-primary text-primary-foreground") ?? false) === after
    ? ok("Fajr state persisted after reload (localStorage)")
    : fail("Fajr state lost after reload");
  (await box2.isChecked()) === boxAfter ? ok("checklist state persisted after reload") : fail("checklist state lost after reload");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/today-after-reload.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL OK");
process.exit(failures ? 1 : 0);
