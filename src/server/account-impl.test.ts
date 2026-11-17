import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";

const m = vi.hoisted(() => {
  const many = () => ({ findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
  return {
    prisma: {
      userProfile: { findUnique: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      prayerGoal: many(),
      planTask: many(),
      dailyLog: many(),
      reminderRule: many(),
      pushSubscription: many(),
      calendarLink: { findUnique: vi.fn() },
      usageEvent: many(),
      pushDeliveryLog: many(),
      adminUser: many(),
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    },
    deleteUser: vi.fn(),
  };
});

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@clerk/tanstack-react-start/server", () => ({ clerkClient: () => ({ users: { deleteUser: m.deleteUser } }) }));

import { deleteAccountImpl, exportAccountDataImpl } from "./account-impl";

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("exportAccountDataImpl", () => {
  it("reads every user-owned table by the caller's id only, and leaves secrets out", async () => {
    m.prisma.userProfile.findUnique.mockResolvedValue({ id: USER, displayName: "A" });
    m.prisma.calendarLink.findUnique.mockResolvedValue({
      googleTokens: { enc: "SECRET" },
      icsSecretHash: "abc",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const res = await exportAccountDataImpl(USER);
    expect(res.ok).toBe(true);
    expect(m.prisma.userProfile.findUnique).toHaveBeenCalledWith({ where: { id: USER } });
    for (const table of ["prayerGoal", "planTask", "dailyLog", "reminderRule", "pushSubscription", "usageEvent"] as const) {
      expect(m.prisma[table].findMany.mock.calls[0][0].where).toEqual({ userId: USER });
    }
    // Push keys are never selected; the calendar link is reported as flags only.
    expect(m.prisma.pushSubscription.findMany.mock.calls[0][0].select).not.toHaveProperty("keys");
    expect(JSON.stringify(res)).not.toContain("SECRET");
    expect(res.ok && JSON.parse(res.data).calendar).toMatchObject({ googleCalendarConnected: true, icsFeedActive: true });
  });
});

describe("deleteAccountImpl", () => {
  it("deletes the caller's rows, then the Clerk user", async () => {
    const res = await deleteAccountImpl(USER, "user_abc");
    expect(res).toEqual({ ok: true, data: null });
    expect(m.prisma.userProfile.deleteMany).toHaveBeenCalledWith({ where: { id: USER } });
    for (const table of ["pushDeliveryLog", "usageEvent", "adminUser"] as const) {
      expect(m.prisma[table].deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    }
    expect(m.deleteUser).toHaveBeenCalledWith("user_abc");
    // Data first, account second.
    expect(m.prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(m.deleteUser.mock.invocationCallOrder[0]);
  });

  it("keeps the Clerk account when the data deletion fails", async () => {
    m.prisma.$transaction.mockRejectedValue(new Error("db down"));
    await expect(deleteAccountImpl(USER, "user_abc")).rejects.toThrow("db down");
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("reports a Clerk failure instead of claiming success", async () => {
    m.deleteUser.mockRejectedValue(new Error("clerk down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteAccountImpl(USER, "user_abc")).resolves.toEqual({ ok: false, error: "auth_delete_failed" });
  });
});
