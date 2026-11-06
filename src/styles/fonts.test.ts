import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/globals.css"), "utf8");
const fontImports = [...css.matchAll(/@import "@fontsource\/([^"]+)";/g)].map((m) => m[1]);

describe("font stack", () => {
  it("imports only the shipped families, weights and subsets", () => {
    expect(fontImports).toEqual([
      ...["bengali", "latin"].flatMap((s) => [400, 500, 600, 700].map((w) => `noto-sans-bengali/${s}-${w}.css`)),
      ...["bengali", "latin"].flatMap((s) => [400, 500].map((w) => `noto-serif-bengali/${s}-${w}.css`)),
      "tiro-bangla/bengali-400.css",
      "tiro-bangla/latin-400.css",
      "noto-naskh-arabic/arabic-400.css",
      "noto-naskh-arabic/arabic-500.css",
    ]);
  });

  it("every imported face swaps", () => {
    for (const f of fontImports) {
      const face = fs.readFileSync(path.join(ROOT, "node_modules/@fontsource", f), "utf8");
      expect(face, f).toContain("font-display: swap");
    }
  });

  it("registers the four theme families, each with a Bangladeshi system fallback", () => {
    for (const [util, family] of [
      ["sans", "Noto Sans Bengali"],
      ["reading", "Noto Serif Bengali"],
      ["display", "Tiro Bangla"],
      ["arabic", "Noto Naskh Arabic"],
    ]) {
      const token = new RegExp(`--font-${util}: var\\((--font-rp-[a-z]+)\\);`).exec(css)?.[1];
      expect(token, util).toBeTruthy();
      const stack = new RegExp(`${token}: ([^;]+);`).exec(css)?.[1] ?? "";
      expect(stack.startsWith(`"${family}"`), util).toBe(true);
      expect(stack).toContain('"Kalpurush"');
      expect(stack).toContain('"SolaimanLipi"');
    }
  });

  it("has no Hind Siliguri or geist leftovers anywhere the app or the service worker loads", () => {
    for (const f of ["src/styles/globals.css", "src/routes/__root.tsx", "public/sw.js", "package.json"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8"), f).not.toMatch(/hind-siliguri|Hind Siliguri|geist/i);
    }
  });
});
