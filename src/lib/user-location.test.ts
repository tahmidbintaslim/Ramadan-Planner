// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { districtById } from "./districts";
import {
  LOCATION_STORAGE_KEY,
  calcRequestParams,
  coarse,
  locationFromCity,
  readHijriAdjust,
  writeHijriAdjust,
  defaultLocation,
  gateDecision,
  isValidTimeZone,
  storedRequestLocation,
  locationFromCoords,
  locationFromDistrict,
  parseStoredLocation,
  readStoredLocation,
  shouldOnboard,
  signedInFromCookie,
  writeStoredLocation,
} from "./user-location";

const NOW = new Date("2027-02-20T07:00:00Z");

afterEach(() => localStorage.clear());

describe("building a location", () => {
  it("a picked district uses its coordinates and Bangladesh's zone", () => {
    expect(locationFromDistrict(districtById("sylhet")!, "district", NOW)).toEqual({
      v: 2, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", country: "BD", method: 1, school: 1,
      savedAt: NOW.toISOString(),
    });
  });

  it("'later' is Dhaka, marked as the default", () => {
    expect(defaultLocation(NOW)).toMatchObject({ kind: "default", districtId: "dhaka", lat: 23.81, lng: 90.41 });
  });

  it("a device position is rounded to 2 decimals and named after the nearest district", () => {
    expect(coarse(23.810331)).toBe(23.81);
    expect(coarse(90.416)).toBe(90.42);
    expect(locationFromCoords(23.810331, 90.412521, "Asia/Dhaka", NOW)).toMatchObject({
      kind: "geo", districtId: "dhaka", lat: 23.81, lng: 90.41, tz: "Asia/Dhaka",
    });
    // Just over the border the device keeps its own zone and no district name is given.
    for (const [lat, lng] of [[23.83, 91.28], [26.73, 88.4]]) {
      const across = locationFromCoords(lat, lng, "Asia/Kolkata", NOW);
      expect(across.tz).toBe("Asia/Kolkata");
      expect(across.districtId).toBeUndefined();
    }
    // Far from any district town (beyond 25 km) a Bangladesh device keeps Asia/Dhaka, unnamed.
    expect(locationFromCoords(21.9, 89.3, "Asia/Dhaka", NOW)).toMatchObject({ tz: "Asia/Dhaka" });
    expect(locationFromCoords(21.9, 89.3, "Asia/Dhaka", NOW).districtId).toBeUndefined();
    // An unknown device zone falls back to Bangladesh's.
    expect(locationFromCoords(23.81, 90.41, "Mars/Olympus", NOW).tz).toBe("Asia/Dhaka");
    const london = locationFromCoords(51.50735, -0.12776, "Europe/London", NOW);
    expect(london).toMatchObject({ kind: "geo", lat: 51.51, lng: -0.13, tz: "Europe/London" });
    expect(london.districtId).toBeUndefined();
  });
});

describe("storage", () => {
  it("round-trips through localStorage", () => {
    expect(readStoredLocation()).toBeNull();
    const loc = locationFromDistrict(districtById("khulna")!, "district", NOW);
    expect(writeStoredLocation(loc)).toBe(true);
    expect(JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY)!)).toEqual(loc);
    expect(readStoredLocation()).toEqual(loc);
  });

  it("rejects malformed values", () => {
    for (const raw of [
      "", "{", "null", "[]",
      JSON.stringify({ v: 3, kind: "district", districtId: "dhaka", lat: 1, lng: 1, tz: "Asia/Dhaka" }),
      JSON.stringify({ v: 1, kind: "city", lat: 1, lng: 1, tz: "Asia/Dhaka", label: "X" }),
      JSON.stringify({ v: 1, kind: "district", districtId: "atlantis", lat: 1, lng: 1, tz: "Asia/Dhaka" }),
      JSON.stringify({ v: 1, kind: "district", lat: 1, lng: 1, tz: "Asia/Dhaka" }),
      JSON.stringify({ v: 1, kind: "geo", lat: 200, lng: 1, tz: "Asia/Dhaka" }),
      JSON.stringify({ v: 1, kind: "geo", lat: 1, lng: 1 }),
      JSON.stringify({ v: 1, kind: "geo", lat: 1, lng: 1, tz: "Not/AZone" }),
    ]) {
      expect(parseStoredLocation(raw)).toBeNull();
    }
    // Over-precise stored coordinates are coarsened on read.
    expect(parseStoredLocation(JSON.stringify({ v: 1, kind: "geo", lat: 51.50735, lng: -0.12776, tz: "Europe/London" })))
      .toMatchObject({ lat: 51.51, lng: -0.13 });
  });
});

describe("v1 -> v2 migration and calculation params", () => {
  it("migrates a v1 district to BD with Karachi + Hanafi", () => {
    const raw = JSON.stringify({ v: 1, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", savedAt: "x" });
    expect(parseStoredLocation(raw)).toEqual({
      v: 2, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", country: "BD", method: 1, school: 1, savedAt: "x",
    });
  });

  it("migrates a v1 device position abroad from its zone, labelled with the zone's city", () => {
    const loc = parseStoredLocation(JSON.stringify({ v: 1, kind: "geo", lat: 41.88, lng: -87.63, tz: "America/Chicago" }));
    expect(loc).toMatchObject({ v: 2, country: "US", method: 2, school: 0, label: "Chicago" });
    const london = parseStoredLocation(JSON.stringify({ v: 1, kind: "geo", lat: 51.5, lng: -0.13, tz: "Europe/London" }));
    expect(london).toMatchObject({ country: "GB", method: 3, school: 0 });
  });

  it("keeps a v2 user's own method and school, and drops invalid ones", () => {
    const base = { v: 2, kind: "city", lat: 13.75, lng: 100.5, tz: "Asia/Bangkok", label: "Bangkok", country: "TH" };
    expect(parseStoredLocation(JSON.stringify({ ...base, method: 1, school: 1 }))).toMatchObject({ method: 1, school: 1 });
    expect(parseStoredLocation(JSON.stringify({ ...base, method: 99, school: 7 }))).toMatchObject({ method: 3, school: 0 });
  });

  it("a searched city stores 2-decimal coordinates, zone, label, country and its default method", () => {
    expect(locationFromCity({ name: "Chicago", country_code: "US", latitude: 41.85003, longitude: -87.65005, timezone: "America/Chicago" }, NOW)).toEqual({
      v: 2, kind: "city", lat: 41.85, lng: -87.65, tz: "America/Chicago", label: "Chicago", country: "US", method: 2, school: 0, savedAt: NOW.toISOString(),
    });
    expect(locationFromCity({ name: "X", latitude: 1, longitude: 1, timezone: "Not/AZone" })).toBeNull();
  });

  it("request params: Bangladesh sends Karachi + Hanafi; the Hijri adjustment only when set", () => {
    const bd = locationFromDistrict(districtById("dhaka")!, "district", NOW);
    expect(calcRequestParams(bd, 0)).toEqual({ cc: "BD", method: "1", school: "1" });
    expect(calcRequestParams(null, -1)).toEqual({ hadj: "-1" });
    writeHijriAdjust(2);
    expect(readHijriAdjust()).toBe(2);
    writeHijriAdjust(0);
    expect(readHijriAdjust()).toBe(0);
  });
});

describe("time zones and request parameters", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Dhaka")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("storedRequestLocation gives the stored coords and zone, or null", () => {
    expect(storedRequestLocation()).toBeNull();
    writeStoredLocation(locationFromDistrict(districtById("rangpur")!, "district", NOW));
    expect(storedRequestLocation()).toEqual({ tz: "Asia/Dhaka", lat: 25.74, lng: 89.25 });
  });
});

describe("onboarding gate", () => {
  const base = { hasLocation: false, cookieSignedIn: false, authLoading: false, signedIn: false, authTimedOut: false };

  it("gateDecision clears at once on a location or a signed-in cookie", () => {
    expect(gateDecision({ ...base, hasLocation: true, authLoading: true })).toBe("clear");
    expect(gateDecision({ ...base, cookieSignedIn: true, authLoading: true })).toBe("clear");
  });

  it("gateDecision waits for auth, then onboards a guest or clears a user", () => {
    expect(gateDecision({ ...base, authLoading: true })).toBe("wait");
    expect(gateDecision({ ...base, authLoading: true, authTimedOut: true })).toBe("onboard");
    expect(gateDecision({ ...base })).toBe("onboard");
    expect(gateDecision({ ...base, signedIn: true })).toBe("clear");
  });

  it("only a guest without a location is onboarded", () => {
    expect(shouldOnboard({ hasLocation: false, signedIn: false })).toBe(true);
    expect(shouldOnboard({ hasLocation: true, signedIn: false })).toBe(false);
    expect(shouldOnboard({ hasLocation: false, signedIn: true })).toBe(false);
    expect(shouldOnboard({ hasLocation: true, signedIn: true })).toBe(false);
  });

  it("reads Clerk's __client_uat cookie", () => {
    expect(signedInFromCookie("")).toBe(false);
    expect(signedInFromCookie("__client_uat=0; __clerk_db_jwt=dvb_fake")).toBe(false);
    expect(signedInFromCookie("a=1; __client_uat=1730600000")).toBe(true);
    expect(signedInFromCookie("x__client_uat=1730600000")).toBe(false);
  });
});
