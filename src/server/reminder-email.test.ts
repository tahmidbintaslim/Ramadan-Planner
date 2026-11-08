import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/tanstack-react-start/server", () => ({ clerkClient: vi.fn() }));

import {
  EMAIL_DAILY_CAP,
  composeReminderEmail,
  createEmailSender,
  emailIdempotencyKey,
  pushPayload,
  reminderCopy,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "./reminder-email";

const USER = "db99edd8-fa85-5bc2-95ec-a499147bb210";
const RULE = "0b6f3c3e-4c1f-4a52-9a43-1f1b7d2e8a10";
// Sehri ends 04:48 in Dhaka (UTC+6); a -15 reminder fires at 04:33 local = 22:33 UTC the day before.
const SEHRI = {
  type: "sehri",
  label: "",
  offsetMinutes: -15,
  scheduledAt: new Date("2027-02-14T22:33:00.000Z"),
  timeZone: "Asia/Dhaka",
  locationLabel: "ঢাকা, বাংলাদেশ",
};

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://ramadanplanner.tahmid.space");
  vi.stubEnv("REMINDER_UNSUBSCRIBE_SECRET", "fake-unsubscribe-secret-for-tests");
  vi.stubEnv("CRON_SECRET", "");
  vi.stubEnv("RESEND_API_KEY", "re_fake_key_for_tests");
  vi.stubEnv("REMINDER_EMAIL_FROM", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reminder copy", () => {
  it("bn: Bengali digits and day-part word, time of the event (not of the reminder)", () => {
    expect(reminderCopy({ ...SEHRI, locale: "bn" }).title).toBe("সেহরি শেষ হতে আর ১৫ মিনিট — ভোর ৪:৪৮");
  });

  it("en: 12-hour time with AM/PM", () => {
    expect(reminderCopy({ ...SEHRI, locale: "en", locationLabel: "Dhaka" }).title).toBe("Sehri ends in 15 minutes — 4:48 AM");
  });

  it("prayers at the time itself, and a custom label in the place line", () => {
    const copy = reminderCopy({
      ...SEHRI,
      type: "asr",
      label: "Office",
      offsetMinutes: 0,
      scheduledAt: new Date("2027-02-15T09:40:00.000Z"),
      locale: "en",
      locationLabel: "Dhaka",
    });
    expect(copy.title).toBe("Asr — 3:40 PM");
    expect(copy.place).toBe("Office · Dhaka");
  });

  it("push payload uses the same localized title instead of the old 'Ramadan Planner'", () => {
    expect(pushPayload({ ...SEHRI, locale: "bn" })).toEqual({
      title: "সেহরি শেষ হতে আর ১৫ মিনিট — ভোর ৪:৪৮",
      body: "ঢাকা, বাংলাদেশ। ধীরে খান, পানি পান করতে ভুলবেন না।",
    });
  });
});

describe("composeReminderEmail", () => {
  it("bn: subject, HTML and text parts with the app link and a signed unsubscribe link + headers", () => {
    const email = composeReminderEmail({ ...SEHRI, locale: "bn", userId: USER, ruleId: RULE });
    expect(email.subject).toBe("সেহরি শেষ হতে আর ১৫ মিনিট — ভোর ৪:৪৮");
    expect(email.html).toContain('lang="bn"');
    expect(email.html).toContain("https://ramadanplanner.tahmid.space/today");
    expect(email.text).toContain("ঢাকা, বাংলাদেশ");
    expect(email.text).toContain("এই রিমাইন্ডারের ইমেইল বন্ধ করুন");
    const url = unsubscribeUrl(USER, RULE)!;
    expect(url).toMatch(/^https:\/\/ramadanplanner\.tahmid\.space\/api\/reminders\/unsubscribe\?u=/);
    expect(email.text).toContain(url);
    expect(email.headers).toEqual({ "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("en copy, and user text is HTML-escaped", () => {
    const email = composeReminderEmail({
      ...SEHRI,
      locale: "en",
      label: '<script>alert("x")</script>',
      locationLabel: "London",
      userId: USER,
      ruleId: RULE,
    });
    expect(email.subject).toBe("Sehri ends in 15 minutes — 4:48 AM");
    expect(email.html).toContain("Stop emails for this reminder");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("without any secret, links to /reminders and offers no one-click header", () => {
    vi.stubEnv("REMINDER_UNSUBSCRIBE_SECRET", "");
    const email = composeReminderEmail({ ...SEHRI, locale: "en", userId: USER, ruleId: RULE });
    expect(email.headers).toEqual({ "List-Unsubscribe": "<https://ramadanplanner.tahmid.space/reminders>" });
  });
});

describe("unsubscribe token", () => {
  it("verifies only the exact user + rule + secret", () => {
    const token = unsubscribeToken(USER, RULE)!;
    expect(verifyUnsubscribeToken(USER, RULE, token)).toBe(true);
    expect(verifyUnsubscribeToken(USER, RULE, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(verifyUnsubscribeToken(RULE, USER, token)).toBe(false);
    expect(verifyUnsubscribeToken(USER, RULE, "")).toBe(false);
    expect(verifyUnsubscribeToken(USER, RULE, null)).toBe(false);
    vi.stubEnv("REMINDER_UNSUBSCRIBE_SECRET", "another-secret");
    expect(verifyUnsubscribeToken(USER, RULE, token)).toBe(false);
  });

  it("falls back to CRON_SECRET; nothing verifies when no secret is set", () => {
    vi.stubEnv("REMINDER_UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("CRON_SECRET", "fake-cron");
    expect(verifyUnsubscribeToken(USER, RULE, unsubscribeToken(USER, RULE))).toBe(true);
    vi.stubEnv("CRON_SECRET", "");
    expect(unsubscribeToken(USER, RULE)).toBeNull();
    expect(verifyUnsubscribeToken(USER, RULE, "anything")).toBe(false);
  });
});

describe("createEmailSender", () => {
  const compose = () => composeReminderEmail({ ...SEHRI, locale: "en", userId: USER, ruleId: RULE });
  const lookup = vi.fn(async () => new Map([[USER, "person@example.com"]]));
  const ok = () => new Response(JSON.stringify({ id: "e1" }), { status: 200 });

  it("no-op without RESEND_API_KEY: disabled and no request", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sender = createEmailSender({ wanted: new Set([USER]), lookup, gapMs: 0 });
    expect(sender.enabled).toBe(false);
    expect(await sender.send(USER, "k", compose)).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with the key, default from, idempotency key and unsubscribe headers", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const sender = createEmailSender({ wanted: new Set([USER]), lookup, gapMs: 0 });
    const key = emailIdempotencyKey(RULE, SEHRI.scheduledAt);
    expect(await sender.send(USER, key, compose)).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_fake_key_for_tests");
    expect(headers["Idempotency-Key"]).toBe(`reminder-email/${RULE}/2027-02-14T22:33:00.000Z`);
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe("Ramadan Planner <reminders@tahmid.space>");
    expect(body.to).toEqual(["person@example.com"]);
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("the same occurrence always gets the same idempotency key; another occurrence a different one", () => {
    const at = SEHRI.scheduledAt;
    expect(emailIdempotencyKey(RULE, new Date(at.getTime()))).toBe(emailIdempotencyKey(RULE, at));
    expect(emailIdempotencyKey(RULE, new Date(at.getTime() + 86_400_000))).not.toBe(emailIdempotencyKey(RULE, at));
  });

  it("looks recipients up once per run and skips users without a verified email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    lookup.mockClear();
    const sender = createEmailSender({ wanted: new Set([USER, RULE]), lookup, gapMs: 0 });
    expect(await sender.send(RULE, "a", compose)).toBe("no_recipient");
    expect(await sender.send(USER, "b", compose)).toBe("sent");
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it(`stops at the per-run budget (${EMAIL_DAILY_CAP})`, async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const sender = createEmailSender({ wanted: new Set([USER]), lookup, gapMs: 0 });
    for (let i = 0; i < EMAIL_DAILY_CAP; i++) expect(await sender.send(USER, `k${i}`, compose)).toBe("sent");
    expect(await sender.send(USER, "over", compose)).toBe("budget");
    expect(fetchMock).toHaveBeenCalledTimes(EMAIL_DAILY_CAP);
  });

  it("stops when Resend reports the day's usage at the cap, or answers 429", async () => {
    const atCap = vi.fn(async () => new Response("{}", { status: 200, headers: { "x-resend-daily-quota": String(EMAIL_DAILY_CAP) } }));
    vi.stubGlobal("fetch", atCap);
    let sender = createEmailSender({ wanted: new Set([USER]), lookup, gapMs: 0 });
    expect(await sender.send(USER, "a", compose)).toBe("sent");
    expect(await sender.send(USER, "b", compose)).toBe("budget");
    expect(atCap).toHaveBeenCalledTimes(1);

    const limited = vi.fn(async () => new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", limited);
    sender = createEmailSender({ wanted: new Set([USER]), lookup, gapMs: 0 });
    expect(await sender.send(USER, "a", compose)).toBe("budget");
    expect(await sender.send(USER, "b", compose)).toBe("budget");
    expect(limited).toHaveBeenCalledTimes(1);
  });
});
