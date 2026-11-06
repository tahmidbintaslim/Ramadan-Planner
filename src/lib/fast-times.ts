// The one place an AlAdhan day becomes the app's Sehri and Iftar: the Home (/api/timings via fetchPrayerTimes) and
// the timetable (/api/ramadan-timetable via fetchRamadanTimetable) both call it, with the same request parameters
// (ALADHAN_METHOD_PARAMS), so the same day always shows the same Sehri and Iftar on both screens.
//   Sehri ends = AlAdhan "Imsak" (method 1, Karachi; school 1, Hanafi). Iftar = "Maghrib". Times are HH:mm in the
//   requested zone; AlAdhan's " (+06)" style suffix is dropped.
//
// Tuned against the Islamic Foundation Bangladesh 1447/2026 district timetables (8 districts x 30 days). The IFB
// takes sehri end at true dawn on the district's eastern edge and iftar at sunset on its western edge, rounded up.
// Untuned, AlAdhan's Imsak (Fajr - 10) was 7-10 min earlier than the IFB sehri end, and Maghrib was 1-2 min EARLIER
// than the IFB iftar on every one of the 240 days (it would have people break the fast early). The tune below makes
// Imsak = Fajr - 3 (mean error 1.1 min, never later than the IFB) and Maghrib = sunset + 2 (mean 0.5, max 1, never
// earlier than the IFB). Fajr itself is not changed. Order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight.
export const ALADHAN_TUNE = "7,0,0,0,0,2,0,0,0";

/** Query parameters every AlAdhan timings request uses (University of Islamic Sciences, Karachi; Hanafi Asr; IFB tune). */
export const ALADHAN_METHOD_PARAMS = `method=1&school=1&tune=${ALADHAN_TUNE}`;

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
