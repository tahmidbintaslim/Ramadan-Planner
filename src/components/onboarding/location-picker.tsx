import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight, LocateFixed, Search } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import {
  POPULAR_DISTRICT_IDS,
  districtById,
  districtName,
  findDistrict,
  matchDistricts,
  type District,
} from "@/lib/districts";
import {
  locationFromCoords,
  locationFromDistrict,
  readStoredLocation,
  type StoredLocation,
} from "@/lib/user-location";
import { deviceTimeZone } from "@/components/today/use-home-timings";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

type GeoStatus = "idle" | "locating" | "found" | "abroad" | "denied" | "unavailable";
/** none: a district is missing; noMatch: nothing by that name; ambiguous: several match, pick one. */
type InputError = "none" | "noMatch" | "ambiguous" | null;

/** Why a typed name cannot be used as it is. */
function inputErrorFor(query: string): Exclude<InputError, null> {
  if (!query.trim()) return "none";
  return matchDistricts(query, 2).length > 1 ? "ambiguous" : "noMatch";
}

/**
 * The district choice (search, device position, popular districts), shared by the welcome flow's location step and
 * the location sheet. `resolve()` returns the location to save, or null after showing why it cannot be used.
 * `onSubmit` runs on Enter with a usable choice.
 */
export function useLocationPicker({ onSubmit }: { onSubmit?: (loc: StoredLocation) => void } = {}) {
  const locale = useLocale();
  const [choice, setChoice] = useState<StoredLocation | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [error, setError] = useState<InputError>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameOf = (d: District) => districtName(d, locale);

  // A returning visitor (changing the district) sees the current choice; read after mount (localStorage).
  useEffect(() => {
    const stored = readStoredLocation();
    if (!stored || stored.kind === "default") return;
    const d = districtById(stored.districtId);
    setChoice(stored);
    // A popular district shows as the checked row; any other is named in the field.
    const popular = (POPULAR_DISTRICT_IDS as readonly string[]).includes(d?.id ?? "") && stored.kind === "district";
    if (d && !popular) setQuery(districtName(d, locale));
    // Only on mount: later locale switches keep what the visitor typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestions = open ? matchDistricts(query) : [];

  function pick(d: District, fromList = false) {
    setChoice(locationFromDistrict(d));
    // A row tap leaves the field as it was (the row shows the check); a suggestion fills the field.
    if (!fromList) setQuery(nameOf(d));
    else setQuery("");
    setOpen(false);
    setActive(-1);
    setError(null);
    setGeo("idle");
  }

  function onType(value: string) {
    setQuery(value);
    setOpen(true);
    setActive(-1);
    setError(null);
    setGeo("idle");
    // Typing replaces an earlier pick unless the text still names it.
    if (choice && !(choice.districtId && findDistrict(value)?.id === choice.districtId)) setChoice(null);
  }

  function resolve(): StoredLocation | null {
    const typed = findDistrict(query);
    const loc = choice ?? (typed ? locationFromDistrict(typed) : null);
    if (!loc) {
      setError(inputErrorFor(query));
      // An ambiguous name opens the list to pick from.
      setOpen(true);
      inputRef.current?.focus();
    }
    return loc;
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
      const highlighted = suggestions[active];
      if (highlighted) {
        pick(highlighted);
        return;
      }
      if (choice || findDistrict(query)) {
        const loc = resolve();
        if (loc) onSubmit?.(loc);
        return;
      }
      if (query.trim()) setError(inputErrorFor(query));
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  }

  function locate() {
    setError(null);
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

  return { choice, query, open, setOpen, active, geo, error, inputRef, suggestions, pick, onType, onKeyDown, locate, resolve };
}

export type LocationPickerState = ReturnType<typeof useLocationPicker>;

/**
 * The fields (v4 location step): search field with a label and helper, a "use my location" row, and the popular
 * districts as an inset-grouped list with a trailing check. Messages are gentle and never red.
 */
export function LocationPickerFields({ picker, className }: { picker: LocationPickerState; className?: string }) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const listId = useId();
  const statusId = useId();
  const errorId = useId();
  const helperId = useId();
  const inputId = useId();
  const { choice, query, active, geo, error, inputRef, suggestions } = picker;
  const nameOf = (d: District) => districtName(d, locale);

  const geoText: Record<Exclude<GeoStatus, "idle">, string> = {
    locating: t("geoLocating"),
    found: t("geoFound", { district: choice?.districtId ? nameOf(districtById(choice.districtId)!) : "" }),
    abroad: t("geoAbroad"),
    denied: t("geoDenied"),
    unavailable: t("geoUnavailable"),
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="relative flex flex-col gap-2">
        <label htmlFor={inputId} className="rp-caption text-rp-muted">
          {t("districtLabel")}
        </label>
        <div
          className={cn(
            "flex h-11 items-center gap-2 rounded-rp-input border bg-rp-surface px-3 focus-within:ring-2 focus-within:ring-rp-focus",
            error ? "border-rp-focus" : "border-rp-input",
          )}
        >
          <Search size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={[helperId, errorId, geo !== "idle" ? statusId : ""].filter(Boolean).join(" ")}
            autoComplete="off"
            enterKeyHint="done"
            placeholder={t("districtPlaceholder")}
            value={query}
            onChange={(e) => picker.onType(e.target.value)}
            onKeyDown={picker.onKeyDown}
            onFocus={() => query && picker.setOpen(true)}
            onBlur={() => setTimeout(() => picker.setOpen(false), 120)}
            className="rp-row h-full min-w-0 flex-1 bg-transparent text-rp-ink outline-none placeholder:text-rp-muted"
          />
        </div>
        <p id={helperId} className="rp-caption text-rp-muted">
          {t("districtHelper")}
        </p>
        <ul
          id={listId}
          role="listbox"
          aria-label={t("suggestions")}
          className={cn(
            "absolute inset-x-0 top-[76px] z-20 overflow-hidden rounded-rp-md border border-rp-rule bg-rp-elevated py-1 shadow-lg",
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
                picker.pick(d);
              }}
              className={cn(
                "rp-row flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-rp-ink",
                i === active ? "bg-rp-accent-tint" : "hover:bg-rp-accent-tint/60",
              )}
            >
              <span>{nameOf(d)}</span>
              <span className="rp-caption text-rp-muted">{locale.startsWith("bn") ? d.en : d.bn}</span>
            </li>
          ))}
        </ul>
        {/* Always in the DOM so screen readers announce the message when it appears. */}
        <p id={errorId} role="alert" className={cn("rp-small text-rp-ink", !error && "sr-only")}>
          {error === "none" ? t("chooseFirst") : error === "noMatch" ? t("noMatch") : error === "ambiguous" ? t("ambiguous") : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={picker.locate}
          disabled={geo === "locating"}
          aria-describedby={geo !== "idle" ? statusId : undefined}
          className="rp-row flex min-h-[52px] items-center gap-4 rounded-rp-md bg-rp-surface px-4 text-left font-medium text-rp-accent transition-colors hover:bg-rp-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus disabled:opacity-60"
        >
          <LocateFixed size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
          <span className="min-w-0 flex-1">{t("useLocation")}</span>
          <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
        </button>
        <p id={statusId} role="status" aria-live="polite" className={cn("rp-small px-4 text-rp-muted", geo === "idle" && "sr-only")}>
          {geo === "idle" ? "" : geoText[geo]}
        </p>
      </div>

      <section aria-labelledby={`${listId}-popular`} className="flex flex-col gap-2">
        <h2 id={`${listId}-popular`} className="rp-caption px-4 text-rp-muted">
          {t("popular")}
        </h2>
        <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
          {POPULAR_DISTRICT_IDS.map((id) => {
            const d = districtById(id)!;
            const selected = choice?.kind === "district" && choice.districtId === id;
            return (
              <li key={id} className="relative after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-rp-rule last:after:hidden">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => picker.pick(d, true)}
                  className="rp-row flex min-h-[52px] w-full items-center gap-4 px-4 text-left text-rp-ink transition-colors hover:bg-rp-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus"
                >
                  <span className="min-w-0 flex-1">{nameOf(d)}</span>
                  {selected ? <Check size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
