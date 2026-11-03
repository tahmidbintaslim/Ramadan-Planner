import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  POPULAR_DISTRICT_IDS,
  districtById,
  districtName,
  findDistrict,
  matchDistricts,
  nearestDistrict,
  normalizeDistrictQuery,
} from "./districts";

describe("district list", () => {
  it("has the 64 districts with unique ids and names, inside Bangladesh", () => {
    expect(DISTRICTS).toHaveLength(64);
    expect(new Set(DISTRICTS.map((d) => d.id)).size).toBe(64);
    expect(new Set(DISTRICTS.map((d) => d.bn)).size).toBe(64);
    for (const d of DISTRICTS) {
      expect(d.lat).toBeGreaterThan(20.5);
      expect(d.lat).toBeLessThan(26.7);
      expect(d.lng).toBeGreaterThan(88);
      expect(d.lng).toBeLessThan(92.7);
    }
  });

  it("popular chips are the eight divisional towns", () => {
    expect(POPULAR_DISTRICT_IDS.map((id) => districtById(id)?.bn)).toEqual([
      "ঢাকা", "চট্টগ্রাম", "সিলেট", "রাজশাহী", "খুলনা", "বরিশাল", "রংপুর", "ময়মনসিংহ",
    ]);
  });

  it("names follow the locale", () => {
    const d = districtById("sylhet")!;
    expect(districtName(d, "bn")).toBe("সিলেট");
    expect(districtName(d, "en")).toBe("Sylhet");
  });
});

describe("matching", () => {
  it("normalizes case, spaces, punctuation and a district suffix", () => {
    expect(normalizeDistrictQuery("  Cox's Bazar ")).toBe("coxsbazar");
    expect(normalizeDistrictQuery("সিলেট জেলা")).toBe("সিলেট");
    expect(normalizeDistrictQuery("Dhaka District")).toBe("dhaka");
  });

  it("treats the one- and two-code-point forms of ড় ঢ় য় alike", () => {
    const single = "\u09AC\u0997\u09C1\u09DC\u09BE"; // বগুড়া with U+09DC
    const split = "\u09AC\u0997\u09C1\u09A1\u09BC\u09BE"; // বগুড়া as ড + nukta
    expect(normalizeDistrictQuery(single)).toBe(normalizeDistrictQuery(split));
    expect(normalizeDistrictQuery(split)).toContain("\u09DC");
    expect(findDistrict(split)?.id).toBe("bogura");
    expect(findDistrict(single)?.id).toBe("bogura");
    // য় (U+09DF vs য + nukta) and ঢ় (U+09DD vs ঢ + nukta)
    expect(findDistrict("\u09AE\u09AF\u09BC\u09AE\u09A8\u09B8\u09BF\u0982\u09B9")?.id).toBe("mymensingh");
    expect(normalizeDistrictQuery("\u09A2\u09BC")).toBe("\u09DD");
  });

  it("matches Bengali and English names and old spellings, best first", () => {
    expect(matchDistricts("সিলে").map((d) => d.id)).toEqual(["sylhet"]);
    expect(matchDistricts("chittagong")[0].id).toBe("chattogram");
    expect(matchDistricts("comilla")[0].id).toBe("cumilla");
    expect(matchDistricts("BOGRA")[0].id).toBe("bogura");
    // Prefix matches come before substring matches.
    const ganj = matchDistricts("ganj", 64).map((d) => d.id);
    expect(ganj).toContain("gopalganj");
    expect(matchDistricts("")).toEqual([]);
    expect(matchDistricts("zzz")).toEqual([]);
  });

  it("findDistrict needs an exact name or a single candidate", () => {
    expect(findDistrict("ঢাকা")?.id).toBe("dhaka");
    expect(findDistrict("jessore")?.id).toBe("jashore");
    expect(findDistrict("sylh")?.id).toBe("sylhet");
    // "pur" matches many districts: ambiguous.
    expect(findDistrict("pur")).toBeUndefined();
    expect(findDistrict("London")).toBeUndefined();
  });
});

describe("nearestDistrict", () => {
  it("names a coarse position inside Bangladesh and nothing abroad", () => {
    expect(nearestDistrict(23.78, 90.4)?.id).toBe("dhaka");
    expect(nearestDistrict(24.89, 91.86)?.id).toBe("sylhet");
    expect(nearestDistrict(51.51, -0.13)).toBeUndefined();
  });
});
