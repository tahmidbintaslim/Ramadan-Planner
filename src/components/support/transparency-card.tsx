"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Card } from "@/components/ui/card";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { formatDonationAmount, fromMinorUnits, type DonationSummary, type DonationSummaryRow } from "@/lib/donations";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; summary: DonationSummary };

function isSummary(v: unknown): v is DonationSummary {
  const s = v as DonationSummary | null;
  return !!s && Array.isArray(s.months) && typeof s.donorCount === "number";
}

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat(locale.startsWith("bn") ? "bn-BD-u-nu-beng" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * "স্বচ্ছতা" (transparency): card-donation totals from GET /api/donations/summary, exactly as recorded from Stripe.
 * Anonymous by construction (the API returns only sums and counts). Shows real numbers or an honest empty or
 * error state; it never fills in an estimate.
 */
export function TransparencyCard() {
  const t = useTranslations("supportPage.transparency");
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/donations/summary")
      .then(async (res) => {
        const data: unknown = res.ok ? await res.json() : null;
        if (alive) setState(isSummary(data) ? { kind: "ready", summary: data } : { kind: "error" });
      })
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  const byMonth = new Map<string, DonationSummaryRow[]>();
  if (state.kind === "ready") {
    for (const row of state.summary.months) byMonth.set(row.month, [...(byMonth.get(row.month) ?? []), row]);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="transparency-card" aria-busy={state.kind === "loading"}>
      <p className="rp-overline px-4 pb-1 pt-4 text-rp-muted">{t("title")}</p>
      {state.kind === "loading" ? (
        <p className="rp-small px-4 pb-4 text-rp-muted">{t("loading")}</p>
      ) : state.kind === "error" ? (
        <p className="rp-small px-4 pb-4 text-rp-muted" data-testid="transparency-error">
          {t("error")}
        </p>
      ) : state.summary.months.length === 0 ? (
        <p className="rp-small px-4 pb-4 text-rp-muted" data-testid="transparency-empty">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-rp-rule">
          <li className="flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="rp-row text-rp-ink">{t("donors")}</span>
            <span className="rp-row shrink-0 tabular-nums text-rp-ink" data-testid="transparency-donors">
              {formatLocalizedNumber(state.summary.donorCount, locale, { useGrouping: true })}
            </span>
          </li>
          {[...byMonth].map(([month, rows]) => (
            <li key={month} className="flex min-h-14 items-start justify-between gap-3 px-4 py-3" data-testid="transparency-month">
              <span className="rp-row text-rp-ink">{monthLabel(month, locale)}</span>
              <span className="shrink-0 text-right">
                {rows.map((r) => (
                  <span key={r.currency} className="block">
                    <span className="rp-row tabular-nums text-rp-ink">
                      {formatDonationAmount(fromMinorUnits(r.grossMinor - r.refundedMinor, r.currency), r.currency, locale)}
                    </span>
                    {r.refundedMinor > 0 ? (
                      <span className="rp-caption block text-rp-muted">
                        {t("refunded", { amount: formatDonationAmount(fromMinorUnits(r.refundedMinor, r.currency), r.currency, locale) })}
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="rp-caption border-t border-rp-rule px-4 py-3 text-rp-muted">{t("note")}</p>
    </Card>
  );
}
