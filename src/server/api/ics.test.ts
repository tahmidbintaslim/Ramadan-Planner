import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";
const SECRET = "abcdef0123456789";

const m = vi.hoisted(() => ({
  prisma: {
    calendarLink: { findFirst: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    reminderRule: { findMany: vi.fn() },
  },
  buildIcsFromRules: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/calendar", () => ({ buildIcsFromRules: m.buildIcsFromRules }));

import { handleIcs } from "./ics";

const req = (secret: string) => new Request(`https://app.example/api/calendar/ics/${encodeURIComponent(secret)}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.prisma.calendarLink.findFirst.mockResolvedValue({ userId: USER, icsSecret: SECRET });
  m.prisma.userProfile.findUnique.mockResolvedValue({
    timezone: "Asia/Dhaka",
    latitude: 23.8,
    longitude: 90.4,
    locationLabel: "Dhaka",
  });
  m.prisma.reminderRule.findMany.mockResolvedValue([
    { id: "r1", type: "iftar", label: null, offsetMinutes: -10, channels: ["calendar", "push"] },
    { id: "r2", type: "fajr", label: "x", offsetMinutes: 0, channels: ["push"] },
  ]);
  m.buildIcsFromRules.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
});

describe("GET /api/calendar/ics/$secret", () => {
  it("200 text/calendar with the Next headers (copied from the old route)", async () => {
    const res = await handleIcs(req(SECRET), SECRET);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="ramadan-planner.ics"');
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=21600");
    expect(await res.text()).toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
  });

  it("looks up by the secret and only includes enabled calendar-channel rules of that user", async () => {
    await handleIcs(req(SECRET), SECRET);
    expect(m.prisma.calendarLink.findFirst.mock.calls[0][0].where).toEqual({ icsSecret: SECRET });
    expect(m.prisma.reminderRule.findMany.mock.calls[0][0].where).toEqual({ userId: USER, enabled: true });
    expect(m.buildIcsFromRules).toHaveBeenCalledWith({
      secret: SECRET,
      timezone: "Asia/Dhaka",
      latitude: 23.8,
      longitude: 90.4,
      locationLabel: "Dhaka",
      rules: [{ id: "r1", type: "iftar", label: null, offsetMinutes: -10 }],
      days: 45,
    });
  });

  it("400 for a short or blank secret, without touching the DB", async () => {
    for (const secret of ["", "short", "       x", "1234567"]) {
      const res = await handleIcs(req(secret), secret);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid calendar secret" });
    }
    expect(m.prisma.calendarLink.findFirst).not.toHaveBeenCalled();
  });

  it("404 for an unknown secret, 404 when the profile is gone", async () => {
    m.prisma.calendarLink.findFirst.mockResolvedValueOnce(null);
    const unknown = await handleIcs(req("unknown-secret-123"), "unknown-secret-123");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Calendar not found" });

    m.prisma.userProfile.findUnique.mockResolvedValueOnce(null);
    const noProfile = await handleIcs(req(SECRET), SECRET);
    expect(noProfile.status).toBe(404);
    expect(await noProfile.json()).toEqual({ error: "Profile not found" });
  });

  it("DB failure -> masked 500, no DB text, not publicly cacheable", async () => {
    m.prisma.calendarLink.findFirst.mockRejectedValue(new Error("Can't reach database server at 127.0.0.1:5432"));
    const res = await handleIcs(req(SECRET), SECRET);
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toMatch(/127\.0\.0\.1|database/);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "internal_error" });
  });
});
