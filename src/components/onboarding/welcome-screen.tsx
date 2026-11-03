import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { switchLocaleAction } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { CrescentIcon, PinIcon } from "@/components/icons/islamic-icons";
import {
  POPULAR_DISTRICT_IDS,
  districtById,
  districtName,
  findDistrict,
  matchDistricts,
  type District,
} from "@/lib/districts";
import {
  defaultLocation,
  locationFromCoords,
  locationFromDistrict,
  markOnboardingDone,
  readStoredLocation,
  writeStoredLocation,
  type StoredLocation,
} from "@/lib/user-location";
import { deviceTimeZone } from "@/components/today/use-home-timings";
import { cn } from "@/lib/utils";

type GeoStatus = "idle" | "locating" | "found" | "abroad" | "denied" | "unavailable";

/**
 * First-run onboarding (no sign-up): a welcome sky, then the district. The choice is stored on this device only
 * (see `@/lib/user-location`) and the Home uses it for its timings. Also reached from the Home's location pill
 * to change the district.
 */
export function WelcomeScreen() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [isSwitching, startSwitch] = useTransition();

  const [choice, setChoice] = useState<StoredLocation | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const statusId = useId();
  const errorId = useId();

  const nameOf = (d: District) => districtName(d, locale);

  // A returning visitor (changing the district) sees the current choice; read after mount (localStorage).
  useEffect(() => {
    const stored = readStoredLocation();
    if (!stored || stored.kind === "default") return;
    const d = districtById(stored.districtId);
    setChoice(stored);
    if (d) setQuery(districtName(d, locale));
    // Only on mount: later locale switches keep what the visitor typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = open ? matchDistricts(query) : [];
  const chosenId = choice?.districtId;

  function pick(d: District) {
    setChoice(locationFromDistrict(d));
    setQuery(nameOf(d));
    setOpen(false);
    setActive(-1);
    setError(false);
    setGeo("idle");
  }

  function onType(value: string) {
    setQuery(value);
    setOpen(true);
    setActive(-1);
    setError(false);
    // Typing replaces an earlier pick unless the text still names it.
    if (choice && !(choice.districtId && findDistrict(value)?.id === choice.districtId)) setChoice(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const d = suggestions[active] ?? findDistrict(query);
      if (d) pick(d);
      else if (query.trim()) setError(true);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  function locate() {
    setError(false);
    setOpen(false);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to 2 decimals before it is kept anywhere.
        const loc = locationFromCoords(pos.coords.latitude, pos.coords.longitude, deviceTimeZone());
        setChoice(loc);
        const d = districtById(loc.districtId);
        setQuery(d ? nameOf(d) : "");
        setGeo(d ? "found" : "abroad");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  function finish(loc: StoredLocation) {
    writeStoredLocation(loc);
    markOnboardingDone();
    void router.navigate({ to: "/today" });
  }

  function start() {
    const loc = choice ?? (findDistrict(query) ? locationFromDistrict(findDistrict(query)!) : null);
    if (!loc) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    finish(loc);
  }

  const geoText: Record<Exclude<GeoStatus, "idle">, string> = {
    locating: t("geoLocating"),
    found: t("geoFound", { district: choice?.districtId ? nameOf(districtById(choice.districtId)!) : "" }),
    abroad: t("geoAbroad"),
    denied: t("geoDenied"),
    unavailable: t("geoUnavailable"),
  };

  return (
    <div className="min-h-dvh bg-rp-page">
      <main id="main-content" className="mx-auto flex w-full max-w-[480px] flex-col pb-24">
        <section
          aria-labelledby="welcome-greeting"
          className="relative isolate flex h-[360px] flex-col items-center overflow-hidden rounded-b-[40px] px-6 pt-14 text-center text-white sm:mt-6 sm:rounded-rp-xl"
          style={{ backgroundImage: "var(--rp-hero-sehri)" }}
        >
          <GirihPattern opacity={0.07} className="-z-10 text-white" />
          <MihrabArch className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[240px] w-[220px] -translate-x-1/2 text-white" />
          <p id="welcome-greeting" className="font-display text-[34px] leading-[46px]">
            {t("greeting")}
          </p>
          <p className="rp-small mt-1 text-white/85">{tCommon("appName")}</p>
          <CrescentIcon size={72} strokeWidth={1.2} className="mt-12 text-rp-gold" />
        </section>

        <div className="flex flex-col gap-4 px-4 pt-6">
          <div className="space-y-2">
            <h1 className="rp-h1 text-rp-ink">{t("title")}</h1>
            <p className="rp-body text-rp-muted">{t("subtitle")}</p>
          </div>

          <div className="relative">
            <label htmlFor="district-input" className="sr-only">
              {t("districtLabel")}
            </label>
            <div
              className={cn(
                "flex h-14 items-center gap-2 rounded-rp-md border bg-rp-surface pl-4 pr-1 shadow-rp-soft focus-within:ring-[3px] focus-within:ring-ring/50",
                error ? "border-destructive" : "border-rp-input",
              )}
            >
              <PinIcon size={22} className="shrink-0 text-rp-accent" />
              <input
                ref={inputRef}
                id="district-input"
                type="text"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                aria-invalid={error || undefined}
                aria-describedby={[error ? errorId : "", geo !== "idle" ? statusId : ""].filter(Boolean).join(" ") || undefined}
                autoComplete="off"
                enterKeyHint="done"
                placeholder={t("districtPlaceholder")}
                value={query}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => query && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                className="rp-row h-full min-w-0 flex-1 bg-transparent text-rp-ink outline-none placeholder:font-normal placeholder:text-rp-muted"
              />
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={locate}
                disabled={geo === "locating"}
                className="h-12 shrink-0 px-3 text-[14px]"
              >
                {t("useLocation")}
              </Button>
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-label={t("suggestions")}
              className={cn(
                "absolute inset-x-0 top-[60px] z-20 overflow-hidden rounded-rp-md border border-rp-rule bg-rp-surface py-1 shadow-rp-soft",
                suggestions.length === 0 && "hidden",
              )}
            >
              {suggestions.map((d, i) => (
                <li
                  key={d.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (not click) so the input's blur does not close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(d);
                  }}
                  className={cn(
                    "rp-row flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-rp-ink",
                    i === active ? "bg-rp-accent-tint" : "hover:bg-rp-accent-tint/60",
                  )}
                >
                  <span>{nameOf(d)}</span>
                  <span className="rp-caption text-rp-muted">{locale.startsWith("bn") ? d.en : d.bn}</span>
                </li>
              ))}
            </ul>
            {error ? (
              <p id={errorId} className="rp-small mt-2 text-destructive">
                {query.trim() ? t("noMatch") : t("chooseFirst")}
              </p>
            ) : null}
            <p id={statusId} role="status" aria-live="polite" className={cn("rp-small mt-2 text-rp-muted", geo === "idle" && "sr-only")}>
              {geo === "idle" ? "" : geoText[geo]}
            </p>
          </div>

          <div role="group" aria-label={t("popular")} className="flex flex-wrap gap-2">
            {POPULAR_DISTRICT_IDS.map((id) => {
              const d = districtById(id)!;
              return (
                <Chip key={id} selected={chosenId === id && choice?.kind === "district"} onClick={() => pick(d)}>
                  {nameOf(d)}
                </Chip>
              );
            })}
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={start}>
              {t("start")}
            </Button>
            <Button variant="quiet" size="lg" className="w-full whitespace-normal" onClick={() => finish(defaultLocation())}>
              {t("later")}
            </Button>
            <p className="rp-caption text-center text-rp-muted">{t("privacyNote")}</p>
          </div>

          <div className="flex justify-center">
            <Button
              variant="link"
              lang={locale.startsWith("bn") ? "en" : "bn"}
              disabled={isSwitching}
              onClick={() =>
                startSwitch(async () => {
                  await switchLocaleAction();
                  await router.invalidate();
                })
              }
            >
              {t("switchLanguage")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
