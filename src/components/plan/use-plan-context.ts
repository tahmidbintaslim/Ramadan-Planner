import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { RamadanTimetable } from "@/lib/ramadan-timetable";
import { useLocalTodayISO } from "@/hooks/use-local-day";
import { paraFromText, quranStreak } from "./plan-logic";

// Data the plan screen reads from elsewhere in the app: the Ramadan timetable (night times and odd-night rows),
// and the Quran tracker's progress (para and streak, from its localStorage entries).

/** The Ramadan timetable for the device time zone (same public API as the timetable screen). */
export function usePlanTimetable(enabled: boolean): { timetable: RamadanTimetable | null; failed: boolean } {
  const [timetable, setTimetable] = useState<RamadanTimetable | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let tz = "Asia/Dhaka";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
    } catch {
      // Keep the default zone.
    }
    fetch(`/api/ramadan-timetable?${new URLSearchParams({ tz })}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<RamadanTimetable>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (Array.isArray(data?.days)) setTimetable(data);
        else setFailed(true);
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [enabled]);
  return { timetable, failed };
}

// ── Quran tracker progress ──

const QURAN_LAST_READ_KEY = "rp_quran_last_read_v1";
// The tracker's per-day entries: rp_quran_<YYYY-MM-DD> (the local date, see local-day.ts), kept for 7 days.
const DAY_KEY = /^rp_quran_(\d{4}-\d{2}-\d{2})$/;

function hasQuranEntry(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return ["para", "surah", "ayah", "pages"].some((k) => typeof v?.[k] === "string" && (v[k] as string).trim() !== "");
  } catch {
    return false;
  }
}

/** A snapshot string of the Quran entries (changes when any of them does). */
function readQuranSnapshot(): string {
  try {
    const parts: string[] = [localStorage.getItem(QURAN_LAST_READ_KEY) ?? ""];
    const days: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      const m = key ? DAY_KEY.exec(key) : null;
      if (m && hasQuranEntry(localStorage.getItem(key!))) days.push(m[1]);
    }
    parts.push(days.sort().join(","));
    return parts.join("\n");
  } catch {
    return "";
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("rp-tracker-updated", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("rp-tracker-updated", onChange);
  };
}

/** Para (1-30) of the last Quran reading and the day streak; null/0 until known (and on the server). */
export function useQuranProgress(): { para: number | null; streak: number } {
  const snapshot = useSyncExternalStore(subscribeStorage, readQuranSnapshot, () => "");
  const todayISO = useLocalTodayISO();
  return useMemo(() => {
    if (!snapshot) return { para: null, streak: 0 };
    const [lastRaw, daysRaw = ""] = snapshot.split("\n");
    let para: number | null = null;
    try {
      para = lastRaw ? paraFromText((JSON.parse(lastRaw) as { para?: unknown }).para) : null;
    } catch {
      para = null;
    }
    const days = new Set(daysRaw ? daysRaw.split(",") : []);
    return { para, streak: quranStreak(todayISO, (iso) => days.has(iso)) };
  }, [snapshot, todayISO]);
}
