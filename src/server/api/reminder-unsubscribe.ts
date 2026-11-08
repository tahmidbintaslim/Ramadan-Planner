// Server-only handler for GET/POST /api/reminders/unsubscribe?u=<profile id>&r=<rule id>&t=<HMAC>.
// The signed link from a reminder email; no session needed. GET only shows a confirm button (mail scanners
// prefetch links); POST (the button, or a mail client's RFC 8058 one-click) removes "email" from that rule.
// Exempt from the CSRF check in src/start.ts because mail clients POST it cross-site.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/server/reminder-email";
import { guarded } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(status: number, bn: string, en: string, form = ""): Response {
  const html = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ramadan Planner</title></head>
<body style="margin:0;background:#f6f4ef;font-family:'Noto Sans Bengali',Arial,sans-serif;color:#1f2a24;line-height:1.6">
<main style="max-width:480px;margin:0 auto;padding:32px 16px"><p style="font-size:18px;margin:0 0 4px">${bn}</p><p style="margin:0 0 24px;color:#4b5a52">${en}</p>${form}
<p style="margin-top:24px"><a href="/reminders" style="color:#1f6f54">রিমাইন্ডার সেটিংস / Reminder settings</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function parse(request: Request): { userId: string; ruleId: string } | null {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const ruleId = url.searchParams.get("r") ?? "";
  if (!UUID.test(userId) || !UUID.test(ruleId)) return null;
  return verifyUnsubscribeToken(userId, ruleId, url.searchParams.get("t")) ? { userId, ruleId } : null;
}

const invalid = () => page(400, "লিংকটি আর কাজ করছে না।", "This link is no longer valid.");

export function handleReminderUnsubscribeGet(request: Request): Promise<Response> {
  return guarded("api/reminders/unsubscribe", async () => {
    if (!parse(request)) return invalid();
    // Posts back to the same URL (same signed query string).
    const form = `<form method="post"><button type="submit" style="min-height:44px;padding:10px 20px;border:0;border-radius:8px;background:#1f6f54;color:#fff;font-size:16px">ইমেইল বন্ধ করুন / Stop emails</button></form>`;
    return page(200, "এই রিমাইন্ডারের ইমেইল বন্ধ করবেন?", "Stop emails for this reminder?", form);
  });
}

export function handleReminderUnsubscribePost(request: Request): Promise<Response> {
  return guarded("api/reminders/unsubscribe", async () => {
    const target = parse(request);
    if (!target) return invalid();
    const rule = await prisma.reminderRule.findFirst({
      where: { id: target.ruleId, userId: target.userId },
      select: { channels: true },
    });
    if (rule && Array.isArray(rule.channels) && rule.channels.includes("email")) {
      const channels = rule.channels.filter((c) => c !== "email");
      await prisma.reminderRule.update({
        where: { id: target.ruleId, userId: target.userId },
        // A rule with no channel left is turned off rather than left empty and "on".
        data: { channels, ...(channels.length === 0 ? { enabled: false } : {}), updatedAt: new Date() },
      });
    }
    return page(200, "এই রিমাইন্ডারের ইমেইল বন্ধ হয়েছে।", "Emails for this reminder are off.");
  });
}
