import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";
const SECRET = "abcdef0123456789";
const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
const HASH = sha256(SECRET);

const m = vi.hoisted(() => ({
  prisma: {
    calendarLink: { findFirst: vi.fn(), updateMany: vi.fn() },
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
  m.prisma.calendarLink.findFirst.mockResolvedValue({ id: "link-1", userId: USER, icsSecretHash: HASH });
  m.prisma.calendarLink.updateMany.mockResolvedValue({ count: 1 });
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
  it("200 text/calendar, never cached by a CDN or the browser (private, no-store)", async () => {
    const res = await handleIcs(req(SECRET), SECRET);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('inline; filename="ramadan-planner.ics"');
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.text()).toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
  });

  it("looks up by the secret's SHA-256 (or a legacy plaintext row) and only includes enabled calendar rules", async () => {
    await handleIcs(req(SECRET), SECRET);
    expect(m.prisma.calendarLink.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ icsSecretHash: HASH }, { icsSecret: SECRET }],
    });
    // Already hashed: no rewrite.
    expect(m.prisma.calendarLink.updateMany).not.toHaveBeenCalled();
    expect(m.prisma.reminderRule.findMany.mock.calls[0][0].where).toEqual({ userId: USER, enabled: true });
    expect(m.buildIcsFromRules).toHaveBeenCalledWith({
      secret: HASH, // UIDs are seeded with the hash, never the bearer secret
      timezone: "Asia/Dhaka",
      latitude: 23.8,
      longitude: 90.4,
      locationLabel: "Dhaka",
      rules: [{ id: "r1", type: "iftar", label: null, offsetMinutes: -10 }],
      days: 45,
    });
  });

  it("400 for a short, blank or oversized secret, without touching the DB", async () => {
    for (const secret of ["", "short", "       x", "1234567", "a".repeat(129)]) {
      const res = await handleIcs(req(secret), secret);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid calendar secret" });
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(m.prisma.calendarLink.findFirst).not.toHaveBeenCalled();
  });

  it("404 for an unknown secret, 404 when the profile is gone", async () => {
    m.prisma.calendarLink.findFirst.mockResolvedValueOnce(null);
    const unknown = await handleIcs(req("unknown-secret-123"), "unknown-secret-123");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Calendar not found" });
    expect(unknown.headers.get("Cache-Control")).toBe("no-store");

    m.prisma.userProfile.findUnique.mockResolvedValueOnce(null);
    const noProfile = await handleIcs(req(SECRET), SECRET);
    expect(noProfile.status).toBe(404);
    expect(await noProfile.json()).toEqual({ error: "Profile not found" });
  });

  it("a legacy plaintext row still serves the feed and is rewritten to the hash on use", async () => {
    m.prisma.calendarLink.findFirst.mockResolvedValueOnce({ id: "link-1", userId: USER, icsSecretHash: null });
    const res = await handleIcs(req(SECRET), SECRET);
    expect(res.status).toBe(200);
    expect(m.prisma.calendarLink.updateMany).toHaveBeenCalledWith({
      where: { id: "link-1", icsSecret: SECRET },
      data: { icsSecretHash: HASH, icsSecret: null },
    });
  });

  it("a failed legacy rewrite is logged but the feed is still served", async () => {
    m.prisma.calendarLink.findFirst.mockResolvedValueOnce({ id: "link-1", userId: USER, icsSecretHash: null });
    m.prisma.calendarLink.updateMany.mockRejectedValueOnce(new Error("db down"));
    const res = await handleIcs(req(SECRET), SECRET);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("the stored hash itself is not a valid token (it is hashed again and does not match)", async () => {
    m.prisma.calendarLink.findFirst.mockResolvedValueOnce(null);
    const res = await handleIcs(req(HASH), HASH);
    expect(res.status).toBe(404);
    expect(m.prisma.calendarLink.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ icsSecretHash: sha256(HASH) }, { icsSecret: HASH }],
    });
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
