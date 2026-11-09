"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, XCircle } from "lucide-react";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGate } from "@/components/admin/announcements-admin-page";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { getAdminOverviewAction, type AdminOverview, type DayCount } from "@/actions/admin-overview";
import type { AdminAccess } from "@/actions/admin-access";
import { cn } from "@/lib/utils";

// Founder-only tool (Figma page 15, overview v1): English copy, real data only; cards the data cannot support
// yet (failed deliveries, content review, runtime errors) are left out rather than faked.
const nf = new Intl.NumberFormat("en-US");
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const FEATURE_LABELS: Record<string, string> = {
  reminder_added: "Reminder added",
  reminder_toggled: "Reminder switched",
  push_enabled: "Notifications turned on",
  tasbih_round: "Tasbih round completed",
  quran_play: "Quran recitation played",
  timetable_share: "Timetable shared",
  location_set: "Location set (onboarding)",
  signup_cta: "Sign-up link tapped",
  donate_start: "Donation started",
};

export function AdminOverviewPage({ access }: { access: AdminAccess }) {
  return (
    <AdminGate access={access}>
      <AdminTabs current="/admin" />
      <OverviewContent />
    </AdminGate>
  );
}

function OverviewContent() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(
    () =>
      getAdminOverviewAction()
        .then((res) => (res.ok ? setData(res.data) : setError(true)))
        .catch(() => setError(true)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5" data-testid="admin-overview">
      <header className="space-y-1">
        <h1 className="rp-large-title text-rp-ink">Overview</h1>
        <p className="rp-small text-rp-muted">
          {data ? `Last 14 days · Asia/Dhaka days · as of ${new Date(data.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}` : " "}
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex items-center gap-3 rounded-rp-md bg-rp-surface p-4">
          <XCircle size={24} aria-hidden className="shrink-0 text-destructive" />
          <p className="rp-body min-w-0 flex-1 text-rp-ink">The overview could not be loaded.</p>
          <Button
            variant="soft"
            onClick={() => {
              setError(false);
              void load();
            }}
          >
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div role="status" aria-label="Loading" className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-rp-lg" />
          ))}
          <Skeleton className="h-72 rounded-rp-lg md:col-span-3" />
          <Skeleton className="h-72 rounded-rp-lg" />
        </div>
      ) : (
        <Loaded data={data} />
      )}
    </div>
  );
}

function Loaded({ data }: { data: AdminOverview }) {
  const r = data.reminders;
  const channelTotal = Math.max(1, r.push + r.email + r.calendar);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Signed-up users" value={data.users.total} note={`+${nf.format(data.users.new7d)} in 7 d`}>
          <MiniBars days={data.users.perDay} />
        </Kpi>
        <Kpi title="Active reminder rules" value={r.enabled} note={`${nf.format(r.disabled)} switched off`}>
          <div className="flex h-2 overflow-hidden rounded-full bg-rp-rule" aria-hidden>
            <span className="bg-[var(--chart-1)]" style={{ width: `${(r.push / channelTotal) * 100}%` }} />
            <span className="ms-0.5 bg-[var(--chart-2)]" style={{ width: `${(r.email / channelTotal) * 100}%` }} />
            <span className="ms-0.5 bg-rp-muted" style={{ width: `${(r.calendar / channelTotal) * 100}%` }} />
          </div>
          <p className="rp-caption text-rp-muted">
            Push {nf.format(r.push)} · Email {nf.format(r.email)} · Calendar {nf.format(r.calendar)}
          </p>
        </Kpi>
        <Kpi title="Push subscriptions" value={data.pushSubscriptions.total} note={`+${nf.format(data.pushSubscriptions.new7d)} in 7 d`} />
        <Kpi title="Push deliveries · 24 h" value={data.deliveries.last24h}>
          <MiniBars days={data.deliveries.perDay} />
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-rp-lg bg-rp-surface p-5 lg:col-span-2" aria-labelledby="chart-signups">
          <h2 id="chart-signups" className="rp-headline text-rp-ink">
            New sign-ups per day
          </h2>
          <BarChart days={data.users.perDay} unit="sign-ups" />
        </section>
        <Attention data={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-rp-lg bg-rp-surface p-5 lg:col-span-2" aria-labelledby="chart-views">
          <h2 id="chart-views" className="rp-headline text-rp-ink">
            Page views per day
          </h2>
          <p className="rp-caption text-rp-muted">First-party, cookieless; visitors with Do Not Track / GPC are not counted.</p>
          <BarChart days={data.usage.pageViewsPerDay} unit="views" />
        </section>
        <section className="space-y-3 rounded-rp-lg bg-rp-surface p-5" aria-labelledby="top-pages">
          <h2 id="top-pages" className="rp-headline text-rp-ink">
            Top pages · 7 d
          </h2>
          <RankList rows={data.usage.topPages.map((p) => ({ label: p.path, count: p.count }))} empty="No page views yet." />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-rp-lg bg-rp-surface p-5 lg:col-span-2" aria-labelledby="features">
          <h2 id="features" className="rp-headline text-rp-ink">
            Features used · 7 d
          </h2>
          <RankList
            rows={data.usage.features.map((f) => ({ label: FEATURE_LABELS[f.name] ?? f.name, count: f.count }))}
            empty="No feature events yet."
          />
        </section>
        <div className="grid gap-4">
          <Kpi title="Signed-in users active · 7 d" value={data.activeUsers7d} />
          <Kpi title="Planners updated today" value={data.plannersToday} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Kpi
          title="Donations"
          value={data.donations.count}
          note={
            data.donations.totals.length
              ? data.donations.totals.map((t) => `${t.currency.toUpperCase()} ${nf.format(t.amountMinor / 100)}`).join(" · ") +
                ` · ${nf.format(data.donations.monthly)} monthly`
              : "None yet"
          }
          badge={data.donations.testMode ? "Test mode" : undefined}
        />
        <Kpi
          title="Announcements live"
          value={data.announcements.live}
          note={`${nf.format(data.announcements.scheduled)} scheduled · ${nf.format(data.announcements.expired)} expired`}
          href="/admin/announcements"
        />
      </div>
    </>
  );
}

function Kpi({
  title,
  value,
  note,
  badge,
  href,
  children,
}: {
  title: string;
  value: number;
  note?: string;
  badge?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <div className="flex h-full flex-col gap-2 rounded-rp-lg bg-rp-surface p-5">
      <p className="rp-small flex items-center gap-2 text-rp-muted">
        {title}
        {badge ? <span className="rp-caption rounded-rp-full bg-rp-gold-tint px-2 py-0.5 text-rp-gold-text">{badge}</span> : null}
      </p>
      <p className="rp-h1 tabular-nums text-rp-ink">{nf.format(value)}</p>
      {note ? <p className="rp-caption text-rp-muted">{note}</p> : null}
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-rp-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Single-series daily bars (one hue, no legend: the title names the series), hover title per bar + a table. */
function BarChart({ days, unit }: { days: DayCount[]; unit: string }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <figure className="space-y-2">
      <div className="flex h-48 items-end gap-0.5 border-b border-rp-rule" aria-hidden>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${dayLabel(d.day)}: ${nf.format(d.count)} ${unit}`}>
            <span
              className="w-full rounded-t-[4px] bg-[var(--chart-1)] transition-opacity group-hover:opacity-80"
              style={{ height: `${d.count === 0 ? 0 : Math.max(2, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="rp-caption flex justify-between text-rp-muted" aria-hidden>
        <span>{dayLabel(days[0].day)}</span>
        <span>max {nf.format(max === 1 && days.every((d) => d.count === 0) ? 0 : max)}</span>
        <span>{dayLabel(days[days.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>{unit} per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayLabel(d.day)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function MiniBars({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="mt-auto flex h-8 items-end gap-0.5" aria-hidden>
      {days.map((d) => (
        <span
          key={d.day}
          title={`${dayLabel(d.day)}: ${nf.format(d.count)}`}
          className="flex-1 rounded-t-[2px] bg-[var(--chart-1)]"
          style={{ height: `${d.count === 0 ? 4 : Math.max(10, (d.count / max) * 100)}%`, opacity: d.count === 0 ? 0.25 : 1 }}
        />
      ))}
    </div>
  );
}

function RankList({ rows, empty }: { rows: Array<{ label: string; count: number }>; empty: string }) {
  if (rows.length === 0) return <p className="rp-small text-rp-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="space-y-1">
          <div className="rp-small flex justify-between gap-3 text-rp-ink">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="tabular-nums">{nf.format(row.count)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-rp-rule" aria-hidden>
            <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Status rows always carry an icon and words, never color alone. */
function Attention({ data }: { data: AdminOverview }) {
  const items: Array<{ tone: "good" | "warn" | "bad"; title: string; detail: string; href?: string }> = [];
  const cron = data.lastCron;
  const cronAgeMin = cron ? (Date.parse(data.generatedAt) - Date.parse(cron.at)) / 60_000 : Infinity;
  if (!cron) items.push({ tone: "warn", title: "Reminder scheduler status unknown", detail: "No pg_cron call found" });
  else if (cron.status !== 200 || cronAgeMin > 15)
    items.push({
      tone: "bad",
      title: "Reminder scheduler needs a look",
      detail: `Last call ${Math.round(cronAgeMin)} min ago · HTTP ${cron.status ?? "no response"}`,
    });
  else items.push({ tone: "good", title: "Reminder scheduler running", detail: `Last call ${Math.round(cronAgeMin)} min ago · HTTP 200` });
  if (data.announcements.live === 0)
    items.push({ tone: "warn", title: "No live announcement", detail: `${data.announcements.scheduled} scheduled`, href: "/admin/announcements" });
  if (data.pushSubscriptions.total === 0)
    items.push({ tone: "warn", title: "No push subscriptions yet", detail: "Signed-in users turn them on in Reminders" });
  if (data.donations.testMode) items.push({ tone: "warn", title: "Donations in test mode", detail: "Live needs STRIPE_ALLOW_LIVE=true" });

  const Icon = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle };
  const tone = { good: "text-[var(--status-good)]", warn: "text-rp-gold-text", bad: "text-destructive" };
  return (
    <section className="space-y-3 rounded-rp-lg bg-rp-surface p-5" aria-labelledby="attention">
      <h2 id="attention" className="rp-headline flex items-center gap-2 text-rp-ink">
        <Clock size={20} aria-hidden className="text-rp-muted" />
        Needs attention
      </h2>
      <ul className="divide-y divide-rp-rule">
        {items.map((item) => {
          const I = Icon[item.tone];
          const row = (
            <div className="flex items-center gap-3 py-3">
              <I size={22} aria-hidden className={cn("shrink-0", tone[item.tone])} />
              <span className="min-w-0 flex-1">
                <span className="rp-row block text-rp-ink">{item.title}</span>
                <span className="rp-caption block text-rp-muted">{item.detail}</span>
              </span>
              {item.href ? <ChevronRight size={20} aria-hidden className="shrink-0 text-rp-muted" /> : null}
            </div>
          );
          return <li key={item.title}>{item.href ? <Link href={item.href}>{row}</Link> : row}</li>;
        })}
      </ul>
    </section>
  );
}
