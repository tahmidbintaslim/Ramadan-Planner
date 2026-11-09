// Server-only: the numbers on /admin (Figma page 15, overview v1), from existing tables plus usage_events.
// Admin rights are checked here on every call. Days are Asia/Dhaka calendar days. Read-only.
import "@tanstack/react-start/server-only";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin";
import { getCallerWithEmail } from "@/server/caller";

export const OVERVIEW_DAYS = 14;
const ZONE = "Asia/Dhaka";

export interface DayCount {
  /** YYYY-MM-DD (Asia/Dhaka). */
  day: string;
  count: number;
}

export interface AdminOverview {
  generatedAt: string;
  users: { total: number; new7d: number; perDay: DayCount[] };
  activeUsers7d: number;
  plannersToday: number;
  reminders: { enabled: number; disabled: number; push: number; email: number; calendar: number };
  pushSubscriptions: { total: number; new7d: number };
  deliveries: { last24h: number; perDay: DayCount[] };
  donations: { count: number; monthly: number; totals: Array<{ currency: string; amountMinor: number }>; testMode: boolean };
  announcements: { live: number; scheduled: number; expired: number };
  usage: { pageViewsPerDay: DayCount[]; topPages: Array<{ path: string; count: number }>; features: Array<{ name: string; count: number }> };
  /** Last scheduler call (pg_cron → /api/push/dispatch via pg_net), or null when it cannot be read. */
  lastCron: { at: string; status: number | null } | null;
}

export type AdminOverviewResult = { ok: true; data: AdminOverview } | { ok: false; error: "unauthorized" | "forbidden" };

/** The last `days` Dhaka days (oldest first), each with its count (0 when missing). */
export function fillDays(rows: Array<{ day: string; count: number | bigint }>, days: number, now: Date): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: ZONE });
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

type Row = { day: string; count: bigint };

export async function getAdminOverviewImpl(userId: string, now = new Date()): Promise<AdminOverviewResult> {
  const user = await getCallerWithEmail(userId);
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await isUserAdmin({ userId: user.id, email: user.email, emailVerified: user.emailVerified }))) {
    return { ok: false, error: "forbidden" };
  }

  const since = new Date(now.getTime() - OVERVIEW_DAYS * 86_400_000);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const day = new Date(now.getTime() - 86_400_000);
  const todayDhaka = now.toLocaleDateString("en-CA", { timeZone: ZONE });

  const [
    usersTotal,
    usersNew7d,
    usersPerDay,
    rules,
    subsTotal,
    subsNew7d,
    deliveries24h,
    deliveriesPerDay,
    donationTotals,
    donationCount,
    donationMonthly,
    announcements,
    plannersToday,
    pageViewsPerDay,
    topPages,
    features,
    activeUsers,
    lastCron,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.userProfile.count({ where: { createdAt: { gte: week } } }),
    prisma.$queryRaw<Row[]>`select to_char(created_at at time zone ${ZONE}, 'YYYY-MM-DD') as day, count(*) as count
      from public.user_profiles where created_at >= ${since} group by 1`,
    prisma.reminderRule.findMany({ select: { enabled: true, channels: true } }),
    prisma.pushSubscription.count(),
    prisma.pushSubscription.count({ where: { createdAt: { gte: week } } }),
    prisma.pushDeliveryLog.count({ where: { sentAt: { gte: day } } }),
    prisma.$queryRaw<Row[]>`select to_char(sent_at at time zone ${ZONE}, 'YYYY-MM-DD') as day, count(*) as count
      from public.push_delivery_logs where sent_at >= ${since} group by 1`,
    prisma.donation.groupBy({ by: ["currency"], where: { status: "succeeded" }, _sum: { amountMinor: true } }),
    prisma.donation.count({ where: { status: "succeeded" } }),
    prisma.donation.count({ where: { status: "succeeded", frequency: "monthly" } }),
    prisma.announcement.findMany({ select: { startAt: true, endAt: true } }),
    prisma.dailyLog.count({ where: { logDate: new Date(`${todayDhaka}T00:00:00Z`) } }),
    prisma.$queryRaw<Row[]>`select to_char(at at time zone ${ZONE}, 'YYYY-MM-DD') as day, count(*) as count
      from public.usage_events where name = 'page_view' and at >= ${since} group by 1`,
    prisma.$queryRaw<Array<{ path: string; count: bigint }>>`select path, count(*) as count from public.usage_events
      where name = 'page_view' and at >= ${week} group by 1 order by 2 desc limit 8`,
    prisma.$queryRaw<Array<{ name: string; count: bigint }>>`select name, count(*) as count from public.usage_events
      where name <> 'page_view' and at >= ${week} group by 1 order by 2 desc`,
    prisma.$queryRaw<Array<{ count: bigint }>>`select count(distinct user_id) as count from public.usage_events
      where user_id is not null and at >= ${week}`,
    prisma.$queryRaw<Array<{ created: Date; status_code: number | null }>>`select created, status_code
      from net._http_response order by created desc limit 1`.catch(() => []),
  ]);

  const has = (channels: unknown, c: string) => Array.isArray(channels) && channels.includes(c);
  const enabledRules = rules.filter((r) => r.enabled);
  const t = now.getTime();

  return {
    ok: true,
    data: {
      generatedAt: now.toISOString(),
      users: { total: usersTotal, new7d: usersNew7d, perDay: fillDays(usersPerDay, OVERVIEW_DAYS, now) },
      activeUsers7d: Number(activeUsers[0]?.count ?? 0),
      plannersToday,
      reminders: {
        enabled: enabledRules.length,
        disabled: rules.length - enabledRules.length,
        push: enabledRules.filter((r) => has(r.channels, "push")).length,
        email: enabledRules.filter((r) => has(r.channels, "email")).length,
        calendar: enabledRules.filter((r) => has(r.channels, "calendar")).length,
      },
      pushSubscriptions: { total: subsTotal, new7d: subsNew7d },
      deliveries: { last24h: deliveries24h, perDay: fillDays(deliveriesPerDay, OVERVIEW_DAYS, now) },
      donations: {
        count: donationCount,
        monthly: donationMonthly,
        totals: donationTotals.map((d) => ({ currency: d.currency, amountMinor: d._sum.amountMinor ?? 0 })),
        testMode: process.env.STRIPE_ALLOW_LIVE?.trim() !== "true",
      },
      announcements: {
        live: announcements.filter((a) => a.startAt.getTime() <= t && (!a.endAt || a.endAt.getTime() > t)).length,
        scheduled: announcements.filter((a) => a.startAt.getTime() > t).length,
        expired: announcements.filter((a) => a.endAt && a.endAt.getTime() <= t).length,
      },
      usage: {
        pageViewsPerDay: fillDays(pageViewsPerDay, OVERVIEW_DAYS, now),
        topPages: topPages.map((p) => ({ path: p.path, count: Number(p.count) })),
        features: features.map((f) => ({ name: f.name, count: Number(f.count) })),
      },
      lastCron: lastCron[0] ? { at: lastCron[0].created.toISOString(), status: lastCron[0].status_code } : null,
    },
  };
}
