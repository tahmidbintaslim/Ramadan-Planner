import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_TABLE = "11111111-1111-4111-8111-111111111111";
const ADMIN_MAIL = "22222222-2222-4222-8222-222222222222";
const NOBODY = "33333333-3333-4333-8333-333333333333";
const ID = "44444444-4444-4444-8444-444444444444";

const m = vi.hoisted(() => ({
  prisma: {
    announcement: { findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    adminUser: { findUnique: vi.fn() },
  },
  getAppAuthUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser: m.getAppAuthUser }));

import {
  deleteAnnouncementImpl,
  listActiveAnnouncementsImpl,
  listAdminAnnouncementsImpl,
  saveAnnouncementImpl,
} from "./announcements-impl";

const row = {
  id: ID,
  titleBn: "শিরোনাম",
  titleEn: "Title",
  bodyBn: "বার্তা",
  bodyEn: "Body",
  startAt: new Date("2026-02-01T00:00:00.000Z"),
  endAt: null as Date | null,
};
const dto = {
  id: ID,
  titleBn: "শিরোনাম",
  titleEn: "Title",
  bodyBn: "বার্তা",
  bodyEn: "Body",
  startAt: "2026-02-01T00:00:00.000Z",
  endAt: null,
};
const input = {
  titleBn: "শিরোনাম",
  titleEn: "Title",
  bodyBn: "বার্তা",
  bodyEn: "Body",
  startAt: "2026-02-01T00:00:00.000Z",
  endAt: null,
};

/** Signs `id` in with `email`; `adminRows` lists the user ids that have an AdminUser row. */
function session(id: string, email: string | null, adminRows: string[] = []) {
  m.getAppAuthUser.mockResolvedValue({ id, clerkId: "user_x", email });
  m.prisma.adminUser.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) =>
    adminRows.includes(where.userId) ? { userId: where.userId } : null,
  );
}

beforeEach(() => {
  for (const model of Object.values(m.prisma)) for (const fn of Object.values(model)) fn.mockReset();
  m.getAppAuthUser.mockReset();
  vi.stubEnv("ADMIN_EMAILS", "Boss@Example.com, other@example.com");
  m.prisma.announcement.findMany.mockResolvedValue([row]);
  m.prisma.announcement.create.mockResolvedValue(row);
  m.prisma.announcement.update.mockResolvedValue(row);
  m.prisma.announcement.delete.mockResolvedValue(row);
});

describe("listActiveAnnouncementsImpl (public)", () => {
  it("needs no session: never calls getAppAuthUser or the admin table", async () => {
    const res = await listActiveAnnouncementsImpl();
    expect(res).toEqual({ ok: true, data: [dto] });
    expect(m.getAppAuthUser).not.toHaveBeenCalled();
    expect(m.prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it("filters to started and not-ended announcements, newest first", async () => {
    await listActiveAnnouncementsImpl();
    const arg = m.prisma.announcement.findMany.mock.calls[0][0];
    expect(arg.where.startAt.lte).toBeInstanceOf(Date);
    expect(arg.where.OR).toEqual([{ endAt: null }, { endAt: { gte: arg.where.startAt.lte } }]);
    expect(arg.orderBy).toEqual([{ startAt: "desc" }]);
  });

  it("serializes endAt when set", async () => {
    m.prisma.announcement.findMany.mockResolvedValue([{ ...row, endAt: new Date("2026-03-01T00:00:00.000Z") }]);
    const res = await listActiveAnnouncementsImpl();
    expect(res).toEqual({ ok: true, data: [{ ...dto, endAt: "2026-03-01T00:00:00.000Z" }] });
  });
});

describe("admin gate on every admin function", () => {
  const calls: Array<[string, (u: string) => Promise<unknown>]> = [
    ["listAdmin", (u) => listAdminAnnouncementsImpl(u)],
    ["save", (u) => saveAnnouncementImpl(u, input)],
    ["delete", (u) => deleteAnnouncementImpl(u, ID)],
  ];

  it.each(calls)("%s: a non-admin is forbidden and nothing is read or written", async (_n, call) => {
    session(NOBODY, "nobody@example.com", [ADMIN_TABLE]);
    expect(await call(NOBODY)).toEqual({ ok: false, error: "forbidden" });
    for (const fn of Object.values(m.prisma.announcement)) expect(fn).not.toHaveBeenCalled();
  });

  it.each(calls)("%s: a non-admin with INVALID input still gets forbidden (admin check first)", async () => {
    session(NOBODY, "nobody@example.com");
    expect(await saveAnnouncementImpl(NOBODY, { nope: 1 })).toEqual({ ok: false, error: "forbidden" });
    expect(await deleteAnnouncementImpl(NOBODY, "not-a-uuid")).toEqual({ ok: false, error: "forbidden" });
  });

  it.each(calls)("%s: no session, or a session for another user, is unauthorized", async (_n, call) => {
    m.getAppAuthUser.mockResolvedValue(null);
    expect(await call(ADMIN_TABLE)).toEqual({ ok: false, error: "unauthorized" });
    session(ADMIN_TABLE, "x@example.com", [ADMIN_TABLE]);
    expect(await call(NOBODY)).toEqual({ ok: false, error: "unauthorized" });
    for (const fn of Object.values(m.prisma.announcement)) expect(fn).not.toHaveBeenCalled();
  });

  it.each(calls)("%s: a signed-in user without an email is unauthorized (old rule), even with a table row", async (_n, call) => {
    session(ADMIN_TABLE, null, [ADMIN_TABLE]);
    expect(await call(ADMIN_TABLE)).toEqual({ ok: false, error: "unauthorized" });
  });

  it.each(calls)("%s: an admin by AdminUser table row is allowed", async (_n, call) => {
    session(ADMIN_TABLE, "plain@example.com", [ADMIN_TABLE]);
    const res = (await call(ADMIN_TABLE)) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(m.prisma.adminUser.findUnique).toHaveBeenCalledWith({
      where: { userId: ADMIN_TABLE },
      select: { userId: true },
    });
  });

  it.each(calls)("%s: an admin by ADMIN_EMAILS (case-insensitive) is allowed without a table row", async (_n, call) => {
    session(ADMIN_MAIL, "boss@EXAMPLE.com");
    const res = (await call(ADMIN_MAIL)) as { ok: boolean };
    expect(res.ok).toBe(true);
  });

  it("the email is fetched with getAppAuthUser({ withEmail: true })", async () => {
    session(ADMIN_MAIL, "boss@example.com");
    await listAdminAnnouncementsImpl(ADMIN_MAIL);
    expect(m.getAppAuthUser).toHaveBeenCalledWith({ withEmail: true });
  });
});

describe("admin operations", () => {
  beforeEach(() => session(ADMIN_TABLE, "plain@example.com", [ADMIN_TABLE]));

  it("listAdmin returns every announcement", async () => {
    expect(await listAdminAnnouncementsImpl(ADMIN_TABLE)).toEqual({ ok: true, data: [dto] });
    expect(m.prisma.announcement.findMany).toHaveBeenCalledWith({ orderBy: [{ startAt: "desc" }] });
  });

  it("save without id creates; with id updates that row", async () => {
    expect(await saveAnnouncementImpl(ADMIN_TABLE, input)).toEqual({ ok: true, data: dto });
    expect(m.prisma.announcement.create).toHaveBeenCalledWith({
      data: { ...input, startAt: new Date(input.startAt), endAt: null },
    });
    await saveAnnouncementImpl(ADMIN_TABLE, { ...input, id: ID, endAt: "2026-03-01T00:00:00.000Z" });
    expect(m.prisma.announcement.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { ...input, startAt: new Date(input.startAt), endAt: new Date("2026-03-01T00:00:00.000Z") },
    });
  });

  it("save trims text and rejects bad input with invalid_input", async () => {
    await saveAnnouncementImpl(ADMIN_TABLE, { ...input, titleBn: "  hi  " });
    expect(m.prisma.announcement.create.mock.calls[0][0].data.titleBn).toBe("hi");
    m.prisma.announcement.create.mockClear();
    for (const bad of [
      null,
      { ...input, titleBn: "   " },
      { ...input, titleBn: "x".repeat(201) },
      { ...input, startAt: "yesterday" },
      { ...input, id: "nope" },
      { ...input, endAt: undefined },
    ]) {
      expect(await saveAnnouncementImpl(ADMIN_TABLE, bad)).toEqual({ ok: false, error: "invalid_input" });
    }
    expect(m.prisma.announcement.create).not.toHaveBeenCalled();
    expect(m.prisma.announcement.update).not.toHaveBeenCalled();
  });

  it("delete removes by id; a non-uuid is invalid_input", async () => {
    expect(await deleteAnnouncementImpl(ADMIN_TABLE, ID)).toEqual({ ok: true, data: null });
    expect(m.prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: ID } });
    m.prisma.announcement.delete.mockClear();
    expect(await deleteAnnouncementImpl(ADMIN_TABLE, "x")).toEqual({ ok: false, error: "invalid_input" });
    expect(m.prisma.announcement.delete).not.toHaveBeenCalled();
  });
});
