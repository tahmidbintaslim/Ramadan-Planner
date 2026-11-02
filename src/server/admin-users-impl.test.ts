import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_TABLE = "11111111-1111-4111-8111-111111111111";
const ADMIN_MAIL = "22222222-2222-4222-8222-222222222222";
const NOBODY = "33333333-3333-4333-8333-333333333333";
const TARGET = "44444444-4444-4444-8444-444444444444";

const m = vi.hoisted(() => ({
  prisma: {
    adminUser: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    userProfile: { findUnique: vi.fn() },
  },
  getAppAuthUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser: m.getAppAuthUser }));

import { addAdminUserImpl, getAdminAccessImpl, listAdminUsersImpl, removeAdminUserImpl } from "./admin-users-impl";

function session(id: string, email: string | null, adminRows: string[] = []) {
  m.getAppAuthUser.mockResolvedValue({ id, clerkId: "user_x", email });
  m.prisma.adminUser.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    adminRows.includes(where.userId) ? { userId: where.userId } : null,
  );
}

function writes() {
  return [m.prisma.adminUser.findMany, m.prisma.adminUser.upsert, m.prisma.adminUser.deleteMany, m.prisma.userProfile.findUnique];
}

beforeEach(() => {
  for (const model of Object.values(m.prisma)) for (const fn of Object.values(model)) fn.mockReset();
  m.getAppAuthUser.mockReset();
  vi.stubEnv("ADMIN_EMAILS", "boss@example.com");
  m.prisma.adminUser.findMany.mockResolvedValue([]);
  m.prisma.userProfile.findUnique.mockResolvedValue({ id: TARGET });
});

describe("admin gate on every admin-users function", () => {
  const calls: Array<[string, (u: string) => Promise<unknown>]> = [
    ["list", (u) => listAdminUsersImpl(u)],
    ["add", (u) => addAdminUserImpl(u, TARGET)],
    ["remove", (u) => removeAdminUserImpl(u, TARGET)],
  ];

  it.each(calls)("%s: a non-admin is forbidden and nothing is read or written", async (_n, call) => {
    session(NOBODY, "nobody@example.com", [ADMIN_TABLE]);
    expect(await call(NOBODY)).toEqual({ ok: false, error: "forbidden" });
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it.each(calls)("%s: a non-admin with no email is forbidden", async (_n, call) => {
    session(NOBODY, null);
    expect(await call(NOBODY)).toEqual({ ok: false, error: "forbidden" });
  });

  it.each(calls)("%s: no session, or a session for another user, is unauthorized", async (_n, call) => {
    m.getAppAuthUser.mockResolvedValue(null);
    expect(await call(ADMIN_TABLE)).toEqual({ ok: false, error: "unauthorized" });
    session(ADMIN_TABLE, "x@example.com", [ADMIN_TABLE]);
    expect(await call(NOBODY)).toEqual({ ok: false, error: "unauthorized" });
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it.each(calls)("%s: an admin by table row is allowed", async (_n, call) => {
    session(ADMIN_TABLE, null, [ADMIN_TABLE]); // no email needed for the table path (old rule)
    expect(((await call(ADMIN_TABLE)) as { ok: boolean }).ok).toBe(true);
  });

  it.each(calls)("%s: an admin by ADMIN_EMAILS is allowed without a table row", async (_n, call) => {
    session(ADMIN_MAIL, "Boss@Example.com");
    expect(((await call(ADMIN_MAIL)) as { ok: boolean }).ok).toBe(true);
    expect(m.getAppAuthUser).toHaveBeenCalledWith({ withEmail: true });
  });

  it("a non-admin with invalid input still gets forbidden (admin check first)", async () => {
    session(NOBODY, "nobody@example.com");
    expect(await addAdminUserImpl(NOBODY, "nope")).toEqual({ ok: false, error: "forbidden" });
    expect(await removeAdminUserImpl(NOBODY, "nope")).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("admin operations", () => {
  beforeEach(() => session(ADMIN_TABLE, "plain@example.com", [ADMIN_TABLE]));

  it("list maps rows to ISO strings, oldest first", async () => {
    m.prisma.adminUser.findMany.mockResolvedValue([
      { userId: ADMIN_TABLE, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { userId: TARGET, createdAt: null },
    ]);
    expect(await listAdminUsersImpl(ADMIN_TABLE)).toEqual({
      ok: true,
      data: [
        { userId: ADMIN_TABLE, createdAt: "2026-01-01T00:00:00.000Z" },
        { userId: TARGET, createdAt: "" },
      ],
    });
    expect(m.prisma.adminUser.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      select: { userId: true, createdAt: true },
    });
  });

  it("add upserts an existing profile", async () => {
    expect(await addAdminUserImpl(ADMIN_TABLE, TARGET)).toEqual({ ok: true, data: { userId: TARGET } });
    expect(m.prisma.userProfile.findUnique).toHaveBeenCalledWith({ where: { id: TARGET }, select: { id: true } });
    expect(m.prisma.adminUser.upsert).toHaveBeenCalledWith({
      where: { userId: TARGET },
      create: { userId: TARGET },
      update: {},
    });
  });

  it("add: invalid_input for a non-uuid, user_not_found for an unknown profile", async () => {
    expect(await addAdminUserImpl(ADMIN_TABLE, "nope")).toEqual({ ok: false, error: "invalid_input" });
    m.prisma.userProfile.findUnique.mockResolvedValue(null);
    expect(await addAdminUserImpl(ADMIN_TABLE, TARGET)).toEqual({ ok: false, error: "user_not_found" });
    expect(m.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  it("remove deletes the target's row", async () => {
    expect(await removeAdminUserImpl(ADMIN_TABLE, TARGET)).toEqual({ ok: true, data: null });
    expect(m.prisma.adminUser.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET } });
  });

  it("remove: invalid_input for a non-uuid", async () => {
    expect(await removeAdminUserImpl(ADMIN_TABLE, "nope")).toEqual({ ok: false, error: "invalid_input" });
    expect(m.prisma.adminUser.deleteMany).not.toHaveBeenCalled();
  });

  it("an admin cannot remove themselves (table admin, and email admin)", async () => {
    expect(await removeAdminUserImpl(ADMIN_TABLE, ADMIN_TABLE)).toEqual({ ok: false, error: "cannot_remove_self" });
    session(ADMIN_MAIL, "boss@example.com");
    expect(await removeAdminUserImpl(ADMIN_MAIL, ADMIN_MAIL)).toEqual({ ok: false, error: "cannot_remove_self" });
    expect(m.prisma.adminUser.deleteMany).not.toHaveBeenCalled();
  });
});

describe("getAdminAccessImpl (page gate)", () => {
  it("signed out -> unauthorized, no database read", async () => {
    m.getAppAuthUser.mockResolvedValue(null);
    expect(await getAdminAccessImpl()).toBe("unauthorized");
    expect(m.prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it("signed in but not an admin -> forbidden", async () => {
    session(NOBODY, "nobody@example.com");
    expect(await getAdminAccessImpl()).toBe("forbidden");
  });

  it("admin by table row or by ADMIN_EMAILS -> ok", async () => {
    session(ADMIN_TABLE, "x@example.com", [ADMIN_TABLE]);
    expect(await getAdminAccessImpl()).toBe("ok");
    session(ADMIN_MAIL, "Boss@Example.com");
    expect(await getAdminAccessImpl()).toBe("ok");
  });
});
