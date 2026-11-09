// Loader server function for /timetable: the default (Dhaka) Ramadan timetable, so the page's HTML carries real
// sehri and iftar times for crawlers and first paint. PUBLIC read. It runs the same handler as
// GET /api/ramadan-timetable with the URL a visitor with no stored place requests, so the rows are identical.
import { createServerFn } from "@tanstack/react-start";
import type { RamadanTimetable } from "@/lib/ramadan-timetable";

const getDefaultTimetableFn = createServerFn({ method: "GET" }).handler(async (): Promise<RamadanTimetable | null> => {
  const { handleRamadanTimetable } = await import("@/server/api/ramadan-timetable");
  try {
    const res = await handleRamadanTimetable(new Request("http://localhost/api/ramadan-timetable?tz=Asia%2FDhaka"));
    return res.ok ? ((await res.json()) as RamadanTimetable) : null;
  } catch {
    return null; // the screen then loads it on the client, as before
  }
});

/** The Dhaka timetable for the server render; `null` when the source fails. */
export async function getDefaultTimetable(): Promise<RamadanTimetable | null> {
  return getDefaultTimetableFn();
}
