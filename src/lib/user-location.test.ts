// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { districtById } from "./districts";
import {
  LOCATION_STORAGE_KEY,
  coarse,
  defaultLocation,
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
    ]) {
      expect(parseStoredLocation(raw)).toBeNull();
    }
    // Over-precise stored coordinates are coarsened on read.
    expect(parseStoredLocation(JSON.stringify({ v: 1, kind: "geo", lat: 51.50735, lng: -0.12776, tz: "Europe/London" })))
      .toMatchObject({ lat: 51.51, lng: -0.13 });
  });
});

describe("onboarding gate", () => {
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
