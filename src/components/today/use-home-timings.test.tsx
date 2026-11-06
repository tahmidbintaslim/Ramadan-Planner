// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { homeRequestUrls, nextDayISO, useHomeTimings } from "./use-home-timings";

const TIMINGS = {
  prayerTimes: { fajr: "05:02", sunrise: "06:18", dhuhr: "12:14", asr: "16:18", maghrib: "17:58", isha: "19:12", sehri: "04:57", iftar: "17:58" },
  hijriDate: { day: "12", month: "Ramadan", year: "1448", monthAr: "", monthBn: "রমজান" },
  gregorianDate: "20-02-2027",
  timezone: "Asia/Dhaka",
  location: "ঢাকা, বাংলাদেশ",
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("homeRequestUrls", () => {
  it("dates every request and coarsens coordinates to 2 decimals", () => {
    const urls = homeRequestUrls("Asia/Dhaka", "2027-02-28", { lat: 23.810331, lng: 90.412521 });
    expect(urls.today).toBe("/api/timings?tz=Asia%2FDhaka&lat=23.81&lng=90.41&date=2027-02-28");
    expect(urls.tomorrow).toBe("/api/timings?tz=Asia%2FDhaka&lat=23.81&lng=90.41&date=2027-03-01");
    expect(urls.ramadan).toBe("/api/ramadan?tz=Asia%2FDhaka&lat=23.81&lng=90.41&date=2027-02-28");
    expect(homeRequestUrls("Asia/Dhaka", "2027-02-20").today).toBe("/api/timings?tz=Asia%2FDhaka&date=2027-02-20");
  });

  it("nextDayISO rolls over months and years", () => {
    expect(nextDayISO("2027-02-28")).toBe("2027-03-01");
    expect(nextDayISO("2026-12-31")).toBe("2027-01-01");
  });
});

describe("useHomeTimings", () => {
  it("requests today's date and refetches with the new date after midnight", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/timings") ? TIMINGS : { phase: "ramadan", currentDay: 12 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ day }) => useHomeTimings(day), { initialProps: { day: "2027-02-20" } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const first = fetchMock.mock.calls.map(([u]) => u);
    expect(first.some((u) => u.startsWith("/api/timings") && u.includes("date=2027-02-20"))).toBe(true);
    expect(first.some((u) => u.startsWith("/api/timings") && u.includes("date=2027-02-21"))).toBe(true);
    expect(first.some((u) => u.startsWith("/api/ramadan") && u.includes("date=2027-02-20"))).toBe(true);
    expect(result.current.tomorrow?.prayerTimes.sehri).toBe("04:57");

    fetchMock.mockClear();
    rerender({ day: "2027-02-21" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const second = fetchMock.mock.calls.map(([u]) => u);
    expect(second.filter((u) => u.includes("date=2027-02-21"))).toHaveLength(2);
    expect(second.some((u) => u.includes("date=2027-02-22"))).toBe(true);
    expect(second.some((u) => u.includes("2027-02-20"))).toBe(false);
  });
});

describe("useHomeTimings with a location chosen at onboarding", () => {
  it("requests the stored district's coordinates and zone and never asks for the device position", async () => {
    localStorage.setItem(
      "rp_location",
      JSON.stringify({ v: 1, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", savedAt: "" }),
    );
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    const fetchMock = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.startsWith("/api/timings") ? TIMINGS : { phase: "ramadan", currentDay: 12 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useHomeTimings("2027-02-20"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.location).toMatchObject({ kind: "district", districtId: "sylhet" });
    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes("tz=Asia%2FDhaka&lat=24.90&lng=91.87"))).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
