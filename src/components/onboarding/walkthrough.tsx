import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";
import { useClockFormat } from "@/hooks/use-clock-format";
import { digits, formatClock, type Locale } from "@/components/timetable/timetable-logic";
import { cn } from "@/lib/utils";
import { AnimatedBrandMark } from "./animated-brand-mark";
import { WALKTHROUGH_ART } from "./walkthrough-art";
import { markWalkthroughSeen, primaryAction, slideForKey, slideFromScroll } from "./walkthrough-state";

const SLIDES = [1, 2, 3, 4] as const;
const COUNT = SLIDES.length;
/** Logo motion (600 ms) plus the 300 ms hold before card 1 (Figma O1 → W1). */
const SPLASH_MS = 900;
const LEAVE_MS = 200;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * First-run launch and walkthrough (Figma page 14): the logo animation, then four swipeable cards (scroll-snap;
 * arrows, Home/End), Skip and Next / Get started. `times`: today's sehri end and iftar (HH:mm) for card 1's pills,
 * shown only once the live times arrive. Calls `onDone` after the screen dissolves; the device then never sees it
 * again (rp_walkthrough_seen).
 */
export function Walkthrough({ times, onDone }: { times?: { sehri: string; iftar: string } | null; onDone: () => void }) {
  const t = useTranslations("onboarding.walkthrough");
  const locale = useLocale() as Locale;
  const [clockFormat] = useClockFormat();
  const [phase, setPhase] = useState<"splash" | "cards">("splash");
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // While Next scrolls smoothly, the slides passed on the way must not flip the dots and button back.
  const target = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setPhase("cards"), reducedMotion() ? 300 : SPLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  function finish() {
    if (leaving) return;
    markWalkthroughSeen();
    setLeaving(true);
    window.setTimeout(onDone, LEAVE_MS);
  }

  function goTo(next: number) {
    const el = scroller.current;
    if (!el) return;
    setIndex(next);
    target.current = next;
    window.setTimeout(() => (target.current = null), 700);
    el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion() ? "instant" : "smooth" });
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const at = slideFromScroll(el.scrollLeft, el.clientWidth, COUNT);
    if (target.current !== null) {
      if (at !== target.current) return;
      target.current = null;
    }
    setIndex(at);
  }

  function onKeyDown(e: KeyboardEvent) {
    const next = slideForKey(e.key, index, COUNT);
    if (next === null) return;
    e.preventDefault();
    goTo(next);
  }

  if (phase === "splash") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 pb-16">
        <AnimatedBrandMark size={112} animate />
        <h1 className="flex flex-col items-center gap-1 text-center">
          <span lang="bn" className="font-display text-[40px] font-semibold leading-[56px] text-rp-ink">
            রমজান প্ল্যানার
          </span>
          <span lang="en" className="rp-headline text-rp-accent">
            Ramadan Planner
          </span>
        </h1>
      </div>
    );
  }

  const isLast = primaryAction(index, COUNT) === "finish";
  const title = (n: number) => t(`s${n}Title`);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("label")}
      onKeyDown={onKeyDown}
      className={cn(
        "rp-wt-enter flex min-h-dvh flex-col regular:my-10 regular:min-h-0 regular:rounded-rp-xl regular:bg-rp-surface regular:pt-4 regular:shadow-rp-soft",
        leaving && "rp-wt-leave",
      )}
    >
      <div className="flex h-11 items-center justify-between pl-5 pr-3">
        <AnimatedBrandMark size={32} />
        <button
          type="button"
          onClick={finish}
          className={cn(
            "rp-body flex min-h-11 min-w-11 items-center justify-center rounded-rp-sm px-3 text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
            isLast && "invisible",
          )}
          aria-hidden={isLast || undefined}
          tabIndex={isLast ? -1 : undefined}
        >
          {t("skip")}
        </button>
      </div>

      <div
        ref={scroller}
        tabIndex={0}
        onScroll={onScroll}
        className="rp-wt-scroller mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus"
      >
        {SLIDES.map((n, i) => {
          const Art = WALKTHROUGH_ART[i];
          const active = i === index;
          return (
            <div
              key={n}
              role="group"
              aria-roledescription="slide"
              aria-label={t("slideOf", { current: digits(n, locale), total: digits(COUNT, locale) })}
              aria-hidden={!active || undefined}
              data-active={active}
              className="flex w-full shrink-0 snap-center snap-always flex-col"
            >
              <div className="rp-wt-content flex flex-col">
                {/* Fixed height; card 1's art sits high (Figma) so its time pills arrive without moving anything. */}
                <div
                  className={cn(
                    "relative mx-4 flex h-[300px] flex-col items-center overflow-hidden rounded-[28px] bg-rp-accent-tint regular:h-[340px]",
                    n === 1 ? "pt-[30px]" : "justify-center",
                  )}
                >
                  <Art />
                  {n === 1 && times ? (
                    <div className="absolute inset-x-2 bottom-3.5 flex justify-center gap-2">
                      <span className="rp-small whitespace-nowrap rounded-rp-full bg-rp-page px-2.5 py-1.5 font-medium text-rp-ink">
                        {t("sehriEnds", { time: formatClock(times.sehri, locale, clockFormat) })}
                      </span>
                      <span className="rp-small whitespace-nowrap rounded-rp-full bg-rp-page px-2.5 py-1.5 font-medium text-rp-ink">
                        {t("iftarAt", { time: formatClock(times.iftar, locale, clockFormat) })}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 px-6 pt-8">
                  <h2 className="rp-h1 text-rp-ink">{title(n)}</h2>
                  <p className="rp-body text-rp-muted">{t(`s${n}Body`)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("announce", { current: digits(index + 1, locale), total: digits(COUNT, locale), title: title(index + 1) })}
      </p>

      <div className="mt-auto flex flex-col items-center gap-[30px] px-4 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2" aria-hidden>
          {SLIDES.map((n, i) => (
            <span key={n} className={cn("rp-wt-dot h-2 rounded-rp-full", i === index ? "w-6 bg-rp-primary" : "w-2 bg-rp-rule")} />
          ))}
        </div>
        <Button
          className="h-[50px] min-h-[50px] w-full rounded-rp-input"
          onClick={() => (isLast ? finish() : goTo(index + 1))}
        >
          {isLast ? t("getStarted") : t("next")}
        </Button>
      </div>
    </section>
  );
}
