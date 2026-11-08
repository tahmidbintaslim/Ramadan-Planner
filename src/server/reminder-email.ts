// Server-only: reminder copy (push and email), the email channel's Resend sender, and signed unsubscribe links.
// Email is a no-op unless RESEND_API_KEY is set. Email addresses are never logged.
import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/tanstack-react-start/server";
import { clerkIdToUuid } from "@/lib/auth/uuid";
import { clockParts, joinClockParts, wallClock } from "@/lib/clock-format";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { getSiteUrl } from "@/server/site-url";
import { CANONICAL_APP_URL } from "@/server/api/http";

export type ReminderLocale = "bn" | "en";

/** Resend free tier is 100/day and 3,000/month; stop well before the daily limit. */
export const EMAIL_DAILY_CAP = 90;
/** Resend's default API rate limit is a few requests per second; pace sends to stay under it. */
const SEND_GAP_MS = 550;
const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Ramadan Planner <reminders@tahmid.space>";

const NAMES: Record<ReminderLocale, Record<string, string>> = {
  bn: {
    sehri: "সেহরি", iftar: "ইফতার", fajr: "ফজর", dhuhr: "যোহর", asr: "আসর", maghrib: "মাগরিব",
    isha: "ইশা", taraweeh: "তারাবি", tahajjud: "তাহাজ্জুদ",
  },
  en: {
    sehri: "Sehri", iftar: "Iftar", fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib",
    isha: "Isha", taraweeh: "Taraweeh", tahajjud: "Tahajjud",
  },
};

export function reminderLocale(raw: unknown): ReminderLocale {
  return raw === "en" ? "en" : "bn";
}

export interface ReminderCopyInput {
  type: string;
  label?: string | null;
  offsetMinutes: number;
  /** When the reminder fires (event time + offset). */
  scheduledAt: Date;
  timeZone: string;
  locationLabel: string;
  locale: ReminderLocale;
}

/** Title ("সেহরি শেষ হতে আর ১৫ মিনিট — ভোর ৪:৪৮" / "Sehri ends in 15 minutes — 4:48 AM"), place line and one warm line. */
export function reminderCopy(input: ReminderCopyInput): { title: string; place: string; warm: string } {
  const { type, locale } = input;
  const bn = locale === "bn";
  const eventAt = new Date(input.scheduledAt.getTime() - input.offsetMinutes * 60_000);
  const { hour, minute } = wallClock(eventAt, input.timeZone);
  const time = joinClockParts(clockParts(hour, minute, locale));
  const name = NAMES[locale][type] ?? (bn ? "রিমাইন্ডার" : "Reminder");
  const before = -input.offsetMinutes; // minutes before the event; <= 0 means at or after it
  const n = formatLocalizedNumber(before, locale);
  const mins = before === 1 ? "minute" : "minutes";

  let title: string;
  if (before > 0) {
    if (type === "sehri") title = bn ? `সেহরি শেষ হতে আর ${n} মিনিট — ${time}` : `Sehri ends in ${n} ${mins} — ${time}`;
    else if (type === "iftar") title = bn ? `ইফতারের আর ${n} মিনিট — ${time}` : `Iftar in ${n} ${mins} — ${time}`;
    else title = bn ? `${name} শুরু হতে আর ${n} মিনিট — ${time}` : `${name} in ${n} ${mins} — ${time}`;
  } else if (type === "sehri") title = bn ? `সেহরির শেষ সময় — ${time}` : `Sehri ends at ${time}`;
  else if (type === "iftar") title = bn ? `ইফতারের সময় — ${time}` : `It's time for iftar — ${time}`;
  else title = `${name} — ${time}`;

  const label = input.label?.trim();
  const place = label ? `${label} · ${input.locationLabel}` : input.locationLabel;

  let warm: string;
  if (type === "sehri") warm = bn ? "ধীরে খান, পানি পান করতে ভুলবেন না।" : "Eat calmly and don't forget water.";
  else if (type === "iftar") warm = bn ? "নিজের জন্য, প্রিয়জনদের জন্য দোয়া করুন।" : "A good moment to make dua for yourself and those you love.";
  else warm = bn ? "একটু থামুন, নামাজটা পড়ে নিন।" : "Take a moment to pray.";

  return { title, place, warm };
}

/** Push payload in the user's language: the moment and time as the title, place and a warm line as the body. */
export function pushPayload(input: ReminderCopyInput): { title: string; body: string } {
  const { title, place, warm } = reminderCopy(input);
  return { title, body: `${place}${input.locale === "bn" ? "।" : "."} ${warm}` };
}

// ── Unsubscribe links ───────────────────────────────────

function unsubscribeSecret(): string | undefined {
  // CRON_SECRET is always set where the dispatcher runs; a dedicated secret can replace it.
  return process.env.REMINDER_UNSUBSCRIBE_SECRET?.trim() || process.env.CRON_SECRET?.trim() || undefined;
}

export function unsubscribeToken(userId: string, ruleId: string, secret = unsubscribeSecret()): string | null {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`reminder-email-unsubscribe:${userId}:${ruleId}`).digest("base64url");
}

export function verifyUnsubscribeToken(userId: string, ruleId: string, token: string | null | undefined): boolean {
  const expected = unsubscribeToken(userId, ruleId);
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function appUrl(): string {
  return getSiteUrl() || CANONICAL_APP_URL;
}

/** Signed one-click link, or null when no secret is configured. */
export function unsubscribeUrl(userId: string, ruleId: string): string | null {
  const token = unsubscribeToken(userId, ruleId);
  if (!token) return null;
  const params = new URLSearchParams({ u: userId, r: ruleId, t: token });
  return `${appUrl()}/api/reminders/unsubscribe?${params}`;
}

// ── Email composition ───────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface ReminderEmail {
  subject: string;
  html: string;
  text: string;
  /** List-Unsubscribe headers for Resend. */
  headers: Record<string, string>;
}

export function composeReminderEmail(input: ReminderCopyInput & { userId: string; ruleId: string }): ReminderEmail {
  const bn = input.locale === "bn";
  const { title, place, warm } = reminderCopy(input);
  const base = appUrl();
  const open = `${base}/today`;
  const signed = unsubscribeUrl(input.userId, input.ruleId);
  const stopUrl = signed ?? `${base}/reminders`;
  const openLabel = bn ? "অ্যাপ খুলুন" : "Open Ramadan Planner";
  const why = bn
    ? "রমজান প্ল্যানারে এই রিমাইন্ডারের জন্য ইমেইল চালু করেছেন বলে এটি পেয়েছেন।"
    : "You're getting this because you turned on email for this reminder in Ramadan Planner.";
  const stop = bn ? "এই রিমাইন্ডারের ইমেইল বন্ধ করুন" : "Stop emails for this reminder";

  const html = `<!doctype html><html lang="${input.locale}"><body style="margin:0;background:#f6f4ef">
<div style="max-width:480px;margin:0 auto;padding:24px;font-family:'Noto Sans Bengali','Hind Siliguri',Arial,sans-serif;color:#1f2a24;line-height:1.6">
<p style="margin:0 0 8px;font-size:20px;font-weight:600">${escapeHtml(title)}</p>
<p style="margin:0 0 16px;color:#4b5a52">${escapeHtml(place)}</p>
<p style="margin:0 0 24px">${escapeHtml(warm)}</p>
<p style="margin:0 0 32px"><a href="${escapeHtml(open)}" style="display:inline-block;padding:12px 20px;background:#1f6f54;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(openLabel)}</a></p>
<p style="margin:0;font-size:12px;color:#6b776f">${escapeHtml(why)} <a href="${escapeHtml(stopUrl)}" style="color:#6b776f">${escapeHtml(stop)}</a></p>
</div></body></html>`;

  const text = `${title}\n${place}\n\n${warm}\n\n${openLabel}: ${open}\n\n${why}\n${stop}: ${stopUrl}\n`;

  const headers: Record<string, string> = { "List-Unsubscribe": `<${stopUrl}>` };
  if (signed) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return { subject: title, html, text, headers };
}

// ── Sending ─────────────────────────────────────────────

export type EmailResult = "sent" | "no_recipient" | "budget" | "failed";

/** Verified primary email per profile id (the Clerk-id UUID), for the profiles in `wanted`. */
async function loadVerifiedEmails(wanted: Set<string>): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const client = clerkClient();
  // shortcut: profiles store only a hash of the Clerk id, so the user list is scanned once per run (only when an
  // email is due); fine for a few thousand users, store the Clerk id on the profile when that gets slow.
  for (let offset = 0; offset < 50_000 && found.size < wanted.size; offset += 500) {
    const page = await client.users.getUserList({ limit: 500, offset });
    for (const user of page.data) {
      const id = clerkIdToUuid(user.id);
      if (!wanted.has(id)) continue;
      const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
      if (primary?.emailAddress && primary.verification?.status === "verified") found.set(id, primary.emailAddress);
    }
    if (page.data.length < 500) break;
  }
  return found;
}

/**
 * One per dispatch run. Holds the run's budget, the recipient cache and the pacing between sends.
 * `wanted` is every profile id with an email rule; recipients are looked up once, on the first due email.
 */
export function createEmailSender(options: {
  wanted: Set<string>;
  lookup?: (wanted: Set<string>) => Promise<Map<string, string>>;
  gapMs?: number;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REMINDER_EMAIL_FROM?.trim() || DEFAULT_FROM;
  const gapMs = options.gapMs ?? SEND_GAP_MS;
  let recipients: Promise<Map<string, string>> | null = null;
  let sent = 0;
  let exhausted = false;
  let lastSendAt = 0;

  async function send(
    userId: string,
    idempotencyKey: string,
    compose: () => ReminderEmail,
  ): Promise<EmailResult> {
    if (!apiKey) return "failed";
    if (exhausted || sent >= EMAIL_DAILY_CAP) return "budget";

    recipients ??= (options.lookup ?? loadVerifiedEmails)(options.wanted);
    const to = (await recipients).get(userId);
    if (!to) return "no_recipient";

    const wait = lastSendAt + gapMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSendAt = Date.now();

    const email = compose();
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend keeps a key for 24 h: an overlapping cron run that sees the same occurrence gets the first
        // response back instead of a second email.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text, headers: email.headers }),
    });

    if (res.status === 429) {
      // Daily/monthly quota or rate limit: stop for this run rather than hammering the API.
      exhausted = true;
      return "budget";
    }
    if (!res.ok) return "failed";
    sent += 1;
    // Resend reports the day's usage in this header; stop at our cap across runs when it is present.
    const usedToday = Number(res.headers.get("x-resend-daily-quota"));
    if (Number.isFinite(usedToday) && usedToday >= EMAIL_DAILY_CAP) exhausted = true;
    return "sent";
  }

  return { enabled: Boolean(apiKey), send, sentCount: () => sent };
}

/** Idempotency key for one occurrence of one rule (same uniqueness as push_delivery_logs: rule + instant). */
export function emailIdempotencyKey(ruleId: string, scheduledAt: Date): string {
  return `reminder-email/${ruleId}/${scheduledAt.toISOString()}`;
}
