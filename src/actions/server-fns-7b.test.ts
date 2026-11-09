import { beforeEach, describe, expect, it, vi } from "vitest";

// Wiring test for the integrations / announcements / admin-users wrappers. createServerFn is replaced by a
// recorder so we can check how each server function is declared and simulate how a call settles.
const h = vi.hoisted(() => {
  type Handler = (ctx: { data: unknown; context: { userId: string } }) => unknown;
  interface Registered {
    method: string;
    middleware: unknown[];
    validator?: (v: unknown) => unknown;
    handler: Handler;
    call: (opts?: { data?: unknown }) => Promise<unknown>;
  }
  const state = {
    mode: "ok" as "ok" | "unauthorized" | "unavailable" | "internal",
    registered: [] as Registered[],
  };
  const createServerFn = (opts: { method: string }) => {
    const def: Partial<Registered> = { method: opts.method, middleware: [] };
    const builder = {
      middleware(m: unknown[]) {
        def.middleware = m;
        return builder;
      },
      validator(v: Registered["validator"]) {
        def.validator = v;
        return builder;
      },
      handler(handler: Handler) {
        const call = vi.fn(async (o?: { data?: unknown }) => {
          // Mirrors Start: the auth middleware (when declared) runs first, then the validator, then the handler.
          if (state.mode === "internal") throw new Error("internal_error");
          if ((def.middleware?.length ?? 0) > 0) {
            if (state.mode === "unauthorized") throw new Error("Unauthorized");
            if (state.mode === "unavailable") throw new Error("auth_unavailable");
          }
          const data = def.validator ? def.validator(o?.data) : o?.data;
          return handler({ data, context: { userId: "user-uuid" } });
        });
        Object.assign(def, { handler, call });
        state.registered.push(def as Registered);
        return call;
      },
    };
    return builder;
  };
  return { state, createServerFn };
});

vi.mock("@tanstack/react-start", () => ({ createServerFn: h.createServerFn }));
vi.mock("@/server/auth-middleware", () => ({ authMiddleware: { marker: "authMiddleware" } }));

const implNames = {
  "@/server/integrations-impl": [
    "getOrCreateIcsLink", "revokeIcsLink", "getPushStatus", "getGoogleCalendarStatus",
    "disconnectGoogleCalendar", "syncGoogleCalendar",
  ],
  "@/server/announcements-impl": ["listActiveAnnouncements", "listAdminAnnouncements", "saveAnnouncement", "deleteAnnouncement"],
  "@/server/admin-users-impl": ["listAdminUsers", "addAdminUser", "removeAdminUser"],
};
vi.mock("@/server/integrations-impl", () => mockImpls(["getOrCreateIcsLink", "revokeIcsLink", "getPushStatus", "getGoogleCalendarStatus", "disconnectGoogleCalendar", "syncGoogleCalendar"]));
vi.mock("@/server/announcements-impl", () => mockImpls(["listActiveAnnouncements", "listAdminAnnouncements", "saveAnnouncement", "deleteAnnouncement"]));
vi.mock("@/server/admin-users-impl", () => mockImpls(["listAdminUsers", "addAdminUser", "removeAdminUser"]));
function mockImpls(names: string[]) {
  return Object.fromEntries(
    names.map((n) => [`${n}Impl`, vi.fn(async (...args: unknown[]) => ({ ok: true, data: { impl: n, args } }))]),
  );
}

import * as integrations from "./integrations";
import * as announcements from "./announcements";
import * as adminUsers from "./admin-users";
import * as integrationsImpl from "@/server/integrations-impl";
import * as announcementsImpl from "@/server/announcements-impl";
import * as adminUsersImpl from "@/server/admin-users-impl";

const ID = "44444444-4444-4444-8444-444444444444";
const ann = { titleBn: "a", titleEn: "", bodyBn: "b", bodyEn: "", startAt: "2026-02-01T00:00:00.000Z", endAt: null };

type AnyFn = (...args: unknown[]) => Promise<unknown>;
const mods = { integrations, announcements, adminUsers } as unknown as Record<string, Record<string, AnyFn>>;

// [module, wrapper, args, impl, the args the Impl receives after the userId (none for the public read)]
const authed = [
  ["integrations", "getOrCreateIcsLinkAction", [], "getOrCreateIcsLinkImpl", []],
  ["integrations", "revokeIcsLinkAction", [], "revokeIcsLinkImpl", []],
  ["integrations", "getPushStatusAction", [], "getPushStatusImpl", []],
  ["integrations", "getGoogleCalendarStatusAction", [], "getGoogleCalendarStatusImpl", []],
  ["integrations", "disconnectGoogleCalendarAction", [], "disconnectGoogleCalendarImpl", []],
  ["integrations", "syncGoogleCalendarAction", [], "syncGoogleCalendarImpl", []],
  ["announcements", "listAdminAnnouncementsAction", [], "listAdminAnnouncementsImpl", []],
  ["announcements", "saveAnnouncementAction", [ann], "saveAnnouncementImpl", [ann]],
  ["announcements", "deleteAnnouncementAction", [ID], "deleteAnnouncementImpl", [ID]],
  ["adminUsers", "listAdminUsersAction", [], "listAdminUsersImpl", []],
  ["adminUsers", "addAdminUserAction", [ID], "addAdminUserImpl", [ID]],
  ["adminUsers", "removeAdminUserAction", [ID], "removeAdminUserImpl", [ID]],
] as const;
const implOf = (name: string) => {
  const owner = Object.entries(implNames).find(([, names]) => names.some((n) => `${n}Impl` === name))![0];
  const mod = { "@/server/integrations-impl": integrationsImpl, "@/server/announcements-impl": announcementsImpl, "@/server/admin-users-impl": adminUsersImpl }[owner] as unknown as Record<string, ReturnType<typeof vi.fn>>;
  return mod[name];
};

beforeEach(() => {
  h.state.mode = "ok";
  for (const r of h.state.registered) (r.call as ReturnType<typeof vi.fn>).mockClear();
  for (const names of Object.values(implNames)) for (const n of names) implOf(`${n}Impl`).mockClear();
});

describe("7b server function declarations", () => {
  it("declares 13 POST server functions; only the public announcements read has no authMiddleware", () => {
    expect(Object.values(implNames).flat()).toHaveLength(13);
    expect(h.state.registered).toHaveLength(13);
    const open = h.state.registered.filter((r) => r.middleware.length === 0);
    expect(open).toHaveLength(1);
    expect(open[0].validator).toBeUndefined();
    for (const r of h.state.registered) {
      expect(r.method).toBe("POST");
      if (r !== open[0]) expect(r.middleware).toEqual([{ marker: "authMiddleware" }]);
    }
  });

  it("the unauthenticated function is the one that calls listActiveAnnouncementsImpl", async () => {
    const open = h.state.registered.find((r) => r.middleware.length === 0)!;
    await open.call();
    expect(implOf("listActiveAnnouncementsImpl")).toHaveBeenCalledTimes(1);
  });

  it("admin validators only pass input through (validation and the admin check live in the Impl)", () => {
    const passthrough = h.state.registered.filter((r) => r.validator);
    expect(passthrough.length).toBe(4); // save, delete, add, remove
    for (const r of passthrough) {
      const bad = { not: "valid" };
      expect(r.validator!(bad)).toBe(bad);
    }
  });
});

describe("public announcements read", () => {
  it("works signed out: no unauthorized mapping, the Impl runs", async () => {
    h.state.mode = "unauthorized";
    const res = await announcements.listActiveAnnouncementsAction();
    expect(res).toMatchObject({ ok: true });
    expect(implOf("listActiveAnnouncementsImpl")).toHaveBeenCalledTimes(1);
    expect(implOf("listActiveAnnouncementsImpl").mock.calls[0]).toEqual([]);
  });
});

describe.each(authed)("%s.%s", (mod, name, args, implName, rest) => {
  const wrapper = () => mods[mod][name];

  it("happy path: passes the middleware's userId first, then the input", async () => {
    const res = await wrapper()(...args);
    expect(res).toMatchObject({ ok: true });
    expect(implOf(implName).mock.calls[0]).toEqual(["user-uuid", ...rest]);
  });

  it("signed out: the 401 rejection becomes { ok: false, error: 'unauthorized' } and the Impl never runs", async () => {
    h.state.mode = "unauthorized";
    await expect(wrapper()(...args)).resolves.toEqual({ ok: false, error: "unauthorized" });
    expect(implOf(implName)).not.toHaveBeenCalled();
  });

  it("503 auth_unavailable resolves as a failed result (not a throw into the error boundary)", async () => {
    h.state.mode = "unavailable";
    await expect(wrapper()(...args)).resolves.toEqual({ ok: false, error: "request_failed" });
  });

  it("an internal_error rejection resolves as request_failed, not unauthorized", async () => {
    h.state.mode = "internal";
    await expect(wrapper()(...args)).resolves.toEqual({ ok: false, error: "request_failed" });
  });
});

it("old exports are all still there", () => {
  for (const n of [
    "getOrCreateIcsLinkAction", "revokeIcsLinkAction", "getPushStatusAction", "getGoogleCalendarStatusAction",
    "disconnectGoogleCalendarAction", "syncGoogleCalendarAction",
  ]) expect(typeof integrations[n as keyof typeof integrations]).toBe("function");
  for (const n of ["listActiveAnnouncementsAction", "listAdminAnnouncementsAction", "saveAnnouncementAction", "deleteAnnouncementAction"])
    expect(typeof announcements[n as keyof typeof announcements]).toBe("function");
  for (const n of ["listAdminUsersAction", "addAdminUserAction", "removeAdminUserAction"])
    expect(typeof adminUsers[n as keyof typeof adminUsers]).toBe("function");
});
