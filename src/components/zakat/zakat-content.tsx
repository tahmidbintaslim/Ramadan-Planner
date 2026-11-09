"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { AlertIcon, CalculatorIcon, CheckCircleIcon } from "@/components/icons/islamic-icons";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DIVIDER } from "@/components/settings/location-prayer-card";
import { cn } from "@/lib/utils";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/locale-number";

/** A typed amount in either digit set; empty or invalid counts as 0. */
function asNumber(v: string): number {
  const n = parseLocalizedNumber(v);
  return n !== null && n >= 0 ? n : 0;
}

export function ZakatContent() {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const tZakat = useTranslations("zakat");
  const locale = useLocale();

  const [cash, setCash] = useState("");
  const [gold, setGold] = useState("");
  const [investments, setInvestments] = useState("");
  const [debts, setDebts] = useState("");
  // No sample nisab: it depends on today's gold or silver price, which the app does not assume. Until the user
  // enters it, nothing is called due or below nisab.
  const [nisab, setNisab] = useState("");

  const totalAssets = asNumber(cash) + asNumber(gold) + asNumber(investments);
  const netZakatable = Math.max(0, totalAssets - asNumber(debts));
  const nisabValue = asNumber(nisab);
  const nisabKnown = nisabValue > 0;
  const isEligible = nisabKnown && netZakatable >= nisabValue;
  const zakatDue = isEligible ? netZakatable * 0.025 : 0;
  const formatMoney = (value: number) =>
    formatLocalizedNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

  const amount = tZakat("amountPlaceholder");
  // Grouped rows (Figma page 12, D9): assets, then debts, then the nisab with its basis.
  const groups = [
    {
      id: "assets",
      title: tZakat("groupAssets"),
      fields: [
        { id: "cash", label: tZakat("fieldCash"), value: cash, set: setCash, placeholder: amount },
        { id: "gold", label: tZakat("fieldGold"), value: gold, set: setGold, placeholder: amount },
        { id: "investments", label: tZakat("fieldInvestments"), value: investments, set: setInvestments, placeholder: amount },
      ],
    },
    { id: "debts", title: tZakat("groupDebts"), fields: [{ id: "debts", label: tZakat("fieldDebts"), value: debts, set: setDebts, placeholder: amount }] },
    {
      id: "nisab",
      title: tZakat("groupNisab"),
      fields: [{ id: "nisab", label: tZakat("fieldNisab"), value: nisab, set: setNisab, placeholder: tZakat("nisabPlaceholder") }],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="space-y-1">
        <h1 className="rp-large-title text-rp-ink">{tNav("zakat")}</h1>
        <p className="rp-small text-rp-muted">{tLanding("featureZakatDesc")}</p>
      </div>

      <section className="space-y-3 rounded-rp-md bg-rp-surface p-4" data-testid="zakat-summary">
        <dl className="space-y-1">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="rp-small text-rp-muted">{tZakat("totalAssets")}</dt>
            <dd className="rp-row tabular-nums text-rp-ink">{formatMoney(totalAssets)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="rp-small text-rp-muted">{tZakat("netZakatable")}</dt>
            <dd className="rp-row tabular-nums text-rp-ink">{formatMoney(netZakatable)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-rp-rule pt-2">
            <dt className="rp-headline text-rp-ink">{tZakat("zakatDue")}</dt>
            <dd className="rp-h2 tabular-nums text-rp-accent">{nisabKnown ? formatMoney(zakatDue) : "—"}</dd>
          </div>
        </dl>
        {!nisabKnown ? (
          <p className="rp-small flex items-center gap-2 rounded-rp-md bg-rp-page px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="no-nisab">
            <AlertIcon size={20} className="shrink-0 text-rp-muted" />
            {tZakat("nisabNeeded")}
          </p>
        ) : isEligible ? (
          <p className="rp-small flex items-center gap-2 rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="due">
            <CheckCircleIcon size={20} className="shrink-0 text-rp-accent" />
            {tZakat("eligibleDueNow", { amount: formatMoney(zakatDue) })}
          </p>
        ) : (
          <p className="rp-small flex items-center gap-2 rounded-rp-md bg-rp-gold-tint px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="below">
            <AlertIcon size={20} className="shrink-0 text-rp-gold-text" />
            {tZakat("belowNisabDue", { amount: formatMoney(zakatDue) })}
          </p>
        )}
      </section>

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`zakat-${group.id}`} className="space-y-2">
          <h2 id={`zakat-${group.id}`} className="rp-caption px-4 text-rp-muted">
            {group.title}
          </h2>
          <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
            {group.fields.map((field) => (
              <li key={field.id} className={cn(DIVIDER, "flex min-h-[52px] items-center gap-3 px-4")}>
                <label htmlFor={field.id} className="rp-row shrink-0 text-rp-ink">
                  {field.label}
                </label>
                <Input
                  id={field.id}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  aria-describedby={field.id === "nisab" ? "nisab-hint" : undefined}
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 text-end tabular-nums shadow-none focus-visible:ring-2 focus-visible:ring-rp-focus"
                />
              </li>
            ))}
          </ul>
          {group.id === "nisab" ? (
            <p id="nisab-hint" className="rp-small px-4 text-rp-muted" data-testid="nisab-hint">
              {tZakat("nisabHint")}
            </p>
          ) : null}
        </section>
      ))}

      <Card className="px-5">
        <h2 className="rp-h2 flex items-center gap-2 text-rp-ink">
          <CalculatorIcon size={20} className="text-rp-accent" />
          {tZakat("calculationDemo")}
        </h2>
        <div className="rp-small space-y-1.5 text-rp-muted">
          <p>{tZakat("step1")}</p>
          <p className="font-medium text-rp-ink">
            = {formatMoney(asNumber(cash))} + {formatMoney(asNumber(gold))} + {formatMoney(asNumber(investments))} ={" "}
            {formatMoney(totalAssets)}
          </p>
          <p>{tZakat("step2")}</p>
          <p className="font-medium text-rp-ink">
            = {formatMoney(totalAssets)} - {formatMoney(asNumber(debts))} = {formatMoney(netZakatable)}
          </p>
          <p>{tZakat("step3")}</p>
          <p className="font-medium text-rp-ink">
            {tZakat("nisabCheck")}:{" "}
            {nisabKnown
              ? `${formatMoney(netZakatable)} ${isEligible ? ">=" : "<"} ${formatMoney(nisabValue)}`
              : tZakat("nisabUnknown")}
          </p>
        </div>
      </Card>

      <Card className="px-5">
        <h2 className="rp-h2 text-rp-ink">{tZakat("rulesTitle")}</h2>
        <ul className="rp-small list-disc space-y-1 ps-5 text-rp-muted">
          <li>{tZakat("rule1")}</li>
          <li>{tZakat("rule2")}</li>
          <li>{tZakat("rule3")}</li>
          <li>{tZakat("rule4")}</li>
        </ul>
      </Card>
    </div>
  );
}
