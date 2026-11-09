"use client";

import { track } from "@/lib/track";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Input, fieldClass } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DIVIDER } from "@/components/settings/location-prayer-card";
import { pruneLocalHistory } from "@/lib/local-history";
import { migrateUtcDayKey } from "@/lib/local-day";
import { useLocalTodayISO } from "@/hooks/use-local-day";

const TASBIH_PRESETS = [33, 99, 100];
const subscribeNoop = () => () => {};
const STORAGE_KEY_PREFIX = "rp_tasbih_state_v1_";

type TasbihState = {
  count: number;
  target: number;
  autoEnabled: boolean;
  totalIncrements: number;
  completedCycles: number;
};

function readTasbihState(key: string): TasbihState {
  if (typeof window === "undefined") {
    return {
      count: 0,
      target: 33,
      autoEnabled: false,
      totalIncrements: 0,
      completedCycles: 0,
    };
  }

  try {
    // Today's count may still sit under the old UTC-date key (one-time copy).
    migrateUtcDayKey(key);
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        count: 0,
        target: 33,
        autoEnabled: false,
        totalIncrements: 0,
        completedCycles: 0,
      };
    }
    const parsed = JSON.parse(raw) as TasbihState;
    if (!parsed || typeof parsed !== "object") {
      return {
        count: 0,
        target: 33,
        autoEnabled: false,
        totalIncrements: 0,
        completedCycles: 0,
      };
    }

    return {
      count:
        Number.isFinite(parsed.count) && parsed.count >= 0
          ? Math.floor(parsed.count)
          : 0,
      target:
        Number.isFinite(parsed.target) && parsed.target > 0
          ? Math.floor(parsed.target)
          : 33,
      autoEnabled: Boolean(parsed.autoEnabled),
      totalIncrements:
        Number.isFinite(parsed.totalIncrements) && parsed.totalIncrements >= 0
          ? Math.floor(parsed.totalIncrements)
          : 0,
      completedCycles:
        Number.isFinite(parsed.completedCycles) && parsed.completedCycles >= 0
          ? Math.floor(parsed.completedCycles)
          : 0,
    };
  } catch {
    return {
      count: 0,
      target: 33,
      autoEnabled: false,
      totalIncrements: 0,
      completedCycles: 0,
    };
  }
}

export function TasbihContent() {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const tTasbih = useTranslations("tasbih");
  const locale = useLocale();
  // The local day (live): at local midnight the counter switches to the new day's entry.
  const todayKey = `${STORAGE_KEY_PREFIX}${useLocalTodayISO()}`;
  // The stored count is read only after hydration (the server has none): reading it in the first render made the
  // server's 0 and the client's saved count differ (React #418).
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const storageKey = mounted ? todayKey : null;
  const initialState = useMemo(
    () => (storageKey ? readTasbihState(storageKey) : { count: 0, target: 33, autoEnabled: false, totalIncrements: 0, completedCycles: 0 }),
    [storageKey],
  );
  /** The key the state below was loaded from: it is only ever written back under this key. */
  const [loadedKey, setLoadedKey] = useState<string | null>(storageKey);
  const [count, setCount] = useState(initialState.count);
  const [target, setTarget] = useState(initialState.target);
  const [targetInput, setTargetInput] = useState(() => formatLocalizedNumber(initialState.target, locale));
  const [autoEnabled, setAutoEnabled] = useState(initialState.autoEnabled);
  const [totalIncrements, setTotalIncrements] = useState(initialState.totalIncrements);
  const [completedCycles, setCompletedCycles] = useState(initialState.completedCycles);

  // A new day: load its entry during this render (yesterday's count is never written under today's key).
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setCount(initialState.count);
    setTarget(initialState.target);
    setTargetInput(formatLocalizedNumber(initialState.target, locale));
    setAutoEnabled(initialState.autoEnabled);
    setTotalIncrements(initialState.totalIncrements);
    setCompletedCycles(initialState.completedCycles);
  }

  useEffect(() => {
    pruneLocalHistory("rp_tasbih_state_v1");
  }, [todayKey]);

  const percent = useMemo(() => {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((count / target) * 100));
  }, [count, target]);

  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    const payload: TasbihState = {
      count,
      target,
      autoEnabled,
      totalIncrements,
      completedCycles,
    };
    try {
      localStorage.setItem(todayKey, JSON.stringify(payload));
    } catch {
      // Best effort only
    }
  }, [autoEnabled, completedCycles, count, loadedKey, storageKey, target, todayKey, totalIncrements]);

  const incrementCount = useCallback((options?: { stopAtTarget?: boolean }) => {
    const stopAtTarget = options?.stopAtTarget ?? false;

    setCount((prev) => {
      if (stopAtTarget && target > 0 && prev >= target) {
        setAutoEnabled(false);
        return prev;
      }

      const next = prev + 1;
      if (target > 0 && prev < target && next >= target) {
        setCompletedCycles((c) => c + 1);
        track("tasbih_round");
      }
      setTotalIncrements((n) => n + 1);
      return next;
    });
  }, [target]);

  useEffect(() => {
    if (!autoEnabled) return;

    const timer = setInterval(() => {
      incrementCount({ stopAtTarget: true });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoEnabled, incrementCount]);

  const applyTargetInput = () => {
    // Either digit set ("৩৩" or "33").
    const parsed = parseLocalizedNumber(targetInput);
    // A target below one (e.g. 0.5) would floor to 0 and auto count would never stop.
    if (parsed === null || parsed < 1) return;
    setTarget(Math.floor(parsed));
  };

  const resetAll = () => {
    setCount(0);
    setAutoEnabled(initialState.autoEnabled);
    setTotalIncrements(0);
    setCompletedCycles(0);
  };

  const num = (n: number) => formatLocalizedNumber(n, locale);
  const reached = count >= target && target > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="space-y-1">
        <h1 className="rp-large-title text-rp-ink">{tNav("tasbih")}</h1>
        <p className="rp-small text-rp-muted">{tLanding("featureTasbihDesc")}</p>
      </div>

      {/* Target presets above the counter (Figma page 12, D8). */}
      <div role="group" aria-label={tTasbih("targetTitle")} className="flex flex-wrap gap-2">
        {TASBIH_PRESETS.map((preset) => (
          <Chip
            key={preset}
            selected={target === preset}
            className="h-11 min-w-14"
            onClick={() => {
              setTarget(preset);
              setTargetInput(num(preset));
            }}
          >
            {num(preset)}
          </Chip>
        ))}
      </div>

      {/* The whole card counts: one big target for the thumb, no aiming at a small button. */}
      <button
        type="button"
        onClick={() => incrementCount()}
        aria-label={tTasbih("tapToCount", { count: num(count), target: num(target) })}
        data-testid="tasbih-counter"
        className="rp-pressable flex w-full select-none flex-col items-center gap-3 rounded-rp-xl bg-rp-surface px-6 py-8 text-center shadow-rp-soft outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
      >
        <span className="rp-overline text-rp-muted">{tTasbih("currentCount")}</span>
        <span className="rp-display-l tabular-nums text-rp-accent" aria-live="polite">
          {num(count)}
        </span>
        <Progress value={percent} className="h-2 w-full" aria-hidden />
        <span className="rp-small text-rp-muted">
          {tTasbih("targetLabel", { target: num(target) })} · {tTasbih("percentComplete", { percent: num(percent) })}
        </span>
        {reached ? <span className="rp-row text-rp-accent">{tTasbih("targetReached")}</span> : null}
        <span className="rp-caption text-rp-muted">{tTasbih("tapHint")}</span>
      </button>

      <div className="flex justify-center gap-2">
        <Button type="button" variant="quiet" onClick={() => setCount((c) => Math.max(0, c - 1))}>
          -{num(1)}
        </Button>
        <Button type="button" variant="quiet" onClick={resetAll}>
          {tTasbih("reset")}
        </Button>
      </div>

      <section aria-labelledby="tasbih-settings" className="space-y-2">
        <h2 id="tasbih-settings" className="rp-caption px-4 text-rp-muted">
          {tTasbih("targetTitle")}
        </h2>
        <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
          <li className={cn(DIVIDER, "flex flex-wrap items-center gap-3 px-4 py-2")}>
            <label htmlFor="tasbih-target" className="rp-row basis-full text-rp-ink sm:basis-auto sm:flex-1">
              {tTasbih("setCustomTarget")}
            </label>
            <Input
              id="tasbih-target"
              inputMode="numeric"
              autoComplete="off"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className={cn(fieldClass, "h-11 min-w-0 flex-1 text-end sm:w-24 sm:flex-none")}
            />
            <Button type="button" variant="soft" onClick={applyTargetInput}>
              {tTasbih("applyTarget")}
            </Button>
          </li>
          <li className={cn(DIVIDER, "flex items-center gap-3 px-4 py-2")}>
            <span className="min-w-0 flex-1">
              <span className="rp-row block text-rp-ink">{tTasbih("autoCount")}</span>
              <span className="rp-caption block text-rp-muted">{tTasbih("autoCountHint")}</span>
            </span>
            <Switch
              checked={autoEnabled}
              disabled={reached && !autoEnabled}
              onCheckedChange={setAutoEnabled}
              aria-label={tTasbih("autoCount")}
            />
          </li>
        </ul>
      </section>

      <section aria-labelledby="tasbih-today" className="space-y-2">
        <h2 id="tasbih-today" className="rp-caption px-4 text-rp-muted">
          {tTasbih("todayTracking")}
        </h2>
        <dl className="overflow-hidden rounded-rp-md bg-rp-surface">
          <div className={cn(DIVIDER, "flex min-h-[52px] items-center justify-between gap-4 px-4")}>
            <dt className="rp-row text-rp-ink">{tTasbih("totalIncrements")}</dt>
            <dd className="rp-row tabular-nums text-rp-ink">{num(totalIncrements)}</dd>
          </div>
          <div className={cn(DIVIDER, "flex min-h-[52px] items-center justify-between gap-4 px-4")}>
            <dt className="rp-row text-rp-ink">{tTasbih("cyclesCompleted")}</dt>
            <dd className="rp-row tabular-nums text-rp-ink">{num(completedCycles)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
