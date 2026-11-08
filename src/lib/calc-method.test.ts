import { describe, expect, it } from "vitest";
import { aladhanParams, defaultMethodForCountry, resolveCalc } from "./calc-method";
import { resolveCountryCode } from "./hijri-offsets";

describe("country -> calculation method", () => {
  it("follows the approved mapping (AlAdhan ids checked against /v1/methods)", () => {
    const m = (cc: string) => defaultMethodForCountry(cc);
    for (const cc of ["BD", "PK", "IN", "AF"]) expect(m(cc)).toEqual({ method: 1, school: 1 });
    expect(m("TH")).toEqual({ method: 3, school: 0 });
    expect(m("MY").method).toBe(17);
    expect(m("SG").method).toBe(11);
    expect(m("ID").method).toBe(20);
    expect(m("SA").method).toBe(4);
    expect(m("AE").method).toBe(16);
    expect(m("QA").method).toBe(10);
    expect(m("KW").method).toBe(9);
    expect(m("EG").method).toBe(5);
    expect(m("TR").method).toBe(13);
    expect(m("US")).toEqual({ method: 2, school: 0 });
    expect(m("CA")).toEqual({ method: 2, school: 0 });
    expect(m("GB")).toEqual({ method: 3, school: 0 });
    expect(defaultMethodForCountry(undefined)).toEqual({ method: 3, school: 0 });
  });

  it("keeps Bangladesh's exact IFB-calibrated params, and tunes no other country", () => {
    expect(aladhanParams({ country: "BD" })).toBe("method=1&school=1&tune=7,0,0,0,0,2,0,0,0");
    expect(aladhanParams({ country: "PK" })).toBe("method=1&school=1");
    expect(aladhanParams({ country: "US" })).toBe("method=2&school=0");
    expect(aladhanParams({})).toBe("method=3&school=0");
  });

  it("lets the user override method and school", () => {
    expect(resolveCalc({ country: "US", school: 1 })).toEqual({ method: 2, school: 1 });
    expect(aladhanParams({ country: "GB", method: 15 })).toBe("method=15&school=0");
  });

  it("finds the country: stored first, then the zone, then coordinates", () => {
    expect(resolveCountryCode({ country: "us", timezone: "Asia/Dhaka" })).toBe("US");
    expect(resolveCountryCode({ timezone: "Asia/Dhaka" })).toBe("BD");
    expect(resolveCountryCode({ timezone: "America/Denver" })).toBe("US");
    expect(resolveCountryCode({ timezone: "America/Edmonton" })).toBe("CA");
    // Dubai's coordinates fall in the coarse Saudi box; its zone wins.
    expect(resolveCountryCode({ timezone: "Asia/Dubai", latitude: 25.2, longitude: 55.27 })).toBe("AE");
    expect(resolveCountryCode({ timezone: "UTC", latitude: 13.75, longitude: 100.5 })).toBe("TH");
  });
});
