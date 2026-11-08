"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Chip } from "@/components/ui/chip";
import { LocationSheet } from "@/components/onboarding/location-sheet";
import { useDistrictLabel } from "@/components/layout/app-header";
import { useMethodName } from "@/components/prayer/use-calc-source";
import { deviceTimeZone } from "@/components/today/use-home-timings";
import { useStoredLocation } from "@/hooks/use-stored-location";
import { METHOD_IDS, defaultMethodForCountry, type MethodId, type School } from "@/lib/calc-method";
import { getCountryCodeForTimezone } from "@/lib/hijri-offsets";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { readHijriAdjust, subscribeStoredLocation, writeHijriAdjust, writeStoredLocation } from "@/lib/user-location";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export const ROW =
  "rp-row flex min-h-[52px] w-full items-center gap-4 px-4 text-left text-rp-ink transition-colors hover:bg-rp-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus";
export const DIVIDER = "relative after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-rp-rule last:after:hidden";
const ADJUSTMENTS = [-2, -1, 0, 1, 2] as const;

/**
 * Settings → "Location & prayer times": the place (opens the location sheet), the calculation method (the
 * country's default first, with a check on the current one), the Asr school, the Hijri date adjustment, and the
 * source. Method and school are kept with the stored location on this device; the adjustment on its own key.
 */
export function LocationPrayerCard() {
  const t = useTranslations("calc");
  const locale = useLocale();
  const methodName = useMethodName();
  const stored = useStoredLocation();
  const place = useDistrictLabel();
  const hijriAdjust = useSyncExternalStore(subscribeStoredLocation, readHijriAdjust, () => 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [methodsOpen, setMethodsOpen] = useState(false);

  // Without a stored location the server uses the device zone's country; show that default.
  const country = stored?.country ?? (stored ? undefined : getCountryCodeForTimezone(deviceTimeZone()));
  const fallback = defaultMethodForCountry(country);
  const method = stored?.method ?? fallback.method;
  const school = stored?.school ?? fallback.school;
  const countryDefault = defaultMethodForCountry(stored?.country ?? country).method;
  const methods = [countryDefault, ...METHOD_IDS.filter((m) => m !== countryDefault)];

  // A method or school belongs to a place: without one, choosing opens the location sheet first.
  const update = (patch: { method?: MethodId; school?: School }) => {
    if (!stored) {
      setSheetOpen(true);
      return;
    }
    writeStoredLocation({ ...stored, ...patch, savedAt: new Date().toISOString() });
  };
  const signed = (n: number) => (n > 0 ? "+" : "") + formatLocalizedNumber(n, locale);

  return (
    <section data-testid="location-prayer-card" aria-labelledby="location-prayer-title" className="space-y-2">
      <h2 id="location-prayer-title" className="rp-caption px-4 text-rp-muted">
        {t("sectionTitle")}
      </h2>
      <div className="space-y-4">
        <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
          <li className={DIVIDER}>
            <button type="button" onClick={() => setSheetOpen(true)} className={ROW}>
              <MapPin size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
              <span className="min-w-0 flex-1">{t("location")}</span>
              <span className="rp-small min-w-0 truncate text-rp-muted">{place ?? t("chooseLocation")}</span>
              <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
            </button>
          </li>
          <li className={DIVIDER}>
            <button
              type="button"
              aria-expanded={methodsOpen}
              aria-controls="calc-method-list"
              onClick={() => setMethodsOpen((v) => !v)}
              className={ROW}
            >
              <span className="min-w-0 flex-1">{t("method")}</span>
              <span className="rp-small min-w-0 truncate text-rp-muted" data-testid="calc-method-value">
                {methodName(method)}
              </span>
              <ChevronRight
                size={20}
                strokeWidth={LUCIDE_STROKE}
                aria-hidden
                className={cn("shrink-0 text-rp-muted transition-transform", methodsOpen && "rotate-90")}
              />
            </button>
          </li>
        </ul>

        {methodsOpen ? (
          <div className="space-y-2">
            <p className="rp-small px-4 text-rp-muted">{t("methodHint")}</p>
            <ul id="calc-method-list" role="radiogroup" aria-label={t("method")} className="overflow-hidden rounded-rp-md bg-rp-surface">
              {methods.map((m) => (
                <li key={m} className={DIVIDER}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={m === method}
                    onClick={() => update({ method: m })}
                    className={ROW}
                  >
                    <span className="min-w-0 flex-1">
                      {methodName(m)}
                      {m === countryDefault ? <span className="rp-caption ms-2 text-rp-muted">{t("defaultTag")}</span> : null}
                    </span>
                    {m === method ? <Check size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-4 rounded-rp-md bg-rp-surface p-4">
        <div className="space-y-2">
          <p id="calc-asr-title" className="rp-small px-1 text-rp-muted">
            {t("asr")}
          </p>
          <div role="group" aria-labelledby="calc-asr-title" className="flex flex-wrap gap-2" data-testid="calc-asr">
            {([0, 1] as const).map((s) => (
              <Chip key={s} selected={school === s} onClick={() => update({ school: s })}>
                {t(s === 1 ? "hanafi" : "standard")}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p id="calc-hijri-title" className="rp-small px-1 text-rp-muted">
            {t("hijriAdjust")}
          </p>
          <div role="group" aria-labelledby="calc-hijri-title" className="flex flex-wrap gap-2" data-testid="calc-hijri">
            {ADJUSTMENTS.map((n) => (
              <Chip
                key={n}
                selected={hijriAdjust === n}
                onClick={() => writeHijriAdjust(n)}
                aria-label={t("days", { n: signed(n) })}
              >
                {signed(n)}
              </Chip>
            ))}
          </div>
          <p className="rp-small px-1 text-rp-muted">{t("hijriAdjustHint")}</p>
        </div>

        </div>
        <p className="rp-caption px-4 text-rp-muted">{t("footer")}</p>
      </div>
      <LocationSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </section>
  );
}
