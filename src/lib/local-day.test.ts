// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTodayKey } from "@/hooks/use-guest-data";
import {
  LOCAL_DAY_MIGRATION_KEY,
  deviceTimeZone,
  localDayKey,
  localTimeZone,
  localTodayISO,
  migrateUtcDayKey,
  shiftISO,
} from "./local-day";
import { pruneLocalHistory } from "./local-history";
import { LOCATION_STORAGE_KEY, locationFromCoords, locationFromDistrict } from "./user-location";
import { districtById, DEFAULT_DISTRICT_ID } from "./districts";

const DHAKA_0530 = new Date("2027-02-19T23:30:00Z"); // 20 Feb, 05:30 in Dhaka (UTC+6)
const DHAKA_0630 = new Date("2027-02-20T00:30:00Z"); // 20 Feb, 06:30 in Dhaka
const LA_1530 = new Date("2027-02-19T23:30:00Z"); // 19 Feb, 15:30 in Los Angeles (UTC-8)
const LA_1630 = new Date("2027-02-20T00:30:00Z"); // 19 Feb, 16:30 in Los Angeles, after UTC midnight

function storeLocation(tz: "Asia/Dhaka" | "America/Los_Angeles") {
  const loc =
    tz === "Asia/Dhaka"
      ? locationFromDistrict(districtById(DEFAULT_DISTRICT_ID)!)
      : locationFromCoords(34.05, -118.24, "America/Los_Angeles");
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("local day key", () => {
  it("Asia/Dhaka: 05:30 and 06:30 are the same local day (the old UTC key flipped at 06:00)", () => {
    expect(localDayKey("salah", DHAKA_0530, "Asia/Dhaka")).toBe("salah_2027-02-20");
    expect(localDayKey("salah", DHAKA_0630, "Asia/Dhaka")).toBe("salah_2027-02-20");
    // What the UTC key used to say at 05:30:
    expect(DHAKA_0530.toISOString().slice(0, 10)).toBe("2027-02-19");
  });

  it("America/Los_Angeles: the day does not change at UTC midnight (16:00 local)", () => {
    expect(localDayKey("salah", LA_1530, "America/Los_Angeles")).toBe("salah_2027-02-19");
    expect(localDayKey("salah", LA_1630, "America/Los_Angeles")).toBe("salah_2027-02-19");
    expect(localDayKey("salah", new Date("2027-02-20T08:00:00Z"), "America/Los_Angeles")).toBe("salah_2027-02-20");
  });

  it("the zone comes from the stored location, then the device, then Asia/Dhaka", () => {
    storeLocation("America/Los_Angeles");
    expect(localTimeZone()).toBe("America/Los_Angeles");
    expect(localTodayISO(LA_1630)).toBe("2027-02-19");
    storeLocation("Asia/Dhaka");
    expect(localTimeZone()).toBe("Asia/Dhaka");
    vi.useFakeTimers();
    vi.setSystemTime(DHAKA_0530);
    expect(getTodayKey("checklist")).toBe("checklist_2027-02-20");

    // No stored location: the device zone (Asia/Dhaka only when the runtime cannot tell).
    localStorage.clear();
    expect(localTimeZone()).toBe(deviceTimeZone() ?? "Asia/Dhaka");
    // A malformed stored location is ignored.
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ v: 1, kind: "geo", lat: 1, lng: 1, tz: "Not/AZone" }));
    expect(localTimeZone()).toBe(deviceTimeZone() ?? "Asia/Dhaka");
  });

  it("shiftISO crosses months and years", () => {
    expect(shiftISO("2027-03-01", -1)).toBe("2027-02-28");
    expect(shiftISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("migrateUtcDayKey (one-time copy from the old UTC key)", () => {
  it("copies today's UTC-keyed entry when today's local entry is empty, and never deletes it", () => {
    storeLocation("Asia/Dhaka");
    localStorage.setItem("rp_salah_2027-02-19", JSON.stringify({ fajr: true }));
    expect(migrateUtcDayKey("rp_salah_2027-02-20", DHAKA_0530)).toBe(true);
    expect(JSON.parse(localStorage.getItem("rp_salah_2027-02-20")!)).toEqual({ fajr: true });
    expect(localStorage.getItem("rp_salah_2027-02-19")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(LOCAL_DAY_MIGRATION_KEY)!)).toEqual(["rp_salah"]);
  });

  it("runs once per family: a later day never inherits the previous day's entry", () => {
    storeLocation("Asia/Dhaka");
    expect(migrateUtcDayKey("rp_salah_2027-02-20", DHAKA_0630)).toBe(false); // same date: nothing to copy, marked
    localStorage.setItem("rp_salah_2027-02-20", JSON.stringify({ fajr: true }));
    // Next night at 05:30: local 21 Feb is empty, UTC date is 20 Feb (yesterday's real entry).
    expect(migrateUtcDayKey("rp_salah_2027-02-21", new Date("2027-02-20T23:30:00Z"))).toBe(false);
    expect(localStorage.getItem("rp_salah_2027-02-21")).toBeNull();
  });

  it("keeps an existing local entry, ignores other days' keys and other families", () => {
    storeLocation("Asia/Dhaka");
    localStorage.setItem("rp_quran_2027-02-19", JSON.stringify({ para: "3" }));
    localStorage.setItem("rp_quran_2027-02-20", JSON.stringify({ para: "4" }));
    expect(migrateUtcDayKey("rp_quran_2027-02-20", DHAKA_0530)).toBe(false);
    expect(JSON.parse(localStorage.getItem("rp_quran_2027-02-20")!)).toEqual({ para: "4" });
    expect(migrateUtcDayKey("rp_journal_2027-02-18", DHAKA_0530)).toBe(false);
    expect(migrateUtcDayKey("rp_plan_goals", DHAKA_0530)).toBe(false);
    expect(JSON.parse(localStorage.getItem(LOCAL_DAY_MIGRATION_KEY)!)).toEqual(["rp_quran"]);
  });
});

describe("pruneLocalHistory (local cutoff)", () => {
  it("keeps the last 7 local days of one family only", () => {
    for (const d of ["2027-02-13", "2027-02-14", "2027-02-20"]) localStorage.setItem(`rp_salah_${d}`, "{}");
    localStorage.setItem("rp_salah_extra_2027-01-01", "{}");
    pruneLocalHistory("rp_salah", 7, "2027-02-20");
    expect(localStorage.getItem("rp_salah_2027-02-13")).toBeNull();
    expect(localStorage.getItem("rp_salah_2027-02-14")).not.toBeNull();
    expect(localStorage.getItem("rp_salah_2027-02-20")).not.toBeNull();
    expect(localStorage.getItem("rp_salah_extra_2027-01-01")).not.toBeNull();
  });
});
