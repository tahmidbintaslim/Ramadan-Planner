"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import {
  AlertIcon,
  BankIcon,
  CalculatorIcon,
  CheckCircleIcon,
  CoinsIcon,
  GemIcon,
  WalletIcon,
  ZakatIcon,
} from "@/components/icons/islamic-icons";
import { Card } from "@/components/ui/card";
import { Input, fieldClass } from "@/components/ui/input";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/locale-number";
import { Label } from "@/components/ui/label";

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
  const fields = [
    { id: "cash", label: tZakat("fieldCash"), value: cash, set: setCash, icon: WalletIcon, placeholder: amount },
    { id: "gold", label: tZakat("fieldGold"), value: gold, set: setGold, icon: GemIcon, placeholder: amount },
    { id: "investments", label: tZakat("fieldInvestments"), value: investments, set: setInvestments, icon: BankIcon, placeholder: amount },
    { id: "debts", label: tZakat("fieldDebts"), value: debts, set: setDebts, icon: CoinsIcon, placeholder: amount },
    { id: "nisab", label: tZakat("fieldNisab"), value: nisab, set: setNisab, icon: ZakatIcon, placeholder: tZakat("nisabPlaceholder") },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink">{tNav("zakat")}</h1>
        <p className="rp-small text-rp-muted">{tLanding("featureZakatDesc")}</p>
      </div>

      <Card className="px-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id} className="rp-small text-rp-ink">
                <field.icon size={20} className="text-rp-accent" />
                {field.label}
              </Label>
              <Input
                id={field.id}
                inputMode="decimal"
                autoComplete="off"
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                aria-describedby={field.id === "nisab" ? "nisab-hint" : undefined}
                className={fieldClass}
              />
              {field.id === "nisab" ? (
                <p id="nisab-hint" className="rp-caption text-rp-muted" data-testid="nisab-hint">
                  {tZakat("nisabHint")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="px-5" data-testid="zakat-summary">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-rp-md bg-rp-page p-4">
            <dt className="rp-caption text-rp-muted">{tZakat("totalAssets")}</dt>
            <dd className="rp-h2 tabular-nums text-rp-ink">{formatMoney(totalAssets)}</dd>
          </div>
          <div className="rounded-rp-md bg-rp-page p-4">
            <dt className="rp-caption text-rp-muted">{tZakat("netZakatable")}</dt>
            <dd className="rp-h2 tabular-nums text-rp-ink">{formatMoney(netZakatable)}</dd>
          </div>
          <div className="rounded-rp-md bg-rp-accent-tint p-4">
            <dt className="rp-caption text-rp-ink">{tZakat("zakatDue")}</dt>
            <dd className="rp-h2 tabular-nums text-rp-accent">{nisabKnown ? formatMoney(zakatDue) : "—"}</dd>
          </div>
        </dl>
        {!nisabKnown ? (
          <p className="rp-small inline-flex items-center gap-2 rounded-rp-md bg-rp-page px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="no-nisab">
            <AlertIcon size={20} className="shrink-0 text-rp-muted" />
            {tZakat("nisabNeeded")}
          </p>
        ) : isEligible ? (
          <p className="rp-small inline-flex items-center gap-2 rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="due">
            <CheckCircleIcon size={20} className="shrink-0 text-rp-accent" />
            {tZakat("eligibleDueNow", { amount: formatMoney(zakatDue) })}
          </p>
        ) : (
          <p className="rp-small inline-flex items-center gap-2 rounded-rp-md bg-rp-gold-tint px-3 py-2 text-rp-ink" data-testid="zakat-status" data-status="below">
            <AlertIcon size={20} className="shrink-0 text-rp-gold-text" />
            {tZakat("belowNisabDue", { amount: formatMoney(zakatDue) })}
          </p>
        )}
      </Card>

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
