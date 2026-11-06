"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, fieldClass } from "@/components/ui/input";
import { localizeAsciiDigits, toAsciiDigits } from "@/lib/locale-number";
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
  const locale = useLocale();
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

  // Either digit set is accepted; the stored value is ASCII digits.
  const sanitizeNumeric = (value: string) => toAsciiDigits(value).replace(/[^0-9]/g, "");
  const num = (v: number | string) => localizeAsciiDigits(String(v), locale);

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
    ? `${t("surah")} ${data.surah}${data.ayah ? ` • ${t("ayah")} ${localizeAsciiDigits(data.ayah, locale)}` : ""}`
    : data.para
      ? `${t("para")} ${localizeAsciiDigits(data.para, locale)}`
      : t("activeSessionEmpty");

  return (
    <>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="rp-h2 text-rp-ink">{tToday("quranTracker")}</h3>
            {!isGuest && (
              <Badge variant="outline" aria-live="polite">
                {saveState === "saving"
                  ? t("saveStatusSaving")
                  : saveState === "saved"
                    ? t("saveStatusSaved")
                    : t("saveStatusIdle")}
              </Badge>
            )}
          </div>
          <div className="space-y-2 rounded-rp-md bg-rp-page p-4">
            <div className="rp-caption flex items-center justify-between gap-2 text-rp-muted">
              <span>{t("activeSessionTitle")}</span>
              {pagesNumber > 0 ? <span>{t("page")} {num(pagesNumber)}</span> : null}
            </div>
            <p className="rp-row text-rp-ink">{activeSummary}</p>
            <div className="space-y-1.5">
              <div className="rp-caption flex items-center justify-between text-rp-muted">
                <span>{t("progress")}</span>
                <span>{num(paraProgress)}%</span>
              </div>
              <Progress value={paraProgress} aria-label={t("progress")} />
            </div>
          </div>
          {lastRead ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-rp-md border border-dashed border-rp-rule p-4">
              <div className="space-y-0.5">
                <p className="rp-caption text-rp-muted">{t("lastReadTitle")}</p>
                <p className="rp-small text-rp-ink">
                  {lastRead.surah
                    ? `${t("surah")} ${lastRead.surah}${lastRead.ayah ? ` • ${t("ayah")} ${num(lastRead.ayah)}` : ""}`
                    : `${t("para")} ${lastRead.para ? num(lastRead.para) : "-"}`}
                </p>
              </div>
              <Button variant="soft" onClick={applyLastRead}>
                {t("continueFromLast")}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="para" className="rp-small text-rp-ink">
                {t("para")}
              </Label>
              <Input
                id="para"
                inputMode="numeric"
                autoComplete="off"
                placeholder={`${num(1)}-${num(30)}`}
                value={num(data.para)}
                onChange={(e) => updateField("para", e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => incrementNumberField("para", 1)}
                >
                  +{num(1)} {t("para")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="surah" className="rp-small text-rp-ink">
                {t("surah")}
              </Label>
              <Input
                id="surah"
                placeholder={t("surah")}
                value={data.surah}
                onChange={(e) => updateField("surah", e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ayah" className="rp-small text-rp-ink">
                {t("ayah")}
              </Label>
              <Input
                id="ayah"
                inputMode="numeric"
                autoComplete="off"
                placeholder={num(1)}
                value={num(data.ayah)}
                onChange={(e) => updateField("ayah", e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => incrementNumberField("ayah", 1)}
                >
                  +{num(1)} {t("ayah")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pages" className="rp-small text-rp-ink">
                {t("page")}
              </Label>
              <Input
                id="pages"
                inputMode="numeric"
                autoComplete="off"
                placeholder={num(0)}
                value={num(data.pages)}
                onChange={(e) => updateField("pages", e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => incrementNumberField("pages", 1)}
                >
                  +{num(1)} {t("page")}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="quiet" onClick={clearToday}>
              {t("clearToday")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
