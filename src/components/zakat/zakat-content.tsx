"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import {
  Calculator,
  CheckCircle2,
  CircleAlert,
  Coins,
  Gem,
  HandCoins,
  Landmark,
  Wallet,
} from "lucide-react";
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
  const [nisab, setNisab] = useState(() => formatLocalizedNumber(85000, locale));

  const totalAssets = asNumber(cash) + asNumber(gold) + asNumber(investments);
  const netZakatable = Math.max(0, totalAssets - asNumber(debts));
  const nisabValue = asNumber(nisab);
  const isEligible = netZakatable >= nisabValue;
  const zakatDue = isEligible ? netZakatable * 0.025 : 0;
  const formatMoney = (value: number) =>
    formatLocalizedNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

  const fields = [
    { id: "cash", label: tZakat("fieldCash"), value: cash, set: setCash, icon: Wallet },
    { id: "gold", label: tZakat("fieldGold"), value: gold, set: setGold, icon: Gem },
    { id: "investments", label: tZakat("fieldInvestments"), value: investments, set: setInvestments, icon: Landmark },
    { id: "debts", label: tZakat("fieldDebts"), value: debts, set: setDebts, icon: HandCoins },
    { id: "nisab", label: tZakat("fieldNisab"), value: nisab, set: setNisab, icon: Coins },
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
                <field.icon className="size-5 text-rp-accent" aria-hidden="true" />
                {field.label}
              </Label>
              <Input
                id={field.id}
                inputMode="decimal"
                autoComplete="off"
                placeholder={formatLocalizedNumber(0, locale)}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className={fieldClass}
              />
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
            <dd className="rp-h2 tabular-nums text-rp-accent">{formatMoney(zakatDue)}</dd>
          </div>
        </dl>
        {isEligible ? (
          <p className="rp-small inline-flex items-center gap-2 rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink">
            <CheckCircle2 className="size-5 shrink-0 text-rp-accent" aria-hidden="true" />
            {tZakat("eligibleDueNow", { amount: formatMoney(zakatDue) })}
          </p>
        ) : (
          <p className="rp-small inline-flex items-center gap-2 rounded-rp-md bg-rp-gold-tint px-3 py-2 text-rp-ink">
            <CircleAlert className="size-5 shrink-0 text-rp-gold-text" aria-hidden="true" />
            {tZakat("belowNisabDue", { amount: formatMoney(zakatDue) })}
          </p>
        )}
      </Card>

      <Card className="px-5">
        <h2 className="rp-h2 flex items-center gap-2 text-rp-ink">
          <Calculator className="size-5 text-rp-accent" aria-hidden="true" />
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
            {tZakat("nisabCheck")}: {formatMoney(netZakatable)} {isEligible ? ">=" : "<"} {formatMoney(nisabValue)}
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
