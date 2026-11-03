import { describe, expect, it } from "vitest";
import { formatLocalizedNumber, localizeAsciiDigits, parseLocalizedNumber, toAsciiDigits } from "./locale-number";

describe("locale numbers", () => {
  it("formats in Bengali digits for bn and ASCII for en", () => {
    expect(formatLocalizedNumber(85000, "bn")).toBe("৮৫০০০");
    expect(formatLocalizedNumber(-15, "bn")).toBe("-১৫");
    expect(formatLocalizedNumber(33, "en")).toBe("33");
    expect(localizeAsciiDigits("+1 / -1", "bn")).toBe("+১ / -১");
  });

  it("converts Bengali digits to ASCII", () => {
    expect(toAsciiDigits("১২৩ abc 45")).toBe("123 abc 45");
    expect(toAsciiDigits("")).toBe("");
  });

  it("parses numbers typed in either digit set", () => {
    expect(parseLocalizedNumber("৮৫০০০")).toBe(85000);
    expect(parseLocalizedNumber("85000")).toBe(85000);
    expect(parseLocalizedNumber("৮৫,০০০")).toBe(85000);
    expect(parseLocalizedNumber("১২.৫")).toBe(12.5);
    expect(parseLocalizedNumber("-১৫")).toBe(-15);
    expect(parseLocalizedNumber("−15")).toBe(-15);
    expect(parseLocalizedNumber("৩৩")).toBe(33);
    expect(parseLocalizedNumber("")).toBeNull();
    expect(parseLocalizedNumber("abc")).toBeNull();
    expect(parseLocalizedNumber("1-2")).toBeNull();
  });
});
