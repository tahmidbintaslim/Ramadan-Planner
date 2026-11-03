// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { districtById } from "./districts";
import {
  LOCATION_STORAGE_KEY,
  coarse,
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
      v: 1, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", savedAt: NOW.toISOString(),
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
      JSON.stringify({ v: 2, kind: "district", districtId: "dhaka", lat: 1, lng: 1, tz: "Asia/Dhaka" }),
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
