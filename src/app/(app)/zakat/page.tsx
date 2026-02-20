"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BadgeDollarSign,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Coins,
  Gem,
  HandCoins,
  Landmark,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function asNumber(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ZakatPage() {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const tZakat = useTranslations("zakat");
  const locale = useLocale();

  const [cash, setCash] = useState("");
  const [gold, setGold] = useState("");
  const [investments, setInvestments] = useState("");
  const [debts, setDebts] = useState("");
  const [nisab, setNisab] = useState("85000");

  const totalAssets = asNumber(cash) + asNumber(gold) + asNumber(investments);
  const netZakatable = Math.max(0, totalAssets - asNumber(debts));
  const nisabValue = asNumber(nisab);
  const isEligible = netZakatable >= nisabValue;
  const zakatDue = isEligible ? netZakatable * 0.025 : 0;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const fields = [
    { id: "cash", label: tZakat("fieldCash"), value: cash, set: setCash, icon: Wallet },
    { id: "gold", label: tZakat("fieldGold"), value: gold, set: setGold, icon: Gem },
    { id: "investments", label: tZakat("fieldInvestments"), value: investments, set: setInvestments, icon: Landmark },
    { id: "debts", label: tZakat("fieldDebts"), value: debts, set: setDebts, icon: HandCoins },
    { id: "nisab", label: tZakat("fieldNisab"), value: nisab, set: setNisab, icon: Coins },
  ] as const;

  return (
    <div className="space-y-4">
      <Card className="surface-soft border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            {tNav("zakat")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {tLanding("featureZakatDesc")}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <div key={field.id} className="rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="space-y-2">
                  <Label htmlFor={field.id} className="flex items-center gap-2 text-sm">
                    <field.icon className="h-4 w-4 text-primary" />
                    {field.label}
                  </Label>
                  <Input
                    id={field.id}
                    type="number"
                    min="0"
                    step="any"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{tZakat("totalAssets")}</p>
              <p className="text-lg font-semibold">{formatMoney(totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tZakat("netZakatable")}</p>
              <p className="text-lg font-semibold">{formatMoney(netZakatable)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tZakat("zakatDue")}</p>
              <p className="text-lg font-semibold text-primary">{formatMoney(zakatDue)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-primary" />
              {tZakat("calculationDemo")}
            </p>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>{tZakat("step1")}</p>
              <p className="font-medium text-foreground">
                = {formatMoney(asNumber(cash))} + {formatMoney(asNumber(gold))} +{" "}
                {formatMoney(asNumber(investments))} = {formatMoney(totalAssets)}
              </p>
              <p>{tZakat("step2")}</p>
              <p className="font-medium text-foreground">
                = {formatMoney(totalAssets)} - {formatMoney(asNumber(debts))} ={" "}
                {formatMoney(netZakatable)}
              </p>
              <p>{tZakat("step3")}</p>
              <p className="font-medium text-foreground">
                {tZakat("nisabCheck")}: {formatMoney(netZakatable)}{" "}
                {isEligible ? ">=" : "<"}{" "}
                {formatMoney(nisabValue)}
              </p>
            </div>
            <div className="pt-1">
              {isEligible ? (
                <p className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  {tZakat("eligibleDueNow", { amount: formatMoney(zakatDue) })}
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                  <CircleAlert className="h-4 w-4" />
                  {tZakat("belowNisabDue", { amount: formatMoney(zakatDue) })}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/80 bg-background/40 p-4 space-y-2">
            <p className="text-sm font-medium">{tZakat("rulesTitle")}</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>- {tZakat("rule1")}</li>
              <li>- {tZakat("rule2")}</li>
              <li>- {tZakat("rule3")}</li>
              <li>- {tZakat("rule4")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
