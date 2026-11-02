import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const m = vi.hoisted(() => ({
  prisma: {
    calendarLink: { findUnique: vi.fn(), upsert: vi.fn() },
    pushSubscription: { count: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    reminderRule: { findMany: vi.fn() },
  },
  getAppAuthUser: vi.fn(),
  refreshGoogleTokens: vi.fn(),
  ensureRamadanCalendar: vi.fn(),
  syncEventsToGoogleCalendar: vi.fn(),
  buildCalendarEventsFromRules: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser: m.getAppAuthUser }));
vi.mock("@/lib/calendar", () => ({ buildCalendarEventsFromRules: m.buildCalendarEventsFromRules }));
vi.mock("@/lib/google-calendar", async () => {
  const actual = await vi.importActual<typeof import("@/lib/google-calendar")>("@/lib/google-calendar");
  return {
    ...actual,
    refreshGoogleTokens: m.refreshGoogleTokens,
    ensureRamadanCalendar: m.ensureRamadanCalendar,
    syncEventsToGoogleCalendar: m.syncEventsToGoogleCalendar,
  };
});

import { decryptJson, encryptJson } from "@/lib/secure-json";
import {
  disconnectGoogleCalendarImpl,
  getGoogleCalendarStatusImpl,
  getOrCreateIcsLinkImpl,
  getPushStatusImpl,
  revokeIcsLinkImpl,
  syncGoogleCalendarImpl,
} from "./integrations-impl";

const TOKENS = {
  accessToken: "ya29.SECRET-ACCESS",
  refreshToken: "1//SECRET-REFRESH",
  expiryDate: 1_900_000_000_000,
  syncedAt: "2026-03-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("CALENDAR_TOKENS_ENCRYPTION_KEY", "ab".repeat(32));
  for (const model of Object.values(m.prisma)) for (const fn of Object.values(model)) fn.mockReset();
  m.getAppAuthUser.mockReset();
  m.getAppAuthUser.mockResolvedValue({ id: USER, clerkId: "user_x", email: "me@example.com" });
});

// Every Prisma call must be keyed by the passed user id, and never mention another user.
afterEach(() => {
  vi.unstubAllEnvs();
  for (const [model, fns] of Object.entries(m.prisma)) {
    for (const [name, fn] of Object.entries(fns)) {
      for (const [args] of fn.mock.calls as unknown[][][]) {
        const a = args as { where?: Record<string, unknown>; create?: Record<string, unknown> };
        const key = model === "userProfile" ? "id" : "userId";
        expect(a.where?.[key], `${model}.${name} where`).toBe(USER);
        if (a.create) expect(a.create.userId, `${model}.${name} create`).toBe(USER);
        expect(JSON.stringify(args)).not.toContain(OTHER);
      }
    }
  }
});

describe("ICS link", () => {
  it("returns the caller's existing secret without writing", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue({ icsSecret: " abc123 " });
    const res = await getOrCreateIcsLinkImpl(USER);
    expect(res).toEqual({ ok: true, data: { secret: "abc123", urlPath: "/api/calendar/ics/abc123" } });
    expect(m.prisma.calendarLink.findUnique).toHaveBeenCalledWith({
      where: { userId: USER },
      select: { icsSecret: true },
    });
    expect(m.prisma.calendarLink.upsert).not.toHaveBeenCalled();
  });

  it("creates a 32-char hex secret for the caller when there is none (or it is blank)", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue({ icsSecret: "   " });
    const res = await getOrCreateIcsLinkImpl(USER);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.secret).toMatch(/^[0-9a-f]{32}$/);
    expect(res.data.urlPath).toBe(`/api/calendar/ics/${res.data.secret}`);
    expect(m.prisma.calendarLink.upsert).toHaveBeenCalledWith({
      where: { userId: USER },
      create: { userId: USER, icsSecret: res.data.secret },
      update: { icsSecret: res.data.secret },
    });
  });

  it("revoke clears only the caller's secret", async () => {
    const res = await revokeIcsLinkImpl(USER);
    expect(res).toEqual({ ok: true, data: null });
    expect(m.prisma.calendarLink.upsert).toHaveBeenCalledWith({
      where: { userId: USER },
      create: { userId: USER, icsSecret: null },
      update: { icsSecret: null },
    });
  });
});

describe("push status", () => {
  it("counts the caller's subscriptions only", async () => {
    m.prisma.pushSubscription.count.mockResolvedValue(3);
    expect(await getPushStatusImpl(USER)).toEqual({ ok: true, data: { subscriptions: 3 } });
    expect(m.prisma.pushSubscription.count).toHaveBeenCalledWith({ where: { userId: USER } });
  });
});

describe("Google calendar status", () => {
  it("never returns tokens or secrets: only connected, email and syncedAt", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue({ googleTokens: encryptJson(TOKENS) });
    const res = await getGoogleCalendarStatusImpl(USER);
    expect(res).toEqual({
      ok: true,
      data: { connected: true, email: "me@example.com", syncedAt: TOKENS.syncedAt },
    });
    const json = JSON.stringify(res);
    for (const secret of ["SECRET-ACCESS", "SECRET-REFRESH", "accessToken", "refreshToken", "ya29"]) {
      expect(json).not.toContain(secret);
    }
    expect(m.prisma.calendarLink.findUnique).toHaveBeenCalledWith({
      where: { userId: USER },
      select: { googleTokens: true },
    });
  });

  it("reports not connected when there are no tokens", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue(null);
    expect(await getGoogleCalendarStatusImpl(USER)).toEqual({
      ok: true,
      data: { connected: false, email: "me@example.com", syncedAt: null },
    });
  });

  it("looks the email up with getAppAuthUser({ withEmail: true })", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue(null);
    await getGoogleCalendarStatusImpl(USER);
    expect(m.getAppAuthUser).toHaveBeenCalledWith({ withEmail: true });
  });

  it("is unauthorized when the session is not the passed user", async () => {
    m.prisma.calendarLink.findUnique.mockResolvedValue(null);
    m.getAppAuthUser.mockResolvedValue({ id: OTHER, clerkId: "user_o", email: "o@example.com" });
    expect(await getGoogleCalendarStatusImpl(USER)).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("disconnect Google calendar", () => {
  it("nulls only the caller's tokens", async () => {
    const res = await disconnectGoogleCalendarImpl(USER);
    expect(res).toEqual({ ok: true, data: null });
    const call = m.prisma.calendarLink.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: USER });
    expect(call.create.userId).toBe(USER);
    expect(Object.keys(call.update)).toEqual(["googleTokens"]);
  });
});

describe("sync Google calendar", () => {
  const profile = { timezone: "Asia/Dhaka", latitude: 23.8, longitude: 90.4, locationLabel: "Dhaka" };
  const rules = [
    { id: "r1", type: "iftar", label: "Iftar", offsetMinutes: -10, channels: ["calendar", "push"] },
    { id: "r2", type: "fajr", label: "Fajr", offsetMinutes: 0, channels: ["push"] },
  ];

  function arrange(over: { profile?: unknown; link?: unknown } = {}) {
    m.prisma.userProfile.findUnique.mockResolvedValue("profile" in over ? over.profile : profile);
    m.prisma.calendarLink.findUnique.mockResolvedValue(
      "link" in over ? over.link : { googleTokens: encryptJson(TOKENS), icsSecret: "keepme" },
    );
    m.prisma.reminderRule.findMany.mockResolvedValue(rules);
    m.refreshGoogleTokens.mockResolvedValue({ ...TOKENS, accessToken: "ya29.REFRESHED", expiryDate: 1_950_000_000_000 });
    m.ensureRamadanCalendar.mockResolvedValue("cal-1");
    m.syncEventsToGoogleCalendar.mockResolvedValue(7);
    m.buildCalendarEventsFromRules.mockResolvedValue([{ uid: "e" }]);
  }

  it("fails with profile_missing / google_not_connected (old strings)", async () => {
    arrange({ profile: null });
    expect(await syncGoogleCalendarImpl(USER)).toEqual({ ok: false, error: "profile_missing" });
    arrange({ link: { googleTokens: null, icsSecret: null } });
    expect(await syncGoogleCalendarImpl(USER)).toEqual({ ok: false, error: "google_not_connected" });
    expect(m.refreshGoogleTokens).not.toHaveBeenCalled();
  });

  it("syncs only the caller's calendar-channel rules and returns only the event count", async () => {
    arrange();
    const res = await syncGoogleCalendarImpl(USER);
    expect(res).toEqual({ ok: true, data: { syncedEvents: 7 } });
    expect(JSON.stringify(res)).not.toMatch(/ya29|SECRET|accessToken|refreshToken/);

    expect(m.prisma.reminderRule.findMany.mock.calls[0][0].where).toEqual({ userId: USER, enabled: true });
    expect(m.buildCalendarEventsFromRules).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "keepme",
        timezone: "Asia/Dhaka",
        days: 45,
        rules: [{ id: "r1", type: "iftar", label: "Iftar", offsetMinutes: -10 }],
      }),
    );
    expect(m.syncEventsToGoogleCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "ya29.REFRESHED", calendarId: "cal-1" }),
    );
  });

  it("stores the refreshed tokens encrypted (never plain) under the caller's link", async () => {
    arrange();
    await syncGoogleCalendarImpl(USER);
    const writes = m.prisma.calendarLink.upsert.mock.calls.map((c) => c[0]);
    expect(writes.length).toBe(2); // the sync write, then the refreshed-token persist
    for (const w of writes) {
      expect(w.where).toEqual({ userId: USER });
      expect(JSON.stringify(w)).not.toContain("ya29.REFRESHED");
      const stored = decryptJson(w.update.googleTokens) as { accessToken: string; calendarId: string };
      expect(stored.accessToken).toBe("ya29.REFRESHED");
      expect(stored.calendarId).toBe("cal-1");
    }
    expect(writes[0].update.icsSecret).toBe("keepme");
  });

  it("does not persist tokens a second time when they did not change", async () => {
    arrange();
    m.refreshGoogleTokens.mockResolvedValue({ ...TOKENS });
    await syncGoogleCalendarImpl(USER);
    expect(m.prisma.calendarLink.upsert).toHaveBeenCalledTimes(1);
  });

  it("creates an ics secret when the caller has none", async () => {
    arrange({ link: { googleTokens: encryptJson(TOKENS), icsSecret: null } });
    await syncGoogleCalendarImpl(USER);
    expect(m.prisma.calendarLink.upsert.mock.calls[0][0].update.icsSecret).toMatch(/^[0-9a-f]{32}$/);
  });
});
