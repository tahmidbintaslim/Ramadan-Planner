import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/admin", () => ({ isUserAdmin: vi.fn(async () => false) }));
vi.mock("@/server/caller", () => ({ getCallerWithEmail: vi.fn(async (id: string) => (id === "u1" ? { id, email: "x@y.z", emailVerified: true } : null)) }));

const { fillDays, getAdminOverviewImpl } = await import("./admin-overview-impl");

describe("admin overview", () => {
  it("fills the last N Dhaka days oldest first, zero where nothing happened", () => {
    // 2027-02-20 03:00 UTC = 09:00 Dhaka.
    const out = fillDays([{ day: "2027-02-19", count: 5n }, { day: "2027-02-20", count: 2 }], 3, new Date("2027-02-20T03:00:00Z"));
    expect(out).toEqual([
      { day: "2027-02-18", count: 0 },
      { day: "2027-02-19", count: 5 },
      { day: "2027-02-20", count: 2 },
    ]);
  });

  it("refuses unknown callers and signed-in non-admins before any query", async () => {
    expect(await getAdminOverviewImpl("nobody")).toEqual({ ok: false, error: "unauthorized" });
    expect(await getAdminOverviewImpl("u1")).toEqual({ ok: false, error: "forbidden" });
  });
});
