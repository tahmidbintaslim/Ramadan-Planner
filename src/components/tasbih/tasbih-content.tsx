"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Input, fieldClass } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/locale-number";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pruneLocalHistory } from "@/lib/local-history";

const TASBIH_PRESETS = [33, 99, 100];
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
  const todayKey = useMemo(
    () => `${STORAGE_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`,
    [],
  );
  const initialState = useMemo(() => readTasbihState(todayKey), [todayKey]);
  const [count, setCount] = useState(initialState.count);
  const [target, setTarget] = useState(initialState.target);
  const [targetInput, setTargetInput] = useState(() => formatLocalizedNumber(initialState.target, locale));
  const [autoEnabled, setAutoEnabled] = useState(initialState.autoEnabled);
  const [totalIncrements, setTotalIncrements] = useState(initialState.totalIncrements);
  const [completedCycles, setCompletedCycles] = useState(initialState.completedCycles);

  useEffect(() => {
    pruneLocalHistory("rp_tasbih_state_v1", 7);
  }, []);

  const percent = useMemo(() => {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((count / target) * 100));
  }, [count, target]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [autoEnabled, completedCycles, count, target, todayKey, totalIncrements]);

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
    setAutoEnabled(false);
    setTotalIncrements(0);
    setCompletedCycles(0);
  };

  const num = (n: number) => formatLocalizedNumber(n, locale);
  const reached = count >= target && target > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="space-y-1">
        <h1 className="rp-h1 text-rp-ink">{tNav("tasbih")}</h1>
        <p className="rp-small text-rp-muted">{tLanding("featureTasbihDesc")}</p>
      </div>

      <Card className="items-center gap-4 px-5 text-center" data-testid="tasbih-counter">
        <p className="rp-overline text-rp-muted">{tTasbih("currentCount")}</p>
        <p className="rp-time-xl tabular-nums text-rp-ink" aria-live="polite">
          {num(count)}
        </p>
        <p className="rp-small text-rp-muted">{tTasbih("targetLabel", { target: num(target) })}</p>
        <Progress value={percent} className="h-2 w-full" aria-label={tTasbih("currentCount")} />
        <p className="rp-caption text-rp-muted">{tTasbih("percentComplete", { percent: num(percent) })}</p>
        {reached ? <p className="rp-row text-rp-accent">{tTasbih("targetReached")}</p> : null}
        <div className="grid w-full grid-cols-[2fr_1fr] gap-2">
          <Button type="button" size="lg" onClick={() => incrementCount()}>
            +{num(1)}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setCount((c) => Math.max(0, c - 1))}
          >
            -{num(1)}
          </Button>
        </div>
        <Button type="button" variant="quiet" onClick={resetAll}>
          {tTasbih("reset")}
        </Button>
      </Card>

      <Card className="px-5">
        <h2 className="rp-h2 text-rp-ink">{tTasbih("targetTitle")}</h2>
        <div role="group" aria-label={tTasbih("targetTitle")} className="flex flex-wrap gap-2">
          {TASBIH_PRESETS.map((preset) => (
            <Chip
              key={preset}
              selected={target === preset}
              className="h-12 min-w-16"
              onClick={() => {
                setTarget(preset);
                setTargetInput(num(preset));
              }}
            >
              {num(preset)}
            </Chip>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tasbih-target" className="rp-small text-rp-ink">
            {tTasbih("setCustomTarget")}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="tasbih-target"
              inputMode="numeric"
              autoComplete="off"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className={cn(fieldClass, "w-40")}
            />
            <Button type="button" variant="soft" onClick={applyTargetInput}>
              {tTasbih("applyTarget")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="rp-h2 text-rp-ink">{tTasbih("autoCount")}</h2>
          <p className="rp-caption text-rp-muted">{tTasbih("autoCountHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={autoEnabled ? "soft" : "default"}
            onClick={() => setAutoEnabled((v) => !v)}
            disabled={reached}
          >
            {autoEnabled ? tTasbih("pauseAuto") : tTasbih("startAuto")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCount(0);
              setAutoEnabled(true);
            }}
          >
            {tTasbih("restartAuto")}
          </Button>
        </div>
      </Card>

      <Card className="px-5">
        <h2 className="rp-h2 text-rp-ink">{tTasbih("todayTracking")}</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-rp-md bg-rp-accent-tint p-4">
            <dt className="rp-caption text-rp-muted">{tTasbih("totalIncrements")}</dt>
            <dd className="rp-time-l tabular-nums text-rp-ink">{num(totalIncrements)}</dd>
          </div>
          <div className="rounded-rp-md bg-rp-accent-tint p-4">
            <dt className="rp-caption text-rp-muted">{tTasbih("cyclesCompleted")}</dt>
            <dd className="rp-time-l tabular-nums text-rp-ink">{num(completedCycles)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
