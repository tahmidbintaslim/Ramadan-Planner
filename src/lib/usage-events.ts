// Usage events the app records (first-party, cookieless): page views and a few feature actions, for the admin
// dashboard. The server accepts only these names, so the table cannot fill with arbitrary strings.
export const USAGE_EVENTS = [
  "page_view",
  "reminder_added",
  "reminder_toggled",
  "push_enabled",
  "tasbih_round",
  "quran_play",
  "timetable_share",
  "location_set",
  "signup_cta",
  "donate_start",
] as const;

export type UsageEventName = (typeof USAGE_EVENTS)[number];

/** A path with no query or fragment, bounded; ids in /quran/36 are fine (no personal data in paths). */
export function cleanPath(path: string): string {
  return path.split(/[?#]/)[0].slice(0, 120);
}
