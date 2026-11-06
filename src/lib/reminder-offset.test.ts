import { describe, expect, it } from "vitest";
import { parseOffsetMinutes } from "./reminder-offset";

describe("parseOffsetMinutes", () => {
  it("accepts whole minutes in either digit set, with a sign", () => {
    expect(parseOffsetMinutes("-১৫")).toBe(-15);
    expect(parseOffsetMinutes("-15")).toBe(-15);
    expect(parseOffsetMinutes("+১৫")).toBe(15);
    expect(parseOffsetMinutes("10")).toBe(10);
    expect(parseOffsetMinutes("০")).toBe(0);
    expect(parseOffsetMinutes("-0")).toBe(0);
    expect(parseOffsetMinutes("720")).toBe(720);
  });
  it("rejects drafts that are not a valid offset (never 0 by accident)", () => {
    for (const bad of ["", "-", "+", "abc", "1.5", "৭২১", "-800"]) expect(parseOffsetMinutes(bad)).toBeNull();
  });
});
