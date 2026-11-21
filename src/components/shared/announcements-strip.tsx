"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import type { AnnouncementDTO } from "@/actions/announcements-schemas";
import { announcementText } from "@/components/announcements/announcements-page";

export const DISMISSED_ANNOUNCEMENTS_KEY = "rp_announcements_dismissed";

function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Today: one line for the newest active announcement the visitor has not closed, linking to /announcements.
 * Nothing renders while loading, on error or when there is nothing new.
 */
export function AnnouncementsStrip() {
  const t = useTranslations("announcements");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [item, setItem] = useState<AnnouncementDTO | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/announcements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { ok?: boolean; data?: AnnouncementDTO[] } | null) => {
        if (!live || !json?.ok || !Array.isArray(json.data)) return;
        const dismissed = readDismissed();
        setItem(json.data.find((a) => !dismissed.includes(a.id)) ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!item) return null;
  const close = () => {
    try {
      // Keep the last 20 closed ids: old announcements expire on their own.
      localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify([item.id, ...readDismissed()].slice(0, 20)));
    } catch {
      // Storage off: the notice hides for this visit only.
    }
    setItem(null);
  };

  return (
    <aside
      aria-label={t("title")}
      data-testid="announcement-notice"
      className="rp-pop mb-3 flex items-center gap-3 rounded-rp-md bg-rp-accent-tint py-1 pe-1 ps-4 text-rp-ink"
    >
      <Megaphone size={20} aria-hidden className="shrink-0 text-rp-accent" />
      <Link href={`/announcements#a-${item.id}`} className="rp-row min-h-11 min-w-0 flex-1 content-center truncate font-semibold">
        {announcementText(item, locale).title}
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label={tCommon("close")}
        className="flex size-11 shrink-0 items-center justify-center rounded-rp-full text-rp-muted hover:bg-rp-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
      >
        <X size={20} aria-hidden />
      </button>
    </aside>
  );
}
