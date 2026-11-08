// Perceived-speed check against a running production build (npm run build && PORT=3031 npm start):
// requests per tab revisit, CLS (layout-shift entries without recent input) and LCP on cold loads of /today and
// /plan, at the iPhone 13 profile and at 1440x900. The public APIs are answered locally with a 300 ms delay (the
// CI server has no upstream access), as a guest with a stored location (Dhaka), outside Ramadan.
//   BASE_URL=http://localhost:3031 PWCHROME=/opt/pw-browsers/chromium node scripts/perf-measure.mjs
import { chromium, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3031";
const DELAY = 300;
const TZ = "Asia/Dhaka";
const LOCATION = { v: 1, kind: "default", districtId: "dhaka", lat: 23.81, lng: 90.41, tz: TZ, savedAt: "2027-01-01T00:00:00.000Z" };
const TIMINGS = {
  prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" },
  hijriDate: { day: "27", month: "Jumādā al-Ūlā", year: "1448", monthAr: "", monthBn: "জমাদিউল আউয়াল" },
  gregorianDate: "08-11-2026",
  timezone: TZ,
  location: "ঢাকা, বাংলাদেশ",
  source: "aladhan",
};
const RAMADAN = { phase: "pre-ramadan", currentDay: null, daysUntil: 92, hijriMonth: 5, hijriDay: "27", hijriYear: "1448", ramadanTotalDays: 30 };
const TIMETABLE = {
  days: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2027, 1, 8 + i));
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return {
      day: i + 1,
      gregorianDate: `${dd}-${mm}-${d.getUTCFullYear()}`,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()],
      sehri: "05:02",
      iftar: "17:55",
      fajr: "05:12",
      maghrib: "17:55",
    };
  }),
  location: "ঢাকা, বাংলাদেশ",
  timezone: TZ,
  hijriYear: "1448",
};
const SURAHS = Array.from({ length: 114 }, (_, i) => ({
  surahNo: i + 1,
  nameArabic: "الفاتحة",
  nameArabicLong: "",
  nameEnglish: `Surah ${i + 1}`,
  nameTranslation: "",
  nameBengali: `সূরা ${i + 1}`,
  revelationPlace: "Mecca",
  totalAyah: 7,
}));

const API = [
  [/\/api\/timings\?/, TIMINGS],
  [/\/api\/ramadan\?/, RAMADAN],
  [/\/api\/ramadan-timetable/, TIMETABLE],
  [/\/api\/quran$/, SURAHS],
];

async function newContext(browser, profile) {
  const context = await browser.newContext({ ...profile, locale: "bn-BD", timezoneId: TZ });
  await context.addCookies([
    { name: "__clerk_db_jwt", value: "dvb_fake", url: BASE_URL },
    { name: "__client_uat", value: "0", url: BASE_URL },
  ]);
  await context.route(/clerk\.accounts\.dev|clerk\.com|clerk-telemetry|vercel|open-meteo/, (r) => r.abort());
  const requests = [];
  for (const [re, body] of API) {
    await context.route(re, async (r) => {
      requests.push(new URL(r.request().url()).pathname);
      await new Promise((ok) => setTimeout(ok, DELAY));
      await r.fulfill({ json: body });
    });
  }
  // Server functions (the /quran loader, the planner) also count as data requests.
  context.on("request", (req) => {
    if (req.url().includes("/_serverFn/")) requests.push("serverFn");
  });
  await context.addInitScript((loc) => {
    try {
      if (!localStorage.getItem("rp_location")) localStorage.setItem("rp_location", JSON.stringify(loc));
    } catch {
      // about:blank
    }
    window.__cls = 0;
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  }, LOCATION);
  return { context, requests };
}

async function coldLoad(browser, profile, path) {
  const { context } = await newContext(browser, profile);
  const page = await context.newPage();
  await page.goto(BASE_URL + path, { waitUntil: "load" });
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => ({ cls: window.__cls, lcp: window.__lcp }));
  await context.close();
  return r;
}

/** Visit each tab by its nav link, then revisit: API/server-function requests per visit. */
async function revisits(browser, profile) {
  const { context, requests } = await newContext(browser, profile);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/today`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const tabs = ["/plan", "/timetable", "/quran", "/today"];
  const out = { first: {}, revisit: {} };
  for (const round of ["first", "revisit"]) {
    for (const path of tabs) {
      requests.length = 0;
      await page.evaluate((p) => {
        const a = [...document.querySelectorAll(`a[href="${p}"]`)].find((el) => el.offsetParent !== null);
        a?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        a?.click();
      }, path);
      await page.waitForURL(`**${path}`);
      await page.waitForTimeout(2000);
      out[round][path] = requests.length;
    }
  }
  await context.close();
  return out;
}

const browser = await chromium.launch({ executablePath: process.env.PWCHROME || undefined, args: ["--no-proxy-server"] });
const profiles = { "iPhone 13": devices["iPhone 13"], "1440x900": { viewport: { width: 1440, height: 900 } } };
const result = {};
for (const [name, profile] of Object.entries(profiles)) {
  result[name] = {};
  for (const path of ["/today", "/plan"]) {
    const runs = [];
    for (let i = 0; i < 3; i += 1) runs.push(await coldLoad(browser, profile, path));
    const max = (k) => Math.max(...runs.map((r) => r[k]));
    const median = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[1];
    result[name][path] = { clsMax: +max("cls").toFixed(3), lcpMedianMs: Math.round(median("lcp")) };
  }
}
result.requestsPerVisit = await revisits(browser, devices["iPhone 13"]);
await browser.close();
console.log(JSON.stringify(result, null, 2));
