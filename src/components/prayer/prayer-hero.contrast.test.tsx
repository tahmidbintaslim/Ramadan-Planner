// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PrayerPhase } from "@/lib/prayer-phase";
import {
  HERO_RING_SCRIM_ALPHA,
  HERO_SCRIM_RGB,
  HERO_SOURCE_PILL_ALPHA,
  PrayerHero,
} from "./prayer-hero";
import { TIMINGS, TZ, WithIntl, at } from "./test-utils";

afterEach(cleanup);

// ── Tiny WCAG 2.x contrast helper ─────────────────────
type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as RGB;
const mix = (fg: RGB, alpha: number, bg: RGB): RGB =>
  fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as unknown as RGB;
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const WHITE: RGB = [255, 255, 255];

// ── Gradient tokens, read from globals.css so the test follows the tokens ──
const css = readFileSync(path.resolve(import.meta.dirname, "../../styles/globals.css"), "utf8");
type Stop = { color: RGB; at: number };
function gradient(phase: PrayerPhase): Stop[] {
  const m = new RegExp(`--rp-hero-${phase}:\\s*linear-gradient\\(180deg,([^;]+)\\);`).exec(css);
  if (!m) throw new Error(`--rp-hero-${phase} not found`);
  return [...m[1].matchAll(/(#[0-9a-fA-F]{6})\s+(\d+)%/g)].map(([, c, p]) => ({ color: hex(c), at: Number(p) / 100 }));
}
function colourAt(stops: Stop[], p: number): RGB {
  const i = Math.max(1, stops.findIndex((s) => s.at >= p));
  const [a, b] = [stops[i - 1], stops[i] ?? stops[i - 1]];
  const t = b.at > a.at ? Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))) : 0;
  return mix(b.color, t, a.color);
}

/**
 * Each text element: the vertical band of the hero it can sit over (fraction of the height; the
 * default layout is 316px: 20 pad + 30 top row + 16 + 196 ring + 16 + 26 source pill + 12..20 pad,
 * bands widened for taller heroes), its white alpha, and the backdrop between it and the sky.
 */
const ELEMENTS: {
  name: string;
  band: [number, number];
  textAlpha: number;
  backdrop: (bg: RGB) => RGB;
}[] = [
  { name: "location pill", band: [0, 0.25], textAlpha: 1, backdrop: (bg) => mix(WHITE, 0.14, bg) },
  { name: "hijri date", band: [0, 0.25], textAlpha: 0.85, backdrop: (bg) => bg },
  ...(["ring label", "ring remaining"] as const).map((name) => ({
    name,
    band: [0.3, 0.75] as [number, number],
    textAlpha: 0.9,
    backdrop: (bg: RGB) => mix(HERO_SCRIM_RGB, HERO_RING_SCRIM_ALPHA, bg),
  })),
  {
    name: "ring time",
    band: [0.3, 0.75],
    textAlpha: 1,
    backdrop: (bg) => mix(HERO_SCRIM_RGB, HERO_RING_SCRIM_ALPHA, bg),
  },
  {
    name: "source line",
    band: [0.8, 1],
    textAlpha: 0.9,
    backdrop: (bg) => mix(HERO_SCRIM_RGB, HERO_SOURCE_PILL_ALPHA, bg),
  },
];

/** Lowest contrast across the band (the lightest stop under the text). */
function worstContrast(phase: PrayerPhase, el: (typeof ELEMENTS)[number]): number {
  const stops = gradient(phase);
  let worst = Infinity;
  for (let p = el.band[0]; p <= el.band[1] + 1e-9; p += 0.005) {
    const back = el.backdrop(colourAt(stops, p));
    worst = Math.min(worst, contrast(mix(WHITE, el.textAlpha, back), back));
  }
  return worst;
}

const PHASES: PrayerPhase[] = ["sehri", "day", "iftar", "night"];

describe("PrayerHero text contrast (>= 4.5:1 on every gradient stop under the text)", () => {
  it("parses the four hero gradients", () => {
    for (const phase of PHASES) expect(gradient(phase).length).toBeGreaterThanOrEqual(2);
    expect(gradient("iftar").at(-1)?.color).toEqual(hex("#D9B46C"));
  });

  for (const phase of PHASES) {
    for (const el of ELEMENTS) {
      it(`${phase}: ${el.name}`, () => {
        expect(worstContrast(phase, el)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("the backdrops are actually needed (bare white on the iftar sky fails)", () => {
    const bare = { ...ELEMENTS.at(-1)!, backdrop: (bg: RGB) => bg };
    expect(worstContrast("iftar", bare)).toBeLessThan(4.5);
  });
});

describe("PrayerHero renders the values the contrast check assumes", () => {
  it("uses the scrim disc, source pill and text alphas", () => {
    render(
      <WithIntl>
        <PrayerHero timings={TIMINGS} timeZone={TZ} district="ঢাকা" hijriLabel="২২ রমজান" source="IFB" now={at("17:35")} />
      </WithIntl>,
    );
    const rgba = (a: number) => `rgba(${HERO_SCRIM_RGB.join(", ")}, ${a})`;
    expect(screen.getByTestId("hero-ring-scrim").getAttribute("fill")).toBe(rgba(HERO_RING_SCRIM_ALPHA));
    const source = screen.getByTestId("hero-source");
    expect(source.style.backgroundColor).toBe(rgba(HERO_SOURCE_PILL_ALPHA));
    expect(source.className).toContain("text-white/90");
    expect(screen.getByText("২২ রমজান").className).toContain("text-white/85");
  });
});
