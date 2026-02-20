"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface HadithAudioControlsProps {
  arabicText?: string | null;
  fallbackText?: string | null;
}

export function HadithAudioControls({
  arabicText,
  fallbackText,
}: HadithAudioControlsProps) {
  const t = useTranslations("hadith");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
    };
  }, []);

  const stop = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
  };

  const listen = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const text = (arabicText?.trim() || fallbackText?.trim() || "").trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    utterance.lang = hasArabic ? "ar-SA" : "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = isMuted ? 0 : 1;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };
    utterance.onpause = () => {
      setIsPlaying(false);
      setIsPaused(true);
    };
    utterance.onresume = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
  };

  const resume = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (utteranceRef.current) utteranceRef.current.volume = next ? 0 : 1;
      return next;
    });
  };

  if (!speechSupported) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      {!isPlaying && !isPaused ? (
        <Button size="sm" onClick={listen}>
          <Play className="h-4 w-4 mr-1.5" />
          {t("listenHadith")}
        </Button>
      ) : isPaused ? (
        <>
          <Button size="sm" onClick={resume}>
            <Play className="h-4 w-4 mr-1.5" />
            {t("resume")}
          </Button>
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-4 w-4 mr-1.5" />
            {t("stopAudio")}
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={pause}>
            <Pause className="h-4 w-4 mr-1.5" />
            {t("pause")}
          </Button>
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-4 w-4 mr-1.5" />
            {t("stopAudio")}
          </Button>
        </>
      )}

      <Button size="sm" variant="outline" onClick={toggleMute}>
        {isMuted ? (
          <VolumeX className="h-4 w-4 mr-1.5" />
        ) : (
          <Volume2 className="h-4 w-4 mr-1.5" />
        )}
        {isMuted ? t("unmute") : t("mute")}
      </Button>
    </div>
  );
}
