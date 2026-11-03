import { describe, expect, it } from "vitest";
import { HIJRI_MONTHS_BN, hijriMonthLabel } from "./hijri-months";

describe("hijriMonthLabel", () => {
  it("uses the Bengali name in bn and the plain English name in en", () => {
    expect(hijriMonthLabel(9, "Ramaḍān", "bn")).toBe(HIJRI_MONTHS_BN[9]);
    expect(hijriMonthLabel(10, "Shawwāl", "bn")).toBe("শাওয়াল");
    expect(hijriMonthLabel(9, "Ramaḍān", "en")).toBe("Ramadan");
    expect(hijriMonthLabel(null, "Ramadan", "bn")).toBe("Ramadan");
    expect(hijriMonthLabel(undefined, undefined, "en")).toBe("");
  });
});
