// One-off generator for public/og.png (1200x630): brand green #006c40, the Moon mark, app name + tagline.
// Needs the `playwright` package and a Chrome: PWCHROME=/usr/bin/google-chrome node scripts/generate-og.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");
const MOON = "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z";
const html = `<body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#006c40,#004d2d);display:flex;align-items:center;justify-content:center;gap:56px;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#fff">
<svg width="220" height="220" viewBox="0 0 24 24"><path d="${MOON}" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>
<div><div style="font-size:84px;font-weight:700;letter-spacing:-1px">Ramadan Planner</div>
<div style="font-size:36px;margin-top:20px;opacity:.9;max-width:640px;line-height:1.3">Track daily ibadah, prayer times, Quran and reminders.</div></div></body>`;

const browser = await chromium.launch({ executablePath: process.env.PWCHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);
