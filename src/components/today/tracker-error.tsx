import { useTranslations } from "@/i18n/use-intl";

/** The trackers' error line (same pattern as the plan's): a failed first load, or a save that was rolled back. */
export function TrackerError({ loadFailed, saveFailed }: { loadFailed: boolean; saveFailed: boolean }) {
  const t = useTranslations("today");
  if (!loadFailed && !saveFailed) return null;
  return (
    <p role="alert" className="rp-small mt-3 rounded-rp-md bg-destructive/10 px-3 py-2 text-destructive">
      {loadFailed ? t("loadError") : t("saveError")}
    </p>
  );
}
