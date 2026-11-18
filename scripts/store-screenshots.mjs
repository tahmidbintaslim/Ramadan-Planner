// Store screenshots and the Play feature graphic, taken from the live site as the apps show it (app mode: no
// donation links). Output in store/ (see docs/store-listing.md).
// Usage: node scripts/store-screenshots.mjs [baseUrl]   (default https://ramadanplanner.tahmid.space)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "https://ramadanplanner.tahmid.space").replace(/\/$/, "");
const PAGES = ["/today", "/timetable", "/plan", "/quran/1", "/duas"];
// CSS size × scale = the store's pixel size.
const TARGETS = [
  { dir: "store/play", app: "android", viewport: { width: 360, height: 780 }, scale: 3 }, // 1080 × 2340
  { dir: "store/ios", app: "ios", viewport: { width: 440, height: 956 }, scale: 3 }, // 1320 × 2868
];
// A returning guest in Dhaka (the shape src/lib/user-location.ts stores), past the welcome strip.
const LOCATION = { v: 1, kind: "default", districtId: "dhaka", lat: 23.81, lng: 90.41, tz: "Asia/Dhaka", savedAt: new Date().toISOString() };

// PWCHROME: a preinstalled Chromium, as in playwright.config.ts.
const browser = await chromium.launch(process.env.PWCHROME ? { executablePath: process.env.PWCHROME } : {});
for (const t of TARGETS) {
  for (const locale of ["bn", "en"]) {
    const out = `${t.dir}/${locale}`;
    mkdirSync(out, { recursive: true });
    const ctx = await browser.newContext({
      viewport: t.viewport,
      deviceScaleFactor: t.scale,
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
      locale: locale === "bn" ? "bn-BD" : "en-GB",
      timezoneId: "Asia/Dhaka",
    });
    await ctx.addCookies([{ name: "NEXT_LOCALE", value: locale, url: BASE }]);
    await ctx.addInitScript((loc) => {
      localStorage.setItem("rp_location", JSON.stringify(loc));
      localStorage.removeItem("rp_welcome_card"); // "1" means "show the welcome strip"
    }, LOCATION);
    const page = await ctx.newPage();
    for (const [i, path] of PAGES.entries()) {
      await page.goto(`${BASE}${path}?app=${t.app}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${i + 1}-${path.slice(1).replace(/\//g, "-")}.png` });
    }
    await ctx.close();
  }
}

// Play feature graphic, 1024 × 500: the mark and both names on the brand teal.
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.setContent(`<!doctype html><html><head><style>
  body{margin:0;width:1024px;height:500px;display:flex;align-items:center;gap:48px;padding:0 72px;box-sizing:border-box;
    background:linear-gradient(135deg,#0E7C6B,#0A5C50);color:#fff;font-family:"Anek Bangla","Noto Sans Bengali",sans-serif}
  img{width:200px;height:200px;border-radius:44px;box-shadow:0 12px 40px rgba(0,0,0,.25)}
  h1{font-size:64px;margin:0 0 8px;font-weight:700} h2{font-size:34px;margin:0 0 20px;font-weight:600;opacity:.9}
  p{font-size:26px;margin:0;opacity:.9}
</style></head><body><img src="${BASE}/icons/icon-512.png" alt=""><div>
  <h1>রমজান প্ল্যানার</h1><h2>Ramadan Planner</h2><p>সেহরি · ইফতার · নামাজ · কুরআন · দোয়া</p>
</div></body></html>`);
await page.waitForLoadState("networkidle");
mkdirSync("store/play", { recursive: true });
await page.screenshot({ path: "store/play/feature-graphic.png" });
await browser.close();
console.log("Wrote store/play and store/ios");
