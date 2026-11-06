// The one place an AlAdhan day becomes the app's Sehri and Iftar: the Home (/api/timings via fetchPrayerTimes) and
// the timetable (/api/ramadan-timetable via fetchRamadanTimetable) both call it, with the same request parameters
// (ALADHAN_METHOD_PARAMS), so the same day always shows the same Sehri and Iftar on both screens.
//   Sehri ends = AlAdhan "Imsak" (method 1, Karachi; school 1, Hanafi). Iftar = "Maghrib". Times are HH:mm in the
//   requested zone; AlAdhan's " (+06)" style suffix is dropped.

/** Query parameters every AlAdhan timings request uses (University of Islamic Sciences, Karachi; Hanafi Asr). */
export const ALADHAN_METHOD_PARAMS = "method=1&school=1";

/** "04:57 (+06)" -> "04:57". */
export function cleanAlAdhanTime(t: string): string {
  return t.replace(/\s*\(.*\)$/, "");
}

export interface AlAdhanFastTimings {
  Imsak: string;
  Fajr: string;
  Maghrib: string;
}

/** Sehri end, Iftar, Fajr and Maghrib of one AlAdhan day. */
export function fastTimesFromAlAdhan(t: AlAdhanFastTimings): { sehri: string; iftar: string; fajr: string; maghrib: string } {
  return {
    sehri: cleanAlAdhanTime(t.Imsak),
    iftar: cleanAlAdhanTime(t.Maghrib),
    fajr: cleanAlAdhanTime(t.Fajr),
    maghrib: cleanAlAdhanTime(t.Maghrib),
  };
}
