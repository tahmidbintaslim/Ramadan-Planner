"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGuestData, getTodayKey } from "@/hooks/use-guest-data";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { getDailyLogAction, saveDailyLogAction } from "@/actions/planner";
import { Badge } from "@/components/ui/badge";

interface QuranData {
  para: string;
  surah: string;
  ayah: string;
  pages: string;
}

interface LastReadSnapshot extends QuranData {
  day: number;
  updatedAt: string;
}

const LAST_READ_KEY = "rp_quran_last_read_v1";

export function QuranTracker({ day }: { day: number }) {
  const t = useTranslations("quran");
  const tToday = useTranslations("today");
  const { isGuest, loading } = useAuth();

  const { data: guestData, updateData, showPrompt, dismissPrompt } =
    useGuestData<QuranData>(getTodayKey("quran"), {
      para: "",
      surah: "",
      ayah: "",
      pages: "",
    });

  const [serverData, setServerData] = useState<QuranData>({
    para: "",
    surah: "",
    ayah: "",
    pages: "",
  });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [lastRead, setLastRead] = useState<LastReadSnapshot | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LAST_READ_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LastReadSnapshot;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.updatedAt === "string" &&
        typeof parsed.day === "number"
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const lastSavedPayloadRef = useRef("");
  const savedStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading || isGuest) return;

    const load = async () => {
      const res = await getDailyLogAction(day);
      if (res.ok && res.data) {
        setServerData(res.data.quran);
        lastSavedPayloadRef.current = JSON.stringify(res.data.quran);
      }
    };

    load();
  }, [day, isGuest, loading]);

  useEffect(() => {
    return () => {
      if (savedStateTimerRef.current) {
        clearTimeout(savedStateTimerRef.current);
      }
    };
  }, []);

  const persistLastRead = useCallback((payload: QuranData) => {
    const cleaned: LastReadSnapshot = {
      para: payload.para.trim(),
      surah: payload.surah.trim(),
      ayah: payload.ayah.trim(),
      pages: payload.pages.trim(),
      day,
      updatedAt: new Date().toISOString(),
    };

    if (!cleaned.para && !cleaned.surah && !cleaned.ayah && !cleaned.pages) {
      return;
    }

    setLastRead(cleaned);
    try {
      localStorage.setItem(LAST_READ_KEY, JSON.stringify(cleaned));
    } catch {
      // Best effort only
    }
  }, [day]);

  useEffect(() => {
    if (loading || isGuest || !dirty) return;

    const payload = JSON.stringify(serverData);

    const timeout = setTimeout(() => {
      const save = async () => {
        setSaveState("saving");
        const res = await saveDailyLogAction({ day, quran: serverData });
        if (res.ok) {
          lastSavedPayloadRef.current = payload;
          persistLastRead(serverData);
          setSaveState("saved");
          if (savedStateTimerRef.current) {
            clearTimeout(savedStateTimerRef.current);
          }
          savedStateTimerRef.current = setTimeout(
            () => setSaveState("idle"),
            1200,
          );
        } else {
          setSaveState("idle");
        }
        setDirty(false);
      };

      void save();
    }, 650);

    return () => clearTimeout(timeout);
  }, [day, dirty, isGuest, loading, persistLastRead, serverData]);

  const data = isGuest ? guestData : serverData;

  const paraNumber = useMemo(() => Number.parseInt(data.para || "0", 10), [data.para]);
  const pagesNumber = useMemo(() => Number.parseInt(data.pages || "0", 10), [data.pages]);
  const paraProgress = Number.isFinite(paraNumber)
    ? Math.max(0, Math.min(100, Math.round((paraNumber / 30) * 100)))
    : 0;

  const sanitizeNumeric = (value: string) => value.replace(/[^\d]/g, "");

  const updateField = (field: keyof QuranData, value: string) => {
    const nextValue =
      field === "para" || field === "ayah" || field === "pages"
        ? sanitizeNumeric(value)
        : value;

    if (isGuest) {
      if (data[field] === nextValue) return;
      const next = { ...data, [field]: nextValue };
      updateData(() => next);
      persistLastRead(next);
      return;
    }

    setServerData((prev) => {
      if (prev[field] === nextValue) return prev;
      return { ...prev, [field]: nextValue };
    });
    if (data[field] !== nextValue) {
      setDirty(true);
    }
  };

  const incrementNumberField = (
    field: Extract<keyof QuranData, "para" | "ayah" | "pages">,
    delta: number,
  ) => {
    const current = Number.parseInt(data[field] || "0", 10) || 0;
    const next = Math.max(0, current + delta);
    updateField(field, next === 0 ? "" : String(next));
  };

  const applyLastRead = () => {
    if (!lastRead) return;
    const nextData: QuranData = {
      para: lastRead.para ?? "",
      surah: lastRead.surah ?? "",
      ayah: lastRead.ayah ?? "",
      pages: lastRead.pages ?? "",
    };

    if (isGuest) {
      updateData(() => nextData);
      return;
    }

    setServerData(nextData);
    setDirty(true);
  };

  const clearToday = () => {
    const empty: QuranData = { para: "", surah: "", ayah: "", pages: "" };
    if (isGuest) {
      updateData(() => empty);
      return;
    }
    setServerData(empty);
    setDirty(true);
  };

  const activeSummary = data.surah.trim().length > 0
    ? `${t("surah")} ${data.surah}${data.ayah ? ` • ${t("ayah")} ${data.ayah}` : ""}`
    : data.para
      ? `${t("para")} ${data.para}`
      : t("activeSessionEmpty");

  return (
    <>
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{tToday("quranTracker")}</CardTitle>
            {!isGuest && (
              <Badge variant="outline">
                {saveState === "saving"
                  ? t("saveStatusSaving")
                  : saveState === "saved"
                    ? t("saveStatusSaved")
                    : t("saveStatusIdle")}
              </Badge>
            )}
          </div>
          <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("activeSessionTitle")}</span>
              {pagesNumber > 0 ? <span>{t("page")} {pagesNumber}</span> : null}
            </div>
            <p className="text-sm font-medium">{activeSummary}</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("progress")}</span>
                <span>{paraProgress}%</span>
              </div>
              <Progress value={paraProgress} />
            </div>
          </div>
          {lastRead ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border/80 bg-background/40 p-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{t("lastReadTitle")}</p>
                <p className="text-sm">
                  {lastRead.surah
                    ? `${t("surah")} ${lastRead.surah}${lastRead.ayah ? ` • ${t("ayah")} ${lastRead.ayah}` : ""}`
                    : `${t("para")} ${lastRead.para || "-"}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={applyLastRead}>
                {t("continueFromLast")}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="para" className="text-xs">
                {t("para")}
              </Label>
              <Input
                id="para"
                type="number"
                min="1"
                max="30"
                placeholder="1-30"
                value={data.para}
                onChange={(e) => updateField("para", e.target.value)}
                className="h-9"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => incrementNumberField("para", 1)}
                >
                  +1 {t("para")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="surah" className="text-xs">
                {t("surah")}
              </Label>
              <Input
                id="surah"
                placeholder={t("surah")}
                value={data.surah}
                onChange={(e) => updateField("surah", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ayah" className="text-xs">
                {t("ayah")}
              </Label>
              <Input
                id="ayah"
                type="number"
                min="1"
                placeholder="1"
                value={data.ayah}
                onChange={(e) => updateField("ayah", e.target.value)}
                className="h-9"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => incrementNumberField("ayah", 1)}
                >
                  +1 {t("ayah")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pages" className="text-xs">
                {t("page")}
              </Label>
              <Input
                id="pages"
                type="number"
                min="0"
                placeholder="0"
                value={data.pages}
                onChange={(e) => updateField("pages", e.target.value)}
                className="h-9"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => incrementNumberField("pages", 1)}
                >
                  +1 {t("page")}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={clearToday}>
              {t("clearToday")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
