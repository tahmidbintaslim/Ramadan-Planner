// One-off generator for the PWA icons in public/icons (brand mark = the lucide "Moon" used in the app header,
// white on the primary green #006c40). Needs the `playwright` package and a Chrome: PWCHROME=/usr/bin/google-chrome
//   node scripts/generate-icons.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const GREEN = "#006c40";
const MOON = "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z";
// `scale` is the moon's size relative to the canvas (maskable icons keep it inside the 80% safe zone).
const ICONS = [
  { file: "icon-192.png", size: 192, scale: 0.6 },
  { file: "icon-512.png", size: 512, scale: 0.6 },
  { file: "icon-512-maskable.png", size: 512, scale: 0.46 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.6 },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PWCHROME, args: ["--no-sandbox"] });
for (const { file, size, scale } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const m = size * scale;
  await page.setContent(
    `<body style="margin:0;background:${GREEN}"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<g transform="translate(${(size - m) / 2} ${(size - m) / 2}) scale(${m / 24})">` +
      `<path d="${MOON}" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></g></svg></body>`,
  );
  await page.screenshot({ path: path.join(OUT, file) });
  await page.close();
  console.log("wrote", file);
}
await browser.close();
