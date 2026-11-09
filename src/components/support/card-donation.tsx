"use client";

import { track } from "@/lib/track";
import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMOUNT_BOUNDS,
  CARD_PRESETS,
  DONATION_CURRENCIES,
  checkoutIssue,
  formatDonationAmount,
  parseCardAmount,
  supportsMonthly,
  type DonationCurrency,
  type DonationFrequency,
} from "@/lib/donations";

/** localStorage key: the Checkout Session id of this browser's last monthly donation (opens the Stripe portal). */
export const MONTHLY_SESSION_KEY = "rp_donation_monthly_session";

type Selection = number | "other";

/** Fired on this window after the session id is stored (the "storage" event only reaches other tabs). */
const MONTHLY_SESSION_EVENT = "rp-donation-monthly-session";

/** Remembers a monthly donation's Checkout Session id on this device (from the success URL). */
export function rememberMonthlySession(sessionId: string): void {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return;
  try {
    localStorage.setItem(MONTHLY_SESSION_KEY, sessionId);
    window.dispatchEvent(new Event(MONTHLY_SESSION_EVENT));
  } catch {
    // Private mode or blocked storage: the portal link is simply not offered.
  }
}

function subscribeMonthlySession(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(MONTHLY_SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(MONTHLY_SESSION_EVENT, onChange);
  };
}

function readMonthlySession(): string | null {
  try {
    const v = localStorage.getItem(MONTHLY_SESSION_KEY);
    return v && /^cs_(test|live)_[A-Za-z0-9]+$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; url?: string; issue?: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { url?: unknown; issue?: unknown };
  const url = typeof data.url === "string" && /^https:\/\//.test(data.url) ? data.url : undefined;
  return { ok: res.ok && !!url, url, issue: typeof data.issue === "string" ? data.issue : res.status === 429 ? "rate_limited" : undefined };
}

/**
 * Card donation form (Stripe Checkout). Shown only when SupportConfig.stripeEnabled is on. The button sends the
 * choice to POST /api/donations/checkout and follows the returned Stripe URL; nothing is charged in the app.
 */
export function CardDonation() {
  const t = useTranslations("supportPage.card");
  const locale = useLocale();
  const [currency, setCurrency] = useState<DonationCurrency>("usd");
  const [selection, setSelection] = useState<Selection>(CARD_PRESETS.usd[1]);
  const [custom, setCustom] = useState("");
  const [frequency, setFrequency] = useState<DonationFrequency>("once");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null on the server and in the first client render (no localStorage there), then the stored id.
  const monthlySession = useSyncExternalStore(subscribeMonthlySession, readMonthlySession, () => null);
  const [portalBusy, setPortalBusy] = useState(false);

  const fmt = (n: number) => formatDonationAmount(n, currency, locale);
  const { min, max } = AMOUNT_BOUNDS[currency];
  const amount = selection === "other" ? parseCardAmount(custom) : selection;
  const issue = amount === null ? "amount_invalid" : checkoutIssue(amount, currency, frequency);
  const showError = selection === "other" && custom.trim() !== "" && issue !== null;
  const issueText =
    issue === "amount_min" ? t("errMin", { min: fmt(min) }) : issue === "amount_max" ? t("errMax", { max: fmt(max) }) : t("errInvalid");
  const monthlyOk = supportsMonthly(currency);

  function chooseCurrency(next: DonationCurrency) {
    setCurrency(next);
    setSelection(CARD_PRESETS[next][1]);
    setCustom("");
    setError(null);
    if (!supportsMonthly(next)) setFrequency("once");
  }

  async function donate() {
    if (amount === null || issue) return;
    setBusy(true);
    setError(null);
    try {
      track("donate_start");
      const res = await postJson("/api/donations/checkout", { amount, currency, frequency, locale: locale.startsWith("bn") ? "bn" : "en" });
      if (res.ok && res.url) {
        window.location.assign(res.url);
        return; // keep the busy state while the browser leaves for Stripe
      }
      setError(res.issue === "rate_limited" ? t("errRateLimited") : t("errCheckout"));
    } catch {
      setError(t("errNetwork"));
    }
    setBusy(false);
  }

  async function openPortal() {
    if (!monthlySession) return;
    setPortalBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/donations/portal", { sessionId: monthlySession });
      if (res.ok && res.url) {
        window.location.assign(res.url);
        return;
      }
      setError(t("errPortal"));
    } catch {
      setError(t("errNetwork"));
    }
    setPortalBusy(false);
  }

  const buttonLabel = busy
    ? t("redirecting")
    : amount === null || issue
      ? t("buttonNoAmount")
      : frequency === "monthly"
        ? t("buttonMonthly", { amount: fmt(amount) })
        : t("buttonOnce", { amount: fmt(amount) });

  return (
    <Card className="px-5" data-testid="card-donation">
      <div className="space-y-1">
        <h2 className="rp-h2 text-rp-ink">{t("title")}</h2>
        <p className="rp-small text-rp-muted">{t("description")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="card-currency" className="rp-caption text-rp-muted">
          {t("currencyLabel")}
        </Label>
        <select
          id="card-currency"
          data-testid="card-currency"
          value={currency}
          onChange={(e) => chooseCurrency(e.target.value as DonationCurrency)}
          className="h-12 w-full rounded-rp-md border border-rp-input bg-rp-surface px-3 text-rp-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {DONATION_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {t(`currency.${c}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p id="card-amount-label" className="rp-caption text-rp-muted">
          {t("amountLabel")}
        </p>
        <div role="group" aria-labelledby="card-amount-label" className="flex flex-wrap gap-2">
          {CARD_PRESETS[currency].map((a) => (
            <Chip key={a} selected={selection === a} onClick={() => setSelection(a)} data-card-amount={a}>
              {fmt(a)}
            </Chip>
          ))}
          <Chip selected={selection === "other"} onClick={() => setSelection("other")} data-card-amount="other">
            {t("amountOther")}
          </Chip>
        </div>
        {selection === "other" ? (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="card-custom-amount" className="rp-small text-rp-ink">
              {t("customLabel", { currency: currency.toUpperCase() })}
            </Label>
            <Input
              id="card-custom-amount"
              inputMode="decimal"
              autoComplete="off"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-invalid={showError}
              aria-describedby="card-custom-amount-help"
              className="h-12 rounded-rp-md border-rp-input bg-rp-surface"
            />
            <p
              id="card-custom-amount-help"
              role={showError ? "alert" : undefined}
              className={showError ? "rp-small text-destructive" : "rp-small text-rp-muted"}
            >
              {showError ? issueText : t("customHint", { min: fmt(min), max: fmt(max) })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p id="card-frequency-label" className="rp-caption text-rp-muted">
          {t("frequencyLabel")}
        </p>
        <div role="group" aria-labelledby="card-frequency-label" className="flex gap-2">
          <Chip selected={frequency === "once"} onClick={() => setFrequency("once")} data-card-frequency="once">
            {t("once")}
          </Chip>
          <Chip
            selected={frequency === "monthly"}
            onClick={() => setFrequency("monthly")}
            disabled={!monthlyOk}
            aria-describedby={monthlyOk ? undefined : "card-monthly-note"}
            data-card-frequency="monthly"
          >
            {t("monthly")}
          </Chip>
        </div>
        <p id="card-monthly-note" className="rp-small text-rp-muted">
          {monthlyOk ? t("monthlyCancelNote") : t("monthlyUnavailable")}
        </p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" disabled={busy || amount === null || issue !== null} onClick={donate} data-testid="stripe-button">
          {buttonLabel}
        </Button>
        {error ? (
          <p role="alert" className="rp-small text-destructive" data-testid="card-error">
            {error}
          </p>
        ) : null}
        {monthlySession ? (
          <Button variant="outline" size="lg" className="w-full" disabled={portalBusy} onClick={openPortal} data-testid="manage-monthly">
            {portalBusy ? t("redirecting") : t("manageMonthly")}
          </Button>
        ) : null}
      </div>

      <p className="rp-caption text-rp-muted" data-testid="card-note">
        {t("secureNote")}
      </p>
    </Card>
  );
}
