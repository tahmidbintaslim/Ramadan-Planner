"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";

interface AnnouncementItem {
  id: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
}

export function AnnouncementsStrip() {
  const t = useTranslations("announcements");
  const locale = useLocale();
  const [items, setItems] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/announcements", { cache: "no-store" });
        if (!res.ok) return;

        const json = (await res.json()) as { ok?: boolean; data?: AnnouncementItem[] };
        if (json.ok && Array.isArray(json.data)) {
          setItems(json.data.slice(0, 2));
        }
      } catch {
        // Ignore announcement errors on dashboard
      }
    };

    load();
  }, []);

  if (items.length === 0) {
    return null;
  }

  const isEnglish = locale === "en";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 space-y-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">
          {t("title")}
        </p>
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <p className="text-sm font-medium">
              {isEnglish ? item.titleEn || item.titleBn : item.titleBn}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEnglish ? item.bodyEn || item.bodyBn : item.bodyBn}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
