import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/globals.css"), "utf8");
const fontImports = [...css.matchAll(/@import "(@fontsource(?:-variable)?\/[^"]+)";/g)].map((m) => m[1]);

describe("font stack", () => {
  it("imports only the shipped families, weights and subsets", () => {
    expect(fontImports).toEqual([
      "@fontsource-variable/figtree/wght.css",
      "@fontsource/noto-naskh-arabic/arabic-400.css",
      "@fontsource/noto-naskh-arabic/arabic-500.css",
      "@fontsource/amiri-quran/arabic-400.css",
    ]);
  });

  it("self-hosts Anek Bangla's Bengali subset only (one variable file), with swap", () => {
    const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map((m) => m[1]).filter((f) => f.includes("Anek Bangla"));
    expect(faces).toHaveLength(1);
    expect(faces[0]).toContain("anek-bangla-bengali-wght-normal.woff2");
    expect(faces[0]).toContain("font-display: swap");
    expect(faces[0]).toMatch(/unicode-range: U\+0951-0952/);
    expect(fs.readFileSync(path.join(ROOT, "src/routes/__root.tsx"), "utf8")).toContain("anek-bangla-bengali-wght-normal.woff2?url");
  });

  it("defines the type tokens per locale: Anek Bangla (bn, every size), Figtree (en)", () => {
    const root = /:root \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(root).toMatch(/--font-rp-display: "Anek Bangla Variable"/);
    expect(root).toMatch(/--font-rp-sans: var\(--font-rp-display\)/);
    const en = /:root:lang\(en\) \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(en).toMatch(/--font-rp-display: "Figtree Variable"/);
  });

  it("sets text at 15px and below through the text token, never below 13px", () => {
    for (const role of ["rp-small", "rp-caption", "rp-overline", "rp-reading-small"]) {
      const rule = new RegExp(`@utility ${role} \\{([^}]+)`).exec(css)?.[1] ?? "";
      expect(rule, role).toContain("var(--font-rp-sans)");
      expect(Number(/font-size: (\d+)px/.exec(rule)?.[1]), role).toBeGreaterThanOrEqual(13);
    }
    // Bengali text roles keep a 1.4-1.5 line height (Footnote 13/20, Subheadline 15/22, Body 17/26).
    expect(css).toMatch(/@utility rp-caption \{[^}]*font-size: 13px; line-height: 20px/);
    expect(css).toMatch(/@utility rp-body \{[^}]*font-size: 17px; line-height: 26px/);
  });

  it("every imported face swaps", () => {
    for (const f of fontImports) {
      const face = fs.readFileSync(path.join(ROOT, "node_modules", f), "utf8");
      expect(face, f).toContain("font-display: swap");
    }
  });

  it("registers the theme families, each with a Bangladeshi system fallback", () => {
    for (const [util, family] of [
      ["display", "Anek Bangla Variable"],
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

  it("has no leftovers of the retired faces anywhere the app or the service worker loads", () => {
    for (const f of ["src/styles/globals.css", "src/routes/__root.tsx", "public/sw.js", "package.json"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8"), f).not.toMatch(
        /hind-siliguri|Hind Siliguri|geist|tiro|noto-serif|Noto Serif|noto-sans|"Noto Sans/i,
      );
    }
  });
});
