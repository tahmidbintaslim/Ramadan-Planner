import { useLocale, useTranslations } from "@/i18n/use-intl";
import type { AnnouncementDTO } from "@/actions/announcements-schemas";

/** The localized title/body: English falls back to Bengali when an announcement has no English text. */
export function announcementText(a: AnnouncementDTO, locale: string) {
  const en = locale === "en";
  return { title: (en && a.titleEn) || a.titleBn, body: (en && a.bodyEn) || a.bodyBn };
}

/** /announcements: every active announcement, newest first (More → ঘোষণা). */
export function AnnouncementsPage({ items }: { items: AnnouncementDTO[] | null }) {
  const t = useTranslations("announcements");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "bn-BD", { dateStyle: "long", timeZone: "Asia/Dhaka" });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="rp-large-title text-rp-ink">{t("title")}</h1>
      {items === null ? (
        <p role="alert" className="rp-body text-rp-muted">{t("loadError")}</p>
      ) : items.length === 0 ? (
        <p className="rp-body rounded-rp-md bg-rp-surface p-5 text-rp-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const { title, body } = announcementText(a, locale);
            return (
              <li key={a.id} id={`a-${a.id}`} className="flex flex-col gap-2 rounded-rp-md bg-rp-surface p-5">
                <h2 className="rp-headline text-rp-ink">{title}</h2>
                <p className="rp-small text-rp-muted">{date.format(new Date(a.startAt))}</p>
                <p className="rp-body whitespace-pre-line text-rp-ink">{body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
