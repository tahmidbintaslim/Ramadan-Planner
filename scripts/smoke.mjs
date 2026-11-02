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
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  return { ctx, page, res, msgs };
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
  await page.reload({ waitUntil: "networkidle" });
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
