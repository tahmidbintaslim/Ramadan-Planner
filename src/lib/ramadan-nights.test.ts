import { describe, expect, it } from "vitest";
import { ODD_NIGHTS, oddNightStartingAfter } from "./ramadan-nights";

describe("oddNightStartingAfter", () => {
  it("maps the iftar of roza 20/22/24/26/28 to nights 21/23/25/27/29", () => {
    expect([20, 22, 24, 26, 28].map(oddNightStartingAfter)).toEqual([21, 23, 25, 27, 29]);
  });
  it("is null for every other roza (including 21, 29 and 30)", () => {
    const others = Array.from({ length: 30 }, (_, i) => i + 1).filter((d) => ![20, 22, 24, 26, 28].includes(d));
    expect(others.map(oddNightStartingAfter).every((n) => n === null)).toBe(true);
    expect(ODD_NIGHTS).toHaveLength(5);
  });
});
