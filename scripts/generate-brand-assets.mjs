// Renders the web brand assets from their SVG sources in scripts/brand/ (Logo A: Hugeicons ramadan-01, MIT, white
// crescent + gold star on the teal gradient; see public/LICENSES/hugeicons-MIT.txt). Re-run after editing a source;
// the output names are the ones the manifest and the head reference:
//   public/icons/icon-192.png, icon-512.png (icon.svg, full bleed)
//   public/icons/icon-512-maskable.png (icon-maskable.svg, glyph inside the safe circle)
//   public/icons/apple-touch-icon.png (apple-touch-icon.svg)
//   public/favicon.ico (16 from favicon-16.svg, 32/48 from favicon.svg) and public/favicon.svg
//   public/og.png 1200x630 (og.svg, with the self-hosted Anek Bangla files from @fontsource-variable)
// Needs the `playwright` package and a Chrome:
//   PWCHROME=/usr/bin/google-chrome node scripts/generate-brand-assets.mjs
// After changing the icons, bump CACHE_VERSION in public/sw.js (the icons are precached); after changing og.png,
// bump the ?v= of OG_IMAGE_PATH in src/lib/seo.ts.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "scripts", "brand");
const PUBLIC = path.join(ROOT, "public");
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

const font = (pkg, file) =>
  `url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, "node_modules", "@fontsource-variable", pkg, "files", file)).toString("base64")}) format("woff2")`;
// Bengali and Latin subsets under one family each; unicode-range lets each glyph pick its subset.
const BN = "U+0951-0952,U+0964-0965,U+0980-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1";
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
// The app's variable face (one file per subset covers every weight): Anek Bangla for display and text. og.png and the icons were last rendered with the v2 faces; re-run to refresh them.
const FONT_CSS = [
  ["RP Display", "anek-bangla"],
  ["RP Sans", "anek-bangla"],
]
  .flatMap(([family, pkg]) => [
    `@font-face{font-family:"${family}";font-weight:100 900;src:${font(pkg, `${pkg}-bengali-wght-normal.woff2`)};unicode-range:${BN}}`,
    `@font-face{font-family:"${family}";font-weight:100 900;src:${font(pkg, `${pkg}-latin-wght-normal.woff2`)};unicode-range:${LATIN}}`,
  ])
  .join("\n");

const browser = await chromium.launch({ executablePath: process.env.PWCHROME, args: ["--no-sandbox"] });

async function render(svg, width, height, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    const sized = svg.replace("<svg ", `<svg width="${width}" height="${height}" `);
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}\nhtml,body{margin:0;background:transparent}svg{display:block}</style></head><body>${sized}</body></html>`,
    );
    await page.evaluate(async () => {
      await Promise.all(["RP Display", "RP Sans"].flatMap((f) => [`400 20px "${f}"`, `600 20px "${f}"`]).map((s) => document.fonts.load(s, "অআ Aa")));
      await document.fonts.ready;
    });
    return await page.screenshot({ omitBackground: transparent, type: "png" });
  } finally {
    await page.close();
  }
}

function write(rel, buf) {
  fs.writeFileSync(path.join(PUBLIC, rel), buf);
  console.log("wrote", rel, buf.length, "bytes");
}

/** An .ico whose entries are PNGs (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

try {
  const icon = read("icon.svg");
  const maskable = read("icon-maskable.svg");
  write("icons/icon-192.png", await render(icon, 192, 192, { transparent: true }));
  write("icons/icon-512.png", await render(icon, 512, 512, { transparent: true }));
  write("icons/icon-512-maskable.png", await render(maskable, 512, 512));
  write("icons/apple-touch-icon.png", await render(read("apple-touch-icon.svg"), 180, 180));
  const favicon = read("favicon.svg");
  const favicons = [{ size: 16, data: await render(read("favicon-16.svg"), 16, 16, { transparent: true }) }];
  for (const size of [32, 48]) favicons.push({ size, data: await render(favicon, size, size, { transparent: true }) });
  write("favicon.ico", ico(favicons));
  write("favicon.svg", Buffer.from(favicon));
  write("og.png", await render(read("og.svg"), 1200, 630));
} finally {
  await browser.close();
}
