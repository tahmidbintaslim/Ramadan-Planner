import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface CalendarRule {
  id: string;
  type:
    | "sehri"
    | "iftar"
    | "fajr"
    | "dhuhr"
    | "asr"
    | "maghrib"
    | "isha"
    | "taraweeh"
    | "tahajjud"
    | "custom";
  label: string;
  offsetMinutes: number;
}

export interface GeneratedCalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}

interface AlAdhanCalendarDay {
  date: {
    gregorian: {
      date: string; // DD-MM-YYYY
    };
  };
  timings: Record<string, string>;
}

interface AlAdhanCalendarResponse {
  code: number;
  data: AlAdhanCalendarDay[];
}

const ALADHAN_BASE = "https://api.aladhan.com/v1/calendar";

function cleanTiming(t: string): string {
  return t.replace(/\s*\(.*\)$/, "").trim();
}

function parseDdMmYyyy(value: string): string {
  const [dd, mm, yyyy] = value.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

function formatUtcIcs(date: Date): string {
  return formatInTimeZone(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function eventTimeForType(
  type: CalendarRule["type"],
  timings: Record<string, string>,
): string | null {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(timings)) {
    normalized[key.toLowerCase()] = cleanTiming(value);
  }

  switch (type) {
    case "sehri":
      return normalized.imsak ?? normalized.fajr ?? null;
    case "iftar":
      return normalized.maghrib ?? null;
    case "fajr":
    case "dhuhr":
    case "asr":
    case "maghrib":
    case "isha":
      return normalized[type] ?? null;
    case "taraweeh":
      return normalized.isha ?? null;
    case "tahajjud":
      return normalized.lastthird ?? "03:00";
    case "custom":
      return "09:00";
    default:
      return null;
  }
}

function applyOffset(baseTime: string, offsetMinutes: number): string {
  const [hh, mm] = baseTime.split(":").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return baseTime;

  const total = hh * 60 + mm + offsetMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const nextH = Math.floor(wrapped / 60);
  const nextM = wrapped % 60;
  return `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
}

async function fetchMonthCalendar(
  year: number,
  month: number,
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<AlAdhanCalendarDay[]> {
  const url = `${ALADHAN_BASE}/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=1&school=1&timezonestring=${encodeURIComponent(timezone)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Calendar API failed (${res.status})`);
  }

  const json = (await res.json()) as AlAdhanCalendarResponse;
  if (json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error("Calendar API returned invalid payload");
  }

  return json.data;
}

async function fetchDateMap(
  latitude: number,
  longitude: number,
  timezone: string,
  days: number,
): Promise<Map<string, Record<string, string>>> {
  const start = new Date();
  const end = addDays(start, days + 3);

  const startYear = Number.parseInt(formatInTimeZone(start, timezone, "yyyy"), 10);
  const startMonth = Number.parseInt(formatInTimeZone(start, timezone, "MM"), 10);
  const endYear = Number.parseInt(formatInTimeZone(end, timezone, "yyyy"), 10);
  const endMonth = Number.parseInt(formatInTimeZone(end, timezone, "MM"), 10);

  const months: Array<{ year: number; month: number }> = [];
  if (startYear === endYear && startMonth === endMonth) {
    months.push({ year: startYear, month: startMonth });
  } else {
    months.push({ year: startYear, month: startMonth });
    months.push({ year: endYear, month: endMonth });
  }

  const dateMap = new Map<string, Record<string, string>>();

  for (const item of months) {
    const monthData = await fetchMonthCalendar(
      item.year,
      item.month,
      latitude,
      longitude,
      timezone,
    );
    for (const day of monthData) {
      const key = parseDdMmYyyy(day.date.gregorian.date);
      dateMap.set(key, day.timings);
    }
  }

  return dateMap;
}

export async function buildCalendarEventsFromRules(params: {
  secret: string;
  timezone: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  rules: CalendarRule[];
  days?: number;
}): Promise<GeneratedCalendarEvent[]> {
  const { secret, timezone, latitude, longitude, locationLabel } = params;
  const days = params.days ?? 30;

  const rules = params.rules.filter((rule) => rule.type !== "custom");
  if (rules.length === 0) {
    return [];
  }

  const dateMap = await fetchDateMap(latitude, longitude, timezone, days);
  const events: GeneratedCalendarEvent[] = [];

  for (let i = 0; i < days; i++) {
    const dateKey = formatInTimeZone(addDays(new Date(), i), timezone, "yyyy-MM-dd");
    const timings = dateMap.get(dateKey);
    if (!timings) continue;

    for (const rule of rules) {
      const baseTime = eventTimeForType(rule.type, timings);
      if (!baseTime) continue;

      const withOffset = applyOffset(baseTime, rule.offsetMinutes);
      const localDateTime = `${dateKey}T${withOffset}:00`;
      const start = fromZonedTime(localDateTime, timezone);
      const end = new Date(start.getTime() + 15 * 60 * 1000);

      const summary =
        rule.label.trim().length > 0 ? rule.label.trim() : `Reminder: ${rule.type}`;

      events.push({
        uid: `${secret}-${rule.id}-${dateKey}@ramadan-planner`,
        summary,
        description: `Ramadan Planner reminder (${rule.type})`,
        location: locationLabel,
        start,
        end,
      });
    }
  }

  return events;
}

export async function buildIcsFromRules(params: {
  secret: string;
  timezone: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  rules: CalendarRule[];
  days?: number;
}): Promise<string> {
  const events = await buildCalendarEventsFromRules(params);

  if (events.length === 0) {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ramadan Planner//Calendar Sync//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Ramadan Planner",
      "END:VCALENDAR",
    ].join("\r\n");
  }

  const nowStamp = formatUtcIcs(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ramadan Planner//Calendar Sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Ramadan Planner",
    `X-WR-TIMEZONE:${params.timezone}`,
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${formatUtcIcs(event.start)}`);
    lines.push(`DTEND:${formatUtcIcs(event.end)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
