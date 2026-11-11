import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";

/** Set when onboarding finishes; removed when the card is dismissed. */
export const WELCOME_CARD_KEY = "rp_welcome_card";

const subscribeNoop = () => () => {};
const pending = () => {
  try {
    return localStorage.getItem(WELCOME_CARD_KEY) === "1";
  } catch {
    return false;
  }
};

/** Today's one-time card after onboarding: where the daily list, the Quran and reminders are. */
export function WelcomeCard() {
  const t = useTranslations("onboarding");
  const tNav = useTranslations("nav");
  const fresh = useSyncExternalStore(subscribeNoop, pending, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!fresh || dismissed) return null;
  const rows = [
    ["/plan", tNav("planShort"), t("cardAmal")],
    ["/quran", tNav("quranShort"), t("cardQuran")],
    ["/reminders", tNav("remindersShort"), t("cardRemind")],
  ] as const;
  return (
    <section aria-labelledby="welcome-card-title" data-testid="welcome-card" className="rp-pop mb-4 flex flex-col gap-1 rounded-rp-lg bg-rp-surface p-4">
      <h2 id="welcome-card-title" className="rp-headline text-rp-ink">
        {t("cardTitle")}
      </h2>
      <ul>
        {rows.map(([href, label, hint]) => (
          <li key={href}>
            <Link href={href} className="flex min-h-11 flex-wrap items-baseline gap-x-2 rounded-rp-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus">
              <span className="rp-row font-semibold text-rp-accent">{label}</span>
              <span className="rp-small text-rp-muted">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button
        variant="quiet"
        className="self-end"
        onClick={() => {
          try {
            localStorage.removeItem(WELCOME_CARD_KEY);
          } catch {
            // Nothing stored, nothing to clear.
          }
          setDismissed(true);
        }}
      >
        {t("cardOk")}
      </Button>
    </section>
  );
}
