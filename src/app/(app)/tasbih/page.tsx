"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function TasbihPage() {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const tTasbih = useTranslations("tasbih");
  const todayKey = useMemo(
    () => `${STORAGE_KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`,
    [],
  );
  const initialState = useMemo(() => readTasbihState(todayKey), [todayKey]);
  const [count, setCount] = useState(initialState.count);
  const [target, setTarget] = useState(initialState.target);
  const [targetInput, setTargetInput] = useState(String(initialState.target));
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
    const parsed = Number.parseInt(targetInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setTarget(parsed);
  };

  const resetAll = () => {
    setCount(0);
    setAutoEnabled(false);
    setTotalIncrements(0);
    setCompletedCycles(0);
  };

  return (
    <div className="space-y-4">
      <Card className="surface-soft border-primary/20">
        <CardHeader>
          <CardTitle>{tNav("tasbih")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {tLanding("featureTasbihDesc")}
          </p>

          <div className="rounded-xl border border-border/70 bg-background/60 p-4 sm:p-6 text-center space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {tTasbih("currentCount")}
            </p>
            <p className="text-5xl font-bold tabular-nums">{count}</p>
            <p className="text-sm text-muted-foreground">
              {tTasbih("targetLabel", { target })}
            </p>
            <Progress value={percent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {tTasbih("percentComplete", { percent })}
            </p>
            {count >= target && target > 0 ? (
              <p className="text-sm font-medium text-primary">
                {tTasbih("targetReached")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tasbih-target">{tTasbih("setCustomTarget")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="tasbih-target"
                type="number"
                min="1"
                inputMode="numeric"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="w-40"
              />
              <Button type="button" variant="outline" onClick={applyTargetInput}>
                {tTasbih("applyTarget")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {TASBIH_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={target === preset ? "default" : "outline"}
                onClick={() => {
                  setTarget(preset);
                  setTargetInput(String(preset));
                }}
              >
                {preset}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => incrementCount()}>
              +1
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCount((c) => Math.max(0, c - 1))}
            >
              -1
            </Button>
            <Button type="button" variant="ghost" onClick={resetAll}>
              {tTasbih("reset")}
            </Button>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">{tTasbih("autoCount")}</p>
              <p className="text-xs text-muted-foreground">
                {tTasbih("autoCountHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={autoEnabled ? "secondary" : "default"}
                onClick={() => setAutoEnabled((v) => !v)}
                disabled={count >= target && target > 0}
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
          </div>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <p className="text-sm font-medium">{tTasbih("todayTracking")}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">
                  {tTasbih("totalIncrements")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{totalIncrements}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">
                  {tTasbih("cyclesCompleted")}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{completedCycles}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
