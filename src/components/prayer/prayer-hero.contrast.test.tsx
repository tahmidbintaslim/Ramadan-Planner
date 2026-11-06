// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrayerHero } from "./prayer-hero";
import { TZ, TIMINGS, WithIntl, at } from "./test-utils";

afterEach(cleanup);

// ── Tiny WCAG 2.x contrast helper ─────────────────────
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

const css = readFileSync(path.resolve(import.meta.dirname, "../../styles/globals.css"), "utf8");
const hex = (name: string) => new RegExp(`--rp-cs-${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(css)?.[1] ?? "";

describe("next-prayer card contrast (white text on the flat teal card, both modes)", () => {
  it("white on bg/live and on the countdown pill is at least 4.5:1", () => {
    expect(contrast("#FFFFFF", hex("teal"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", hex("teal-deep"))).toBeGreaterThanOrEqual(4.5);
  });

  for (const time of ["03:55", "13:00", "17:35", "21:00"]) {
    it(`renders full-white text on bg/live, never translucent white (${time})`, () => {
      render(
        <WithIntl>
          <PrayerHero timings={TIMINGS} timeZone={TZ} now={at(time)} />
        </WithIntl>,
      );
      const card = screen.getByRole("region");
      expect(card.className).toContain("bg-rp-live");
      expect(card.className).toContain("text-rp-on-live");
      // 5.10:1 holds only at full opacity: no text-white/NN anywhere in the card.
      expect(card.innerHTML).not.toMatch(/text-white\/\d+|opacity-/);
    });
  }
});
