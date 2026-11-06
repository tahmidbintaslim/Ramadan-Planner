import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The v4 colour pairs the screens use, read from globals.css so the check follows the tokens (WCAG 2.x AA).
const css = fs.readFileSync(path.resolve(import.meta.dirname, "globals.css"), "utf8");

function primitive(name: string): string {
  const v = new RegExp(`--rp-cs-${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(css)?.[1];
  if (!v) throw new Error(`--rp-cs-${name} not found`);
  return v;
}
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum]: 4.5 for text, 3 for field borders and the dark-mode links (>= 16px Medium
// only, which still clear 4.5 here).
const PAIRS: [string, string, number][] = [
  // Light
  ["ink", "ground", 4.5],
  ["ink-2", "ground", 4.5],
  ["ink-2", "white", 4.5],
  ["ink-2", "tonal", 4.5],
  ["teal-text", "ground", 4.5],
  ["teal-text", "white", 4.5],
  ["teal-text", "tonal", 4.5],
  ["ink", "tonal", 4.5],
  ["white", "teal", 4.5],
  ["white", "teal-deep", 4.5],
  ["input", "white", 3],
  // Dark
  ["night-ink", "night", 4.5],
  ["night-ink-2", "night", 4.5],
  ["night-ink-2", "night-surface", 4.5],
  ["night-ink", "night-tonal", 4.5],
  ["night-ink", "night-bar", 4.5],
  ["mint", "night", 4.5],
  ["mint", "night-surface", 4.5],
  ["mint", "night-tonal", 4.5],
  ["mint", "night-bar", 4.5],
  ["on-mint", "mint", 4.5],
  ["night-input", "night-surface", 3],
];

describe("v4 colour tokens meet WCAG AA", () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} on ${bg} >= ${min}`, () => {
      expect(contrast(primitive(fg), primitive(bg))).toBeGreaterThanOrEqual(min);
    });
  }

  it("keeps the next-prayer card #0E7C6B in both modes", () => {
    expect(primitive("teal")).toBe("#0E7C6B");
    const dark = /\.dark \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(dark).not.toMatch(/--rp-bg-live:/);
  });
});
