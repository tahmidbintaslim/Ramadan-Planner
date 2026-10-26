import { afterEach, describe, expect, it, vi } from "vitest";
import { getRamadanStatus } from "./ramadan-date";

describe("getRamadanStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts Ramadan on the same day as the timetable for a -1 offset", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T06:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/gToH/")) {
          return Response.json({
            code: 200,
            data: { hijri: { day: "14", month: { number: 5, en: "Jumādá al-ūlá" }, year: "1448" } },
          });
        }
        const adj = /\/hToGCalendar\/9\/1448\?.*adjustment=(-?\d+)/.exec(url)?.[1];
        if (adj === undefined) return new Response("", { status: 503 });
        // Live AlAdhan: adjustment=0 starts 1448 on 08-02-2027 and moves the
        // Gregorian dates by the adjustment.
        const start = 8 + Number(adj);
        return Response.json({
          code: 200,
          data: Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.UTC(2027, 1, start + i));
            const dd = String(d.getUTCDate()).padStart(2, "0");
            const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
            return { gregorian: { date: `${dd}-${mm}-2027` } };
          }),
        });
      }),
    );

    const status = await getRamadanStatus("Asia/Dhaka", "BD");

    // fetchRamadanTimetable's /calendar call with adjustment=-1 puts day 1 on 09-02-2027.
    expect(status.ramadanStartGregorian).toBe("09-02-2027");
    expect(status.ramadanEndGregorian).toBe("10-03-2027");
    expect(status.daysUntil).toBe(106);
  });
});
