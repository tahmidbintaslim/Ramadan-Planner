import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/globals.css"), "utf8");
const fontImports = [...css.matchAll(/@import "(@fontsource(?:-variable)?\/[^"]+)";/g)].map((m) => m[1]);

describe("font stack", () => {
  it("imports only the shipped families, weights and subsets", () => {
    expect(fontImports).toEqual([
      "@fontsource-variable/noto-sans-bengali/wght.css",
      "@fontsource-variable/noto-serif-bengali/wght.css",
      "@fontsource/tiro-bangla/bengali-400.css",
      "@fontsource/noto-naskh-arabic/arabic-400.css",
      "@fontsource/noto-naskh-arabic/arabic-500.css",
      "@fontsource/amiri-quran/arabic-400.css",
      "@fontsource-variable/noto-serif-display/wght.css",
      "@fontsource-variable/noto-sans/wght.css",
      "@fontsource-variable/noto-serif/wght.css",
    ]);
  });

  it("defines the English type tokens per locale (display, UI, reading)", () => {
    const en = /:root:lang\(en\) \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(en).toMatch(/--font-rp-display: "Noto Serif Display Variable"/);
    expect(en).toMatch(/--font-rp-sans: "Noto Sans Variable"/);
    expect(en).toMatch(/--font-rp-scripture: "Noto Serif Variable"/);
    // Latin inside bn headings falls through to Noto, not Tiro's Latin glyphs (not loaded).
    expect(css).toMatch(/--font-rp-display: "Tiro Bangla", "Noto Serif Display Variable"/);
  });

  it("every imported face swaps", () => {
    for (const f of fontImports) {
      const face = fs.readFileSync(path.join(ROOT, "node_modules", f), "utf8");
      expect(face, f).toContain("font-display: swap");
    }
  });

  it("registers the five theme families, each with a Bangladeshi system fallback", () => {
    for (const [util, family] of [
      ["sans", "Noto Sans Bengali Variable"],
      ["reading", "Noto Serif Bengali Variable"],
      ["display", "Tiro Bangla"],
      ["arabic", "Noto Naskh Arabic"],
      ["quran", "Amiri Quran"],
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
