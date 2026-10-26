import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPrayerTimes } from "@/lib/prayer-times";
import {
  dueLocalDates,
  dueOccurrenceForRule,
  hasBearerSecret,
  secretMatches,
  toAlAdhanDate,
  type DayPrayerTimes,
} from "@/lib/push-schedule";

export const dynamic = "force-dynamic";

function displayName(type: string): string {
  switch (type) {
    case "sehri":
      return "Sehri";
    case "iftar":
      return "Iftar";
    case "fajr":
      return "Fajr";
    case "dhuhr":
      return "Dhuhr";
    case "asr":
      return "Asr";
    case "maghrib":
      return "Maghrib";
    case "isha":
      return "Isha";
    case "taraweeh":
      return "Taraweeh";
    case "tahajjud":
      return "Tahajjud";
    default:
      return "Reminder";
  }
}

function isUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// POST keeps its original contract for manual or external callers:
// PUSH_DISPATCH_SECRET (or CRON_SECRET) as `x-cron-secret` or a Bearer token.
function ensureAuthorized(request: NextRequest): boolean {
  const expected =
    process.env.PUSH_DISPATCH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  if (secretMatches(request.headers.get("x-cron-secret"), expected)) return true;

  return hasBearerSecret(request.headers.get("authorization"), expected);
}

function configureWebPush(): void {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Missing VAPID configuration");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function dispatchDueReminders(now: Date) {
  const users = await prisma.userProfile.findMany({
    select: {
      id: true,
      timezone: true,
      latitude: true,
      longitude: true,
      locationLabel: true,
      reminderRules: {
        where: { enabled: true },
        select: {
          id: true,
          type: true,
          label: true,
          offsetMinutes: true,
          channels: true,
        },
      },
      pushSubscriptions: {
        select: {
          id: true,
          endpoint: true,
          keys: true,
        },
      },
    },
  });

  let delivered = 0;
  let checked = 0;
  let skippedUsers = 0;

  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;

    const pushRules = user.reminderRules.filter((rule) => {
      const channels = Array.isArray(rule.channels) ? rule.channels : [];
      return channels.includes("push");
    });
    if (pushRules.length === 0) continue;

    // Usually one local date; two just after local midnight. Each date gets
    // its own prayer times (see dueOccurrenceForRule).
    const days: DayPrayerTimes[] = [];
    for (const day of dueLocalDates(user.timezone, now)) {
      try {
        const timings = await fetchPrayerTimes(
          user.latitude,
          user.longitude,
          toAlAdhanDate(day),
          user.timezone,
          user.locationLabel,
        );
        days.push({ day, prayerTimes: timings.prayerTimes });
      } catch {
        // One timing lookup failing must not block everyone else.
      }
    }
    if (days.length === 0) {
      skippedUsers += 1;
      continue;
    }

    for (const rule of pushRules) {
      const due = dueOccurrenceForRule(rule, days, user.timezone, now);
      if (!due) continue;
      const { scheduledAt } = due;

      checked += 1;

      for (const subscription of user.pushSubscriptions) {
        try {
          await prisma.pushDeliveryLog.create({
            data: {
              userId: user.id,
              subscriptionId: subscription.id,
              ruleId: rule.id,
              triggerType: rule.type,
              scheduledFor: scheduledAt,
            },
          });
        } catch (error) {
          if (isUniqueError(error)) {
            // Already sent by an earlier, overlapping run.
            continue;
          }
          throw error;
        }

        const pushKeys = subscription.keys as Record<string, unknown>;
        const p256dh = typeof pushKeys.p256dh === "string" ? pushKeys.p256dh : "";
        const auth = typeof pushKeys.auth === "string" ? pushKeys.auth : "";
        if (!p256dh || !auth) continue;

        const payload = JSON.stringify({
          title: "Ramadan Planner",
          body:
            (rule.label?.trim() || displayName(rule.type)) +
            ` • ${user.locationLabel}`,
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh, auth },
            },
            payload,
          );
          delivered += 1;
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : 0;

          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } });
          }
        }
      }
    }
  }

  return { checked, delivered, skippedUsers };
}

async function runDispatch(): Promise<NextResponse> {
  if (process.env.PUSH_DISPATCH_DEBUG === "1") {
    const hasPublicKey = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
    const hasPrivateKey = Boolean(process.env.VAPID_PRIVATE_KEY?.trim());
    const hasSubject = Boolean(process.env.VAPID_SUBJECT?.trim());
    console.info(
      `[push/dispatch] VAPID config presence - public: ${hasPublicKey}, private: ${hasPrivateKey}, subject: ${hasSubject}`,
    );
  }

  try {
    configureWebPush();
  } catch {
    return NextResponse.json({ ok: false, error: "Push config missing" }, { status: 500 });
  }

  try {
    const result = await dispatchDueReminders(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[push/dispatch] dispatch failed", error);
    return NextResponse.json(
      { ok: false, error: "Dispatch temporarily unavailable" },
      { status: 503 },
    );
  }
}

// Scheduler entry point (GitHub Actions cron, Vercel Cron). Both send
// `Authorization: Bearer <CRON_SECRET>`; nothing else is accepted on GET.
export async function GET(request: NextRequest) {
  if (!hasBearerSecret(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runDispatch();
}

export async function POST(request: NextRequest) {
  if (!ensureAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return runDispatch();
}
