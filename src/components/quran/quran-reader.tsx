"use client";

import { Fragment, useEffect, useState, useCallback, useRef } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import type { SurahDetail, QuranAyah, ReciterInfo } from "@/lib/quran";
import { cn } from "@/lib/utils";
import { writeLastRead } from "@/lib/quran-last-read";
import { formatLocalizedNumber } from "@/lib/locale-number";

interface QuranReaderProps {
  surahNumber: number;
  /** Server-rendered text (no audio); shown at once while the full surah (with audio) loads. */
  initialText?: SurahDetail | null;
}

// Default reciter id (Mishary Rashid Al Afasy)
const DEFAULT_RECITER = "1";

// Compact widths: an opaque mini-player docked on top of the tab bar (56px + 1px rule + safe area), full width, so it
// never floats over ayah text. Regular widths (side nav, no tab bar): an in-flow card. The wrapper's pb-32 keeps the
// last ayahs scrollable clear of the docked bar.
export const AUDIO_BAR_CLASS =
  "fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 mb-0 border-t border-rp-rule bg-rp-bar text-rp-ink regular:static regular:rounded-rp-lg regular:border-0 regular:bg-rp-surface regular:shadow-rp-soft";

export function QuranReader({ surahNumber, initialText = null }: QuranReaderProps) {
  const t = useTranslations("quranReader");
  const locale = useLocale();
  const showBengaliName = locale.startsWith("bn");
  const [surah, setSurah] = useState<SurahDetail | null>(initialText);
  const [loading, setLoading] = useState(initialText === null);
  const hasText = initialText !== null;
  const [error, setError] = useState<string | null>(null);

  // Text-to-Speech is temporarily disabled. Keeping variables commented
  // in place so we can re-enable quickly in future without removing code.
  // const [isSpeaking, setIsSpeaking] = useState(false);
  // const [currentAyah, setCurrentAyah] = useState<number | null>(null);
  // const [isPaused, setIsPaused] = useState(false);
  // const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ayahRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Audio recitation state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioAyah, setAudioAyah] = useState<number | null>(null);
  // Reciter selection
  const [reciters, setReciters] = useState<ReciterInfo[]>([]);
  const [selectedReciter, setSelectedReciter] =
    useState<string>(DEFAULT_RECITER);

  useEffect(() => {
    // Load available reciters for the selector
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/quran?reciters=true");
        if (!res.ok) return;
        const data: ReciterInfo[] = await res.json();
        if (mounted && Array.isArray(data)) setReciters(data);
      } catch {
        // ignore
      }
    })();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        // Single request – DB returns Arabic, English, Bengali, and audio
        const res = await fetch(`/api/quran?surah=${surahNumber}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error("Failed to load surah");
        const data: SurahDetail = await res.json();
        setSurah(data);
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    }
    // With server text on screen only the audio links are missing (fetched per reciter below).
    if (!hasText) load();
    return () => {
      mounted = false;
    };
  }, [surahNumber, t, hasText]);

  // Server text has no audio: fetch just the chosen reciter's links (a failure only leaves play disabled).
  useEffect(() => {
    if (!hasText) return;
    const controller = new AbortController();
    fetch(`/api/quran?surah=${surahNumber}&audioReciter=${encodeURIComponent(selectedReciter)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, QuranAyah["audio"][string] | null>>) : null))
      .then((links) => {
        if (!links) return;
        setSurah((prev) =>
          prev
            ? {
                ...prev,
                ayahs: prev.ayahs.map((a) => {
                  const entry = links[a.ayahNo];
                  return entry ? { ...a, audio: { ...a.audio, [selectedReciter]: entry } } : a;
                }),
              }
            : prev,
        );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [hasText, surahNumber, selectedReciter]);

  // Cleanup speech & audio on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
      setAudioAyah(null);
    };
  }, []);

  const scrollToAyah = useCallback((ayahNum: number) => {
    const el = ayahRefs.current.get(ayahNum);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Remember where the reader is, on this device only, and only on real progress: the ayah being recited, or the
  // furthest-down ayah in view once the reader has scrolled. Merely opening a surah never overwrites the saved
  // position. The Quran list's "last read" card reads this.
  const surahLoaded = surah !== null;
  useEffect(() => {
    if (!surahLoaded || typeof IntersectionObserver === "undefined") return;
    let scrolled = false;
    const onScroll = () => {
      scrolled = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!scrolled) return;
        let best = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const n = Number(e.target.id.replace("ayah-", ""));
          if (Number.isInteger(n) && n > best) best = n;
        }
        if (best > 0) writeLastRead({ surah: surahNumber, ayah: best });
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll('[id^="ayah-"]').forEach((el) => observer.observe(el));
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [surahLoaded, surahNumber]);
  useEffect(() => {
    if (audioAyah !== null) writeLastRead({ surah: surahNumber, ayah: audioAyah });
  }, [audioAyah, surahNumber]);

  // "#ayah-N" (from the last-read card) scrolls to that ayah once the surah has rendered.
  useEffect(() => {
    if (!surahLoaded) return;
    const m = /^#ayah-(\d+)$/.exec(window.location.hash);
    if (m) scrollToAyah(Number(m[1]));
  }, [surahLoaded, scrollToAyah]);

  // Text-to-Speech implementation temporarily removed from runtime.
  // To re-enable, uncomment the state above and the functions below.
  /*
  // ── Text-to-Speech (browser) ──────────────────────────
  const speakAyah = useCallback((ayah: QuranAyah) => { ... }, [surah, scrollToAyah]);
  const stopSpeaking = useCallback(() => { ... }, []);
  const togglePause = useCallback(() => { ... }, [isPaused]);
  const startFromBeginning = useCallback(() => { ... }, [surah, speakAyah]);
  */

  // ── Audio recitation (from DB audio URLs) ──────────────
  const playAudioAyah = useCallback(
    (ayah: QuranAyah, reciterId: string = selectedReciter) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Pick the selected reciter's audio, fall back to default or any available reciter
      const audioEntry =
        ayah.audio[reciterId] ??
        ayah.audio[DEFAULT_RECITER] ??
        Object.values(ayah.audio)[0];

      if (!audioEntry) return; // No audio available

      // Prefer originalUrl, fall back to url
      const audioUrl = audioEntry.originalUrl || audioEntry.url;
      const audio = new Audio(audioUrl);
      audio.muted = isAudioMuted;
      audioRef.current = audio;
      setAudioAyah(ayah.ayahNo);
      setIsPlayingAudio(true);
      setIsAudioPaused(false);
      scrollToAyah(ayah.ayahNo);

      audio.onended = () => {
        // Auto-advance
        if (surah) {
          const nextAyah = surah.ayahs.find(
            (a) => a.ayahNo === ayah.ayahNo + 1,
          );
          if (nextAyah) {
            playAudioAyah(nextAyah);
          } else {
            setIsPlayingAudio(false);
            setIsAudioPaused(false);
            setAudioAyah(null);
          }
        }
      };

      audio.onpause = () => {
        if (!audio.ended) {
          setIsPlayingAudio(false);
          setIsAudioPaused(true);
        }
      };

      audio.onplay = () => {
        setIsPlayingAudio(true);
        setIsAudioPaused(false);
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
        setAudioAyah(null);
      };

      void audio.play();
    },
    [surah, scrollToAyah, selectedReciter, isAudioMuted],
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
    setAudioAyah(null);
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resumeAudio = useCallback(async () => {
    if (audioRef.current && audioRef.current.paused) {
      try {
        await audioRef.current.play();
      } catch {
        // Ignore autoplay/security failures
      }
    }
  }, []);

  const toggleAudioMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const toggleAyahPlayback = useCallback(
    (ayah: QuranAyah) => {
      const isCurrentAyah = audioAyah === ayah.ayahNo;

      if (isCurrentAyah && isPlayingAudio) {
        pauseAudio();
        return;
      }

      if (isCurrentAyah && isAudioPaused) {
        void resumeAudio();
        return;
      }

      playAudioAyah(ayah);
    },
    [
      audioAyah,
      isPlayingAudio,
      isAudioPaused,
      pauseAudio,
      resumeAudio,
      playAudioAyah,
    ],
  );

  const handleReciterChange = useCallback(
    (nextReciter: string) => {
      setSelectedReciter(nextReciter);

      if (!surah || audioAyah === null) return;
      if (!isPlayingAudio && !isAudioPaused) return;

      const ayah = surah.ayahs.find((item) => item.ayahNo === audioAyah);
      if (!ayah) return;

      playAudioAyah(ayah, nextReciter);
    },
    [surah, audioAyah, isPlayingAudio, isAudioPaused, playAudioAyah],
  );

  // ── Render ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !surah) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-destructive">{error || t("loadError")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-32 regular:pb-0">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="self-start">
          <Link href="/quran" aria-label={t("allSurahs")}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
        <div className="text-center min-w-0 w-full">
          <h1 className="rp-h1">
            {showBengaliName
              ? (surah.nameBengali || surah.nameEnglish)
              : surah.nameEnglish}
          </h1>
          <p className="font-quran text-[24px] leading-[48px]" dir="rtl" lang="ar">
            {surah.nameArabicLong || surah.nameArabic}
          </p>
          <p className="text-sm text-muted-foreground">
            {surah.nameEnglish} — {surah.nameTranslation}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">
              {formatLocalizedNumber(surah.totalAyah, locale)} {t("ayahs")}
            </Badge>
            <Badge variant="outline">
              {surah.revelationPlace === "Mecca" ? t("meccan") : t("medinan")}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3"
                  aria-haspopup="listbox"
                >
                  <span className="hidden sm:inline">{t("reciter")}:</span>
                  <span className="inline-block align-middle">
                    {reciters.find((r) => String(r.id) === selectedReciter)
                      ?.name ?? "Mishary Rashid Al Afasy"}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[min(95vw,18rem)] sm:w-72"
              >
                <DropdownMenuLabel>{t("reciter")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={selectedReciter}
                  onValueChange={handleReciterChange}
                >
                  {(reciters.length > 0
                    ? reciters
                    : [
                        {
                          id: Number(DEFAULT_RECITER),
                          name: "Mishary Rashid Al Afasy",
                        },
                      ]
                  ).map((reciter) => (
                    <DropdownMenuRadioItem
                      key={reciter.id}
                      value={String(reciter.id)}
                    >
                      {reciter.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Audio controls (mobile-friendly) */}
      <div data-quran-audio-bar="" className={AUDIO_BAR_CLASS}>
        <CardContent className="mx-auto w-full max-w-3xl py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2">
              {!isPlayingAudio && !isAudioPaused ? (
                <Button
                  size="sm"
                  className="sm:inline-flex w-full sm:w-auto"
                  onClick={() => {
                    if (surah.ayahs.length > 0) {
                      playAudioAyah(surah.ayahs[0]);
                    }
                  }}
                  aria-label={t("listenRecitation")}
                  title={t("listenRecitation")}
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  {t("listenRecitation")}
                </Button>
              ) : (
                <>
                  {isPlayingAudio ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={pauseAudio}
                      className="sm:inline-flex"
                      aria-label={t("pause")}
                      title={t("pause")}
                    >
                      <Pause className="h-4 w-4 mr-1.5" />
                      {t("pause")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={resumeAudio}
                      className="sm:inline-flex"
                      aria-label={t("resume")}
                      title={t("resume")}
                    >
                      <Play className="h-4 w-4 mr-1.5" />
                      {t("resume")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={stopAudio}
                    className="sm:inline-flex"
                    aria-label={t("stopAudio")}
                    title={t("stopAudio")}
                  >
                    <Square className="h-4 w-4 mr-1.5" />
                    {t("stopAudio")}
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Separator
                orientation="vertical"
                className="h-6 hidden sm:block"
              />

              <Button
                size="icon"
                variant="outline"
                onClick={toggleAudioMute}
                aria-pressed={isAudioMuted}
                title={isAudioMuted ? t("unmute") : t("mute")}
                className="h-10 w-10 sm:h-7 sm:w-7"
              >
                {isAudioMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
                <span className="sr-only">
                  {isAudioMuted ? t("unmute") : t("mute")}
                </span>
              </Button>
            </div>
          </div>

          {(audioAyah !== null || isAudioPaused) && (
            <div
              className="mt-2 text-center sm:text-left text-xs text-muted-foreground overflow-hidden"
              aria-live="polite"
            >
              {isPlayingAudio ? (
                <>
                  <span className="font-medium mr-1">
                    {t("nowPlaying")}:
                  </span>
                  <span className="inline-block max-w-[60%] sm:max-w-[70%] align-middle overflow-hidden truncate">
                    {formatLocalizedNumber(audioAyah ?? 0, locale)} —{" "}
                    {reciters.find((r) => String(r.id) === selectedReciter)
                      ?.name ?? "Mishary Rashid Al Afasy"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium mr-1">
                    {t("paused")}:
                  </span>
                  <span className="inline-block max-w-[60%] sm:max-w-[70%] align-middle overflow-hidden truncate">
                    {formatLocalizedNumber(audioAyah ?? 0, locale)} —{" "}
                    {reciters.find((r) => String(r.id) === selectedReciter)
                      ?.name ?? "Mishary Rashid Al Afasy"}
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </div>

      {/* Bismillah (for all surahs except At-Tawba #9) */}
      {surahNumber !== 9 && surahNumber !== 1 && (
        <div className="text-center py-4">
          <p className="font-quran text-[28px] leading-[56px] text-primary" dir="rtl" lang="ar">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </p>
          <p className="text-sm text-muted-foreground mt-1">{t("bismillah")}</p>
        </div>
      )}

      {/* Ayahs */}
      <div className="space-y-3">
        {surah.ayahs.map((ayah) => {
          const isActive = audioAyah === ayah.ayahNo;

          return (
            <Card
              key={ayah.ayahNo}
              id={`ayah-${ayah.ayahNo}`}
              ref={(el) => {
                if (el) ayahRefs.current.set(ayah.ayahNo, el);
              }}
              className={cn(
                "transition-all duration-300",
                isActive && "ring-2 ring-primary bg-accent/50",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {formatLocalizedNumber(ayah.ayahNo, locale)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {/* Play audio for this ayah */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleAyahPlayback(ayah)}
                      aria-label={t("playAyah")}
                    >
                      {audioAyah === ayah.ayahNo && isPlayingAudio ? (
                        <Pause className="h-3.5 w-3.5 text-primary" />
                      ) : audioAyah === ayah.ayahNo && isAudioPaused ? (
                        <Play className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {/* TTS for this ayah (hidden). To re-enable, uncomment the button below. */}
                    {/*
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled
                      aria-label={t("speakAyah")}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </Button>
                    */}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Arabic text */}
                <p
                  className="font-quran text-right text-[28px] leading-[56px] [overflow-wrap:anywhere]"
                  dir="rtl"
                  lang="ar"
                >
                  {ayah.textArabic}
                </p>

                {/* Translations: the UI language first (#31). */}
                {(showBengaliName
                  ? ([
                      ["bn", ayah.textBengali],
                      ["en", ayah.textEnglish],
                    ] as const)
                  : ([
                      ["en", ayah.textEnglish],
                      ["bn", ayah.textBengali],
                    ] as const)
                ).map(([lang, text], i) =>
                  text ? (
                    <Fragment key={lang}>
                      <Separator />
                      <p lang={lang} className={cn("[overflow-wrap:anywhere]", i === 0 ? "rp-reading text-rp-ink" : "rp-reading-small text-rp-muted")}>
                        {text}
                      </p>
                    </Fragment>
                  ) : null,
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-6">
        {surahNumber > 1 ? (
          <Button variant="outline" asChild>
            <Link href={`/quran/${surahNumber - 1}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("previousSurah")}
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <Button variant="ghost" asChild>
          <Link href="/quran">
            <BookOpen className="h-4 w-4 mr-1.5" />
            {t("allSurahs")}
          </Link>
        </Button>

        {surahNumber < 114 ? (
          <Button variant="outline" asChild>
            <Link href={`/quran/${surahNumber + 1}`}>
              {t("nextSurah")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
