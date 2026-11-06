"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronRightIcon,
  CodeIcon,
  DuaIcon,
  LanternIcon,
  MosqueIcon,
  ShareIcon,
} from "@/components/icons/islamic-icons";
import { formatLocalizedNumber } from "@/lib/locale-number";
import {
  COST_KEYS,
  DEFAULT_AMOUNT,
  MAX_AMOUNT,
  MIN_AMOUNT,
  PRESET_AMOUNTS,
  SUPPORT_CONFIG,
  configuredWallets,
  mailtoHref,
  parseAmount,
  safeHttpUrl,
  type SupportConfig,
} from "@/config/support";
import { PaymentSheet, type Frequency } from "./payment-sheet";

type Selection = number | "other";

const rowClass =
  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-rp-accent-tint/60 focus-visible:bg-rp-accent-tint/60 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring";

function ContributeRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rp-accent-tint text-rp-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="rp-row block text-rp-ink">{title}</span>
        <span className="rp-caption block text-rp-muted">{description}</span>
      </span>
      <ChevronRightIcon size={20} aria-hidden="true" className="shrink-0 text-rp-muted" />
    </>
  );
}

export function SupportPage({ config = SUPPORT_CONFIG }: { config?: SupportConfig }) {
  const t = useTranslations("supportPage");
  const locale = useLocale();
  const num = (n: number, opts?: Intl.NumberFormatOptions) => formatLocalizedNumber(n, locale, opts);

  const [selection, setSelection] = useState<Selection>(DEFAULT_AMOUNT);
  const [custom, setCustom] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [sheetOpen, setSheetOpen] = useState(false);

  const wallets = configuredWallets(config);
  const cardUrl = safeHttpUrl(config.cardUrl);
  const ledgerUrl = safeHttpUrl(config.ledgerUrl);
  const repoUrl = safeHttpUrl(config.repoUrl);
  const mosqueHref = mailtoHref(config.contactEmail, t("mosqueSubject"));

  const parsed = selection === "other" ? parseAmount(custom) : ({ ok: true, amount: selection } as const);
  const amount = parsed.ok ? parsed.amount : null;
  const showError = selection === "other" && custom.trim() !== "" && !parsed.ok;
  const errorText = !parsed.ok
    ? {
        empty: t("errEmpty"),
        invalid: t("errInvalid"),
        min: t("errMin", { min: num(MIN_AMOUNT) }),
        max: t("errMax", { max: num(MAX_AMOUNT, { useGrouping: true }) }),
      }[parsed.reason]
    : "";

  const walletsReady = wallets.length > 0;
  const walletDisabled = !walletsReady || amount === null;
  const walletLabel = !walletsReady
    ? t("soon")
    : amount === null
      ? t("walletButtonNoAmount")
      : t("walletButton", { amount: num(amount, { useGrouping: true }) });

  async function share() {
    const url = `${window.location.origin}/`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("title"), text: t("shareText"), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch (e) {
      // Closing the share sheet is not an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(t("shareError"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="rp-h1 text-rp-ink">{t("title")}</h1>

      <Card
        data-testid="support-intro"
        className="flex-row items-center gap-4 bg-linear-to-br from-rp-gold-tint to-rp-page px-5"
      >
        <LanternIcon size={64} className="shrink-0 text-rp-gold" />
        <div className="min-w-0 space-y-1">
          <h2 className="rp-h2 text-rp-ink">{t("introTitle")}</h2>
          <p className="rp-small text-rp-ink">{t("introText")}</p>
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden py-0" data-testid="cost-ledger">
        <h2 className="rp-h2 px-4 pb-1 pt-4 text-rp-ink">{t("ledgerTitle")}</h2>
        <ul className="divide-y divide-rp-rule">
          {COST_KEYS.map((key) => (
            <li key={key} className="flex min-h-14 items-center justify-between gap-3 px-4">
              <span className="rp-row text-rp-ink">{t(`cost.${key}`)}</span>
              <span className="rp-row shrink-0 tabular-nums text-rp-muted" data-testid={`cost-${key}`}>
                {config.costs[key] ?? t("costPending")}
              </span>
            </li>
          ))}
          {ledgerUrl ? (
            <li>
              <a href={ledgerUrl} target="_blank" rel="noopener noreferrer" className={rowClass} data-testid="ledger-link">
                <span className="rp-row min-w-0 flex-1 text-rp-accent">{t("receipts")}</span>
                <span className="sr-only">({t("opensNewTab")})</span>
                <ChevronRightIcon size={20} aria-hidden="true" className="shrink-0 text-rp-muted" />
              </a>
            </li>
          ) : null}
        </ul>
      </Card>

      <Card className="px-5" data-testid="give-card">
        <h2 className="rp-h2 text-rp-ink">{t("giveTitle")}</h2>

        <div className="space-y-2">
          <p id="amount-label" className="rp-caption text-rp-muted">
            {t("amountLabel")}
          </p>
          <div role="group" aria-labelledby="amount-label" className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((a) => (
              <Chip key={a} selected={selection === a} onClick={() => setSelection(a)} data-amount={a}>
                ৳{num(a)}
              </Chip>
            ))}
            <Chip selected={selection === "other"} onClick={() => setSelection("other")} data-amount="other">
              {t("amountOther")}
            </Chip>
          </div>
          {selection === "other" ? (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="custom-amount" className="rp-small text-rp-ink">
                {t("customLabel")}
              </Label>
              <Input
                id="custom-amount"
                inputMode="numeric"
                autoComplete="off"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-invalid={showError}
                aria-describedby="custom-amount-help"
                className="h-12 rounded-rp-md border-rp-input bg-rp-surface"
              />
              <p
                id="custom-amount-help"
                role={showError ? "alert" : undefined}
                className={showError ? "rp-small text-destructive" : "rp-small text-rp-muted"}
              >
                {showError
                  ? errorText
                  : t("customHint", { min: num(MIN_AMOUNT), max: num(MAX_AMOUNT, { useGrouping: true }) })}
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p id="frequency-label" className="rp-caption text-rp-muted">
            {t("frequencyLabel")}
          </p>
          <div role="group" aria-labelledby="frequency-label" className="flex gap-2">
            <Chip selected={frequency === "once"} onClick={() => setFrequency("once")} data-frequency="once">
              {t("once")}
            </Chip>
            <Chip selected={frequency === "monthly"} onClick={() => setFrequency("monthly")} data-frequency="monthly">
              {t("monthly")}
            </Chip>
          </div>
        </div>

        <div className="space-y-3">
          <Button size="lg" className="w-full" disabled={walletDisabled} onClick={() => setSheetOpen(true)} data-testid="wallet-button">
            {walletLabel}
          </Button>
          {cardUrl ? (
            <Button asChild variant="outline" size="lg" className="w-full">
              <a href={cardUrl} target="_blank" rel="noopener noreferrer" data-testid="card-button">
                {t("cardButton")}
                <span className="sr-only">({t("opensNewTab")})</span>
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="lg" className="w-full" disabled data-testid="card-button">
              {t("cardButton")} · {t("soon")}
            </Button>
          )}
        </div>

        <p className="rp-caption text-rp-muted" data-testid="support-note">
          {t("voluntaryNote")} {config.taxDeductible ? t("taxYes") : t("taxNo")}
        </p>
      </Card>

      <Card className="gap-0 overflow-hidden py-0" data-testid="contribute-card">
        <h2 className="rp-h2 px-4 pb-2 pt-4 text-rp-ink">{t("contributeTitle")}</h2>
        <ul className="divide-y divide-rp-rule">
          {repoUrl ? (
            <>
              <li>
                <a href={`${repoUrl.replace(/\/$/, "")}/issues`} target="_blank" rel="noopener noreferrer" className={rowClass} data-testid="translate-link">
                  <ContributeRow icon={<DuaIcon size={20} />} title={t("translate")} description={t("translateDesc")} />
                  <span className="sr-only">({t("opensNewTab")})</span>
                </a>
              </li>
              <li>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={rowClass} data-testid="repo-link">
                  <ContributeRow icon={<CodeIcon size={20} />} title={t("openSource")} description={t("openSourceDesc")} />
                  <span className="sr-only">({t("opensNewTab")})</span>
                </a>
              </li>
            </>
          ) : null}
          {mosqueHref ? (
            <li>
              <Link href={mosqueHref} className={rowClass} data-testid="mosque-link">
                <ContributeRow icon={<MosqueIcon size={20} />} title={t("mosque")} description={t("mosqueDesc")} />
              </Link>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={share} className={rowClass} data-testid="share-button">
              <ContributeRow icon={<ShareIcon size={20} />} title={t("shareFamily")} description={t("shareFamilyDesc")} />
            </button>
          </li>
        </ul>
        <p className="rp-caption border-t border-rp-rule px-4 py-3 text-rp-muted" data-testid="credits">
          {t("creditsIcons")}{" "}
          <a
            href="https://hugeicons.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-6 items-center font-semibold text-rp-accent underline-offset-4 hover:underline"
          >
            Hugeicons
            <span className="sr-only"> ({t("opensNewTab")})</span>
          </a>{" "}
          {t("creditsLicence")}
        </p>
      </Card>

      <PaymentSheet open={sheetOpen} onOpenChange={setSheetOpen} wallets={wallets} amount={amount ?? DEFAULT_AMOUNT} frequency={frequency} />
    </div>
  );
}
