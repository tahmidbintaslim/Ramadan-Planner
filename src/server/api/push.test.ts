import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Obvious fakes; never real secrets.
const CRON = "fake-cron-secret-for-tests-0001";
const DISPATCH = "fake-dispatch-secret-for-tests-02";
const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";

const m = vi.hoisted(() => ({
  prisma: {
    userProfile: { findMany: vi.fn() },
    pushDeliveryLog: { create: vi.fn() },
    pushSubscription: { delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  },
  webpush: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
  fetchPrayerTimes: vi.fn(),
  getAppAuthUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("web-push", () => ({ default: m.webpush }));
vi.mock("@/lib/prayer-times", () => ({ fetchPrayerTimes: m.fetchPrayerTimes }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser: m.getAppAuthUser }));

import { handlePushDispatchGet, handlePushDispatchPost } from "./push-dispatch";
import { handlePushSubscribe } from "./push-subscribe";

const URL_D = "https://app.example/api/push/dispatch";
const get = (headers: Record<string, string> = {}) => new Request(URL_D, { headers });
const post = (headers: Record<string, string> = {}) => new Request(URL_D, { method: "POST", headers });

let logs: string[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  logs = [];
  for (const level of ["error", "info", "log", "warn"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(" "));
    });
  }
  vi.stubEnv("CRON_SECRET", CRON);
  vi.stubEnv("PUSH_DISPATCH_SECRET", DISPATCH);
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "fake-public");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "fake-private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
  vi.stubEnv("PUSH_DISPATCH_DEBUG", "1");
  m.prisma.userProfile.findMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

async function expect401(res: Response) {
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
  expect(m.prisma.userProfile.findMany).not.toHaveBeenCalled();
  expect(m.webpush.setVapidDetails).not.toHaveBeenCalled();
}

function expectSecretsNotLogged() {
  const all = logs.join("\n");
  expect(all).not.toContain(CRON);
  expect(all).not.toContain(DISPATCH);
}

describe("GET /api/push/dispatch (Vercel Cron / GitHub Actions)", () => {
  it("401 without a secret", async () => {
    await expect401(await handlePushDispatchGet(get()));
  });

  it("401 with a wrong secret, a non-Bearer scheme, or the secret in x-cron-secret (GET accepts only Bearer CRON_SECRET)", async () => {
    for (const headers of [
      { Authorization: "Bearer wrong" },
      { Authorization: `Bearer ${CRON}x` },
      { Authorization: CRON },
      { Authorization: `Basic ${CRON}` },
      { "x-cron-secret": CRON },
      { Authorization: `Bearer ${DISPATCH}` }, // PUSH_DISPATCH_SECRET is a POST-only credential
    ] as Record<string, string>[]) {
      await expect401(await handlePushDispatchGet(get(headers)));
    }
    expectSecretsNotLogged();
  });

  it("401 when CRON_SECRET is unset or blank, even with an empty Bearer", async () => {
    vi.stubEnv("CRON_SECRET", "   ");
    await expect401(await handlePushDispatchGet(get({ Authorization: "Bearer " })));
    await expect401(await handlePushDispatchGet(get({ Authorization: "Bearer    " })));
  });

  it("200 with Bearer CRON_SECRET: { ok:true, checked, delivered, skippedUsers }", async () => {
    const res = await handlePushDispatchGet(get({ Authorization: `Bearer ${CRON}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: 0, delivered: 0, skippedUsers: 0 });
    expect(m.webpush.setVapidDetails).toHaveBeenCalledWith("mailto:test@example.com", "fake-public", "fake-private");
    expectSecretsNotLogged();
  });
});

describe("POST /api/push/dispatch (manual / external)", () => {
  it("401 without a secret or with a wrong one", async () => {
    await expect401(await handlePushDispatchPost(post()));
    await expect401(await handlePushDispatchPost(post({ "x-cron-secret": "wrong" })));
    await expect401(await handlePushDispatchPost(post({ Authorization: "Bearer wrong" })));
    // With PUSH_DISPATCH_SECRET set, CRON_SECRET is not the POST credential.
    await expect401(await handlePushDispatchPost(post({ "x-cron-secret": CRON })));
    expectSecretsNotLogged();
  });

  it("200 with PUSH_DISPATCH_SECRET via x-cron-secret, and via Bearer", async () => {
    for (const headers of [{ "x-cron-secret": DISPATCH }, { Authorization: `Bearer ${DISPATCH}` }] as Record<string, string>[]) {
      const res = await handlePushDispatchPost(post(headers));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, checked: 0, delivered: 0, skippedUsers: 0 });
    }
  });

  it("falls back to CRON_SECRET when PUSH_DISPATCH_SECRET is unset", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", "");
    expect((await handlePushDispatchPost(post({ "x-cron-secret": CRON }))).status).toBe(200);
  });

  it("401 when neither secret is configured", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    await expect401(await handlePushDispatchPost(post({ "x-cron-secret": "" })));
  });
});

describe("dispatch outcomes", () => {
  const auth = { Authorization: `Bearer ${CRON}` };

  it("500 'Push config missing' without VAPID config (after auth)", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    const res = await handlePushDispatchGet(get(auth));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Push config missing" });
  });

  it("the old NEXT_PUBLIC_VAPID_PUBLIC_KEY name still works", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "old-public");
    expect((await handlePushDispatchGet(get(auth))).status).toBe(200);
    expect(m.webpush.setVapidDetails).toHaveBeenCalledWith("mailto:test@example.com", "old-public", "fake-private");
  });

  it("503 with a fixed message when the DB fails; no DB text in the body; secret not logged", async () => {
    m.prisma.userProfile.findMany.mockRejectedValue(new Error("Can't reach database server at 127.0.0.1:5432"));
    const res = await handlePushDispatchGet(get(auth));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toMatch(/127\.0\.0\.1|database server/);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "Dispatch temporarily unavailable" });
    expectSecretsNotLogged();
  });

  it("sends a due push reminder and records it (logic unchanged)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:01:00.000Z")); // 06:01 in Dhaka
    try {
      m.prisma.userProfile.findMany.mockResolvedValue([
        {
          id: USER,
          timezone: "Asia/Dhaka",
          latitude: 23.8,
          longitude: 90.4,
          locationLabel: "Dhaka",
          reminderRules: [{ id: "r1", type: "fajr", label: null, offsetMinutes: 0, channels: ["push"] }],
          pushSubscriptions: [{ id: "s1", endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } }],
        },
      ]);
      m.fetchPrayerTimes.mockResolvedValue({
        prayerTimes: { sehri: "04:40", iftar: "18:00", fajr: "06:00", dhuhr: "12:00", asr: "15:30", maghrib: "18:00", isha: "19:30" },
      });
      m.prisma.pushDeliveryLog.create.mockResolvedValue({});
      m.webpush.sendNotification.mockResolvedValue({});
      const res = await handlePushDispatchGet(get(auth));
      expect(await res.json()).toEqual({ ok: true, checked: 1, delivered: 1, skippedUsers: 0 });
      expect(m.webpush.sendNotification).toHaveBeenCalledWith(
        { endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } },
        JSON.stringify({ title: "Ramadan Planner", body: "Fajr • Dhaka" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("POST /api/push/subscribe", () => {
  const url = "https://app.example/api/push/subscribe";
  const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };
  const req = (body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body) });

  it("signed out -> 401 { ok:false, error:'Unauthorized' }, no DB writes", async () => {
    const res = await handlePushSubscribe(req(sub), { getUserId: async () => null });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "Unauthorized" });
    expect(m.prisma.pushSubscription.create).not.toHaveBeenCalled();
  });

  it("invalid payload -> 400", async () => {
    const res = await handlePushSubscribe(req({ endpoint: "not-a-url", keys: {} }), { getUserId: async () => USER });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Invalid subscription payload" });
    expect(m.prisma.pushSubscription.create).not.toHaveBeenCalled();
  });

  it("signed in -> replaces the caller's subscription for that endpoint, 200 { ok:true }", async () => {
    const res = await handlePushSubscribe(req(sub), { getUserId: async () => USER });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, endpoint: sub.endpoint } });
    expect(m.prisma.pushSubscription.create).toHaveBeenCalledWith({
      data: { userId: USER, endpoint: sub.endpoint, keys: sub.keys },
    });
  });

  it("default session lookup ensures the profile and skips the email lookup", async () => {
    m.getAppAuthUser.mockResolvedValue({ id: USER, clerkId: "user_123", email: null });
    expect((await handlePushSubscribe(req(sub))).status).toBe(200);
    expect(m.getAppAuthUser).toHaveBeenCalledWith({ ensureProfile: true, withEmail: false });
  });

  it("DB failure -> masked 500", async () => {
    m.prisma.pushSubscription.deleteMany.mockRejectedValue(new Error("Prisma 127.0.0.1:5432"));
    const res = await handlePushSubscribe(req(sub), { getUserId: async () => USER });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal_error" });
  });
});
