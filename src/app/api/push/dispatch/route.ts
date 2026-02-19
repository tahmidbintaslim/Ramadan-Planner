import { NextRequest, NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchPrayerTimes, todayDateString } from "@/lib/prayer-times";

export const dynamic = "force-dynamic";

const DUE_WINDOW_MS = 2 * 60 * 1000;

function parseTime(value: string): { h: number; m: number } | null {
  const [hRaw, mRaw] = value.split(":");
  const h = Number.parseInt(hRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function applyOffset(time: string, offsetMinutes: number): string | null {
  const parsed = parseTime(time);
  if (!parsed) return null;
  const total = parsed.h * 60 + parsed.m + offsetMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function baseTimeForRule(
  type: string,
  prayerTimes: {
    sehri: string;
    iftar: string;
    fajr: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
  },
): string | null {
  switch (type) {
    case "sehri":
      return prayerTimes.sehri;
    case "iftar":
      return prayerTimes.iftar;
    case "fajr":
      return prayerTimes.fajr;
    case "dhuhr":
      return prayerTimes.dhuhr;
    case "asr":
      return prayerTimes.asr;
    case "maghrib":
      return prayerTimes.maghrib;
    case "isha":
      return prayerTimes.isha;
    case "taraweeh":
      return prayerTimes.isha;
    case "tahajjud":
      return "03:00";
    default:
      return null;
  }
}

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

function ensureAuthorized(request: NextRequest): boolean {
  const expected =
    process.env.PUSH_DISPATCH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === expected) return true;

  const auth = request.headers.get("authorization");
  if (!auth) return false;
  return auth === `Bearer ${expected}`;
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

export async function POST(request: NextRequest) {
  if (!ensureAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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

  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;

    const date = todayDateString(user.timezone);
    const timings = await fetchPrayerTimes(
      user.latitude,
      user.longitude,
      date,
      user.timezone,
      user.locationLabel,
    );

    const todayIso = new Date().toLocaleDateString("en-CA", {
      timeZone: user.timezone,
    });

    for (const rule of user.reminderRules) {
      const channels = Array.isArray(rule.channels)
        ? rule.channels.filter((c): c is string => typeof c === "string")
        : [];

      if (!channels.includes("push")) continue;

      const base = baseTimeForRule(rule.type, timings.prayerTimes);
      if (!base) continue;

      const scheduledLocal = applyOffset(base, rule.offsetMinutes);
      if (!scheduledLocal) continue;

      const scheduledAt = fromZonedTime(`${todayIso}T${scheduledLocal}:00`, user.timezone);
      const now = new Date();
      const diff = now.getTime() - scheduledAt.getTime();

      if (diff < 0 || diff > DUE_WINDOW_MS) continue;

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
            ` • ${timings.location}`,
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

  return NextResponse.json({ ok: true, checked, delivered });
}
