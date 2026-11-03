"use client";

import { toast } from "sonner";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatLocalizedNumber, localizeAsciiDigits } from "@/lib/locale-number";
import { PAYMENT_REFERENCE, type Wallet } from "@/config/support";

export type Frequency = "once" | "monthly";

export interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  amount: number;
  frequency: Frequency;
}

async function copy(text: string, ok: string, fail: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error(fail);
  }
}

/** Shows the configured personal number(s) with copy buttons and Send Money steps. No payment happens here. */
export function PaymentSheet({ open, onOpenChange, wallets, amount, frequency }: PaymentSheetProps) {
  const t = useTranslations("supportPage");
  const locale = useLocale();
  const amountText = formatLocalizedNumber(amount, locale, { useGrouping: true });
  const steps = [
    t("step1"),
    t("step2"),
    t("step3", { amount: amountText }),
    t("step4", { reference: PAYMENT_REFERENCE }),
    t("step5"),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-rp-lg bg-rp-surface">
        <SheetHeader className="pr-16">
          <SheetTitle className="rp-h2 text-rp-ink">{t("sheetTitle")}</SheetTitle>
          <SheetDescription className="rp-small text-rp-muted">{t("sheetDescription")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <p className="rp-row text-rp-ink" data-testid="sheet-amount">
            {t("sheetAmount", { amount: amountText })}
            {frequency === "monthly" ? ` · ${t("monthly")}` : ""}
          </p>

          <ul className="space-y-3">
            {wallets.map((w) => {
              const provider = t(`wallet.${w.id}`);
              return (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-rp-md bg-rp-accent-tint p-3">
                  <div className="min-w-0">
                    <p className="rp-caption text-rp-muted">{provider}</p>
                    <p className="rp-h2 tabular-nums text-rp-ink" data-testid={`number-${w.id}`}>
                      {localizeAsciiDigits(w.number, locale)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-12 shrink-0"
                    aria-label={t("copyNumberFor", { provider })}
                    onClick={() => copy(w.number, t("copied"), t("copyFailed"))}
                  >
                    {t("copy")}
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 rounded-rp-md border border-rp-rule p-3">
            <div className="min-w-0">
              <p className="rp-caption text-rp-muted">{t("referenceLabel")}</p>
              <p className="rp-row text-rp-ink" data-testid="payment-reference">
                {PAYMENT_REFERENCE}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-h-12 shrink-0"
              aria-label={t("copyReference")}
              onClick={() => copy(PAYMENT_REFERENCE, t("copied"), t("copyFailed"))}
            >
              {t("copy")}
            </Button>
          </div>

          <section aria-labelledby="send-steps" className="space-y-2">
            <h3 id="send-steps" className="rp-row text-rp-ink">
              {t("stepsTitle")}
            </h3>
            <ol className="list-decimal space-y-1 pl-5 rp-small text-rp-ink marker:text-rp-accent">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>

          {frequency === "monthly" ? <p className="rp-small text-rp-muted">{t("monthlyNote")}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
