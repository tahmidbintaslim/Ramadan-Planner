"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, fieldClass } from "@/components/ui/input";
import { localizeAsciiDigits, toAsciiDigits } from "@/lib/locale-number";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGuestData } from "@/hooks/use-guest-data";
import { useLocalDayKey, useLocalTodayISO } from "@/hooks/use-local-day";
import { SignupPrompt } from "@/components/shared/signup-prompt";
import { useAuth } from "@/components/providers/auth-provider";
import { saveDailyLogAction } from "@/actions/planner";
import { Badge } from "@/components/ui/badge";
import { useServerDailyLogField } from "./use-server-daily-log";
import { TrackerError } from "./tracker-error";

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
const subscribeNoop = () => () => {};

function readStoredLastRead(): string | null {
  try {
    return localStorage.getItem(LAST_READ_KEY);
  } catch {
    return null;
  }
}

function parseLastRead(raw: string | null): LastReadSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastReadSnapshot;
    return parsed && typeof parsed === "object" && typeof parsed.updatedAt === "string" && typeof parsed.day === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}
const EMPTY_QURAN: QuranData = { para: "", surah: "", ayah: "", pages: "" };
const pickQuran = (log: { quran: QuranData } | null): QuranData => log?.quran ?? EMPTY_QURAN;

export function QuranTracker({ day }: { day: number }) {
  const t = useTranslations("quran");
  const tToday = useTranslations("today");
  const locale = useLocale();
  const { isGuest, loading } = useAuth();
  const todayISO = useLocalTodayISO();

  const { data: guestData, updateData, showPrompt, dismissPrompt } =
    useGuestData<QuranData>(useLocalDayKey("quran"), EMPTY_QURAN);

  const signedIn = !loading && !isGuest;
  const server = useServerDailyLogField(day, todayISO, signedIn, pickQuran);
  const serverData = server.value ?? EMPTY_QURAN;
  const setServerData = server.setValue;
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  // Read after hydration only (the server has no localStorage): reading it in a state initializer made the server
  // and client HTML differ for anyone with saved progress (React #418).
  const storedLastRead = useSyncExternalStore(subscribeNoop, readStoredLastRead, () => null);
  const [savedLastRead, setLastRead] = useState<LastReadSnapshot | null>(null);
  const lastRead = useMemo(() => savedLastRead ?? parseLastRead(storedLastRead), [savedLastRead, storedLastRead]);
  const latestRef = useRef(serverData);
  const savedStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestRef.current = serverData;
  }, [serverData]);

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
    if (!signedIn || !dirty || server.value === null) return;

    const snapshot = serverData;
    const payload = JSON.stringify(snapshot);

    const timeout = setTimeout(() => {
      const save = async () => {
        setSaveState("saving");
        let ok = false;
        try {
          ok = (await saveDailyLogAction({ day, logDate: todayISO, quran: snapshot })).ok;
        } catch {
          ok = false;
        }
        // Typed text is never thrown away: a failed save keeps the entry (marked unsaved, retried on the next edit).
        if (ok) {
          persistLastRead(snapshot);
          setSaveFailed(false);
          setSaveState("saved");
          if (savedStateTimerRef.current) {
            clearTimeout(savedStateTimerRef.current);
          }
          savedStateTimerRef.current = setTimeout(
            () => setSaveState("idle"),
            1200,
          );
        } else {
          setSaveFailed(true);
          setSaveState("idle");
        }
        // Edits made while the request was in flight still need saving.
        if (JSON.stringify(latestRef.current) === payload) setDirty(false);
      };

      void save();
    }, 650);

    return () => clearTimeout(timeout);
  }, [day, dirty, signedIn, persistLastRead, serverData, server.value, todayISO]);

  const data = isGuest ? guestData : serverData;
  // Signed in: editing waits for the day's log (an edit before it would save over the stored entry).
  const locked = !isGuest && server.value === null;

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

    if (locked || data[field] === nextValue) return;
    setServerData((prev) => ({ ...prev, [field]: nextValue }));
    setDirty(true);
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

    if (locked) return;
    setServerData(() => nextData);
    setDirty(true);
  };

  const clearToday = () => {
    if (isGuest) {
      updateData(() => EMPTY_QURAN);
      return;
    }
    if (locked) return;
    setServerData(() => EMPTY_QURAN);
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
            <h2 className="rp-h2 text-rp-ink">{tToday("quranTracker")}</h2>
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
              <Button variant="soft" onClick={applyLastRead} disabled={locked}>
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
                disabled={locked}
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
                  disabled={locked}
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
                disabled={locked}
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
                disabled={locked}
                id="ayah"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("ayah")}
                value={num(data.ayah)}
                onChange={(e) => updateField("ayah", e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => incrementNumberField("ayah", 1)}
                  disabled={locked}
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
                disabled={locked}
                id="pages"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("page")}
                value={num(data.pages)}
                onChange={(e) => updateField("pages", e.target.value)}
                className={fieldClass}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => incrementNumberField("pages", 1)}
                  disabled={locked}
                >
                  +{num(1)} {t("page")}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="quiet" onClick={clearToday} disabled={locked}>
              {t("clearToday")}
            </Button>
          </div>
          <TrackerError loadFailed={server.loadFailed} saveFailed={saveFailed} />
        </CardContent>
      </Card>
      <SignupPrompt open={showPrompt} onClose={dismissPrompt} />
    </>
  );
}
