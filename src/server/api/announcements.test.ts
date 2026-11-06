import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the REAL announcements Impl (admin check included) under the route handlers; only Prisma and the Clerk
// session lookup are faked. The handler's own session lookup is injected (deps.getUserId).
const ADMIN = "11111111-1111-4111-8111-111111111111";
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
// getCallerWithEmail sets the status before throwing auth_unavailable; there is no h3 event in a unit test.
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus: vi.fn() }));

import {
  handleAnnouncementDelete,
  handleAnnouncementPatch,
  handleAnnouncementsGet,
  handleAnnouncementsPost,
} from "./announcements";

const row = {
  id: ID,
  titleBn: "শিরোনাম",
  titleEn: "Title",
  bodyBn: "বার্তা",
  bodyEn: "Body",
  startAt: new Date("2026-02-01T00:00:00.000Z"),
  endAt: null as Date | null,
};
const dto = { ...row, startAt: "2026-02-01T00:00:00.000Z", endAt: null };
const input = {
  titleBn: "শিরোনাম",
  titleEn: "Title",
  bodyBn: "বার্তা",
  bodyEn: "Body",
  startAt: "2026-02-01T00:00:00.000Z",
  endAt: null,
};

const URL_BASE = "https://app.example/api/announcements";
const post = (body: unknown) =>
  new Request(URL_BASE, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const patch = (body: unknown) => new Request(`${URL_BASE}/${ID}`, { method: "PATCH", body: JSON.stringify(body) });
const del = () => new Request(`${URL_BASE}/${ID}`, { method: "DELETE" });

const signedOut = { getUserId: vi.fn(async () => null) };
const as = (id: string) => ({ getUserId: vi.fn(async () => id) });

function sessionFor(id: string, email: string) {
  m.getAppAuthUser.mockResolvedValue({ id, clerkId: "user_x", email, emailVerified: true });
}

function expectNoWrites() {
  expect(m.prisma.announcement.create).not.toHaveBeenCalled();
  expect(m.prisma.announcement.update).not.toHaveBeenCalled();
  expect(m.prisma.announcement.delete).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", "boss@example.com");
  m.prisma.adminUser.findUnique.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/announcements (public)", () => {
  it("works signed out: 200 { ok, data } with no Cache-Control (as before) and no session lookup", async () => {
    m.prisma.announcement.findMany.mockResolvedValue([row]);
    const res = await handleAnnouncementsGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBeNull();
    expect(await res.json()).toEqual({ ok: true, data: [dto] });
    expect(m.getAppAuthUser).not.toHaveBeenCalled();
  });

  it("DB failure: 503 no-store with the fixed body, nothing leaked", async () => {
    m.prisma.announcement.findMany.mockRejectedValue(new Error("Can't reach database server at 127.0.0.1:5432"));
    const res = await handleAnnouncementsGet();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = await res.text();
    expect(text).not.toMatch(/127\.0\.0\.1|5432|database server/);
    expect(JSON.parse(text)).toEqual({
      ok: false,
      error: { code: "unavailable", message: "Announcements are temporarily unavailable" },
    });
  });
});

describe("POST /api/announcements", () => {
  it("signed out -> 401 { ok:false, error:'unauthorized' }, no DB access", async () => {
    // A session that would pass the Impl's own check: the handler must stop before reaching it.
    sessionFor(ADMIN, "boss@example.com");
    const res = await handleAnnouncementsPost(post(input), signedOut);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(m.getAppAuthUser).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("signed-in non-admin -> 403 forbidden, no writes", async () => {
    sessionFor(NOBODY, "nobody@example.com");
    const res = await handleAnnouncementsPost(post(input), as(NOBODY));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "forbidden" });
    expectNoWrites();
  });

  it("non-admin with invalid input is still 403 (admin check before validation, as before)", async () => {
    sessionFor(NOBODY, "nobody@example.com");
    const res = await handleAnnouncementsPost(post({ titleBn: "" }), as(NOBODY));
    expect(res.status).toBe(403);
  });

  it("admin -> 200 { ok:true, data } and creates the row", async () => {
    sessionFor(ADMIN, "Boss@Example.com");
    m.prisma.announcement.create.mockResolvedValue(row);
    const res = await handleAnnouncementsPost(post(input), as(ADMIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: dto });
    expect(m.prisma.announcement.create).toHaveBeenCalledTimes(1);
  });

  it("admin with invalid or non-JSON body -> 400 invalid_input", async () => {
    sessionFor(ADMIN, "boss@example.com");
    for (const body of [{ titleBn: "" }, "not json"]) {
      const res = await handleAnnouncementsPost(post(body), as(ADMIN));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, error: "invalid_input" });
    }
    expectNoWrites();
  });

  it("the session must match the handler's user id (Impl re-checks it)", async () => {
    sessionFor(NOBODY, "boss@example.com");
    const res = await handleAnnouncementsPost(post(input), as(ADMIN));
    expect(res.status).toBe(401);
    expectNoWrites();
  });

  it("an auth-backend failure is 503 auth_unavailable, with no backend text", async () => {
    m.getAppAuthUser.mockRejectedValue(new Error("clerk sk_test_FAKE exploded"));
    const res = await handleAnnouncementsPost(post(input), as(ADMIN));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toMatch(/clerk|sk_test/);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "auth_unavailable" });
  });

  it("an unexpected DB failure is a masked 500", async () => {
    sessionFor(ADMIN, "boss@example.com");
    m.prisma.announcement.create.mockRejectedValue(new Error("PrismaClientKnownRequestError 127.0.0.1:5432"));
    const res = await handleAnnouncementsPost(post(input), as(ADMIN));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/prisma|127\.0\.0\.1/i);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "internal_error" });
  });
});

describe("PATCH /api/announcements/$id", () => {
  it("signed out 401, non-admin 403, admin 200 updating the id from the URL", async () => {
    sessionFor(ADMIN, "boss@example.com");
    expect((await handleAnnouncementPatch(patch(input), ID, signedOut)).status).toBe(401);
    expect(m.getAppAuthUser).not.toHaveBeenCalled();

    sessionFor(NOBODY, "nobody@example.com");
    const forbidden = await handleAnnouncementPatch(patch(input), ID, as(NOBODY));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ ok: false, error: "forbidden" });
    expectNoWrites();

    sessionFor(ADMIN, "boss@example.com");
    m.prisma.announcement.update.mockResolvedValue(row);
    const res = await handleAnnouncementPatch(patch({ ...input, id: "ignored-body-id" }), ID, as(ADMIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: dto });
    expect(m.prisma.announcement.update.mock.calls[0][0].where).toEqual({ id: ID });
  });

  it("table admin (no ADMIN_EMAILS match) is allowed", async () => {
    sessionFor(ADMIN, "other@example.com");
    m.prisma.adminUser.findUnique.mockResolvedValue({ userId: ADMIN });
    m.prisma.announcement.update.mockResolvedValue(row);
    expect((await handleAnnouncementPatch(patch(input), ID, as(ADMIN))).status).toBe(200);
  });

  it("bad id -> 400 invalid_input", async () => {
    sessionFor(ADMIN, "boss@example.com");
    const res = await handleAnnouncementPatch(patch(input), "nope", as(ADMIN));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_input" });
  });
});

describe("DELETE /api/announcements/$id", () => {
  it("signed out 401, non-admin 403, admin 200 { ok:true }", async () => {
    sessionFor(ADMIN, "boss@example.com");
    const out = await handleAnnouncementDelete(del(), ID, signedOut);
    expect(out.status).toBe(401);
    expect(m.getAppAuthUser).not.toHaveBeenCalled();
    expectNoWrites();
    expect(await out.json()).toEqual({ ok: false, error: "unauthorized" });

    sessionFor(NOBODY, "nobody@example.com");
    expect((await handleAnnouncementDelete(del(), ID, as(NOBODY))).status).toBe(403);
    expectNoWrites();

    sessionFor(ADMIN, "boss@example.com");
    m.prisma.announcement.delete.mockResolvedValue(row);
    const res = await handleAnnouncementDelete(del(), ID, as(ADMIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: ID } });
  });

  it("bad id -> 400", async () => {
    sessionFor(ADMIN, "boss@example.com");
    expect((await handleAnnouncementDelete(del(), "nope", as(ADMIN))).status).toBe(400);
    expectNoWrites();
  });
});

describe("default session lookup", () => {
  it("uses the Clerk session (getAppAuthUser) when no deps are passed: signed out -> 401", async () => {
    m.getAppAuthUser.mockResolvedValue(null);
    const res = await handleAnnouncementsPost(post(input));
    expect(res.status).toBe(401);
    expect(m.getAppAuthUser).toHaveBeenCalled();
  });
});
