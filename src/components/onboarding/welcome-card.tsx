import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";

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

/**
 * Today's one-time line after onboarding: where the daily list, the Quran and reminders are. One row, so the
 * next prayer stays at the top of the first screen.
 */
export function WelcomeCard() {
  const t = useTranslations("onboarding");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const fresh = useSyncExternalStore(subscribeNoop, pending, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!fresh || dismissed) return null;
  const links = [
    ["/plan", tNav("planShort")],
    ["/quran", tNav("quranShort")],
    ["/reminders", tNav("remindersShort")],
  ] as const;
  return (
    <section aria-labelledby="welcome-card-title" data-testid="welcome-card" className="rp-pop mb-3 flex items-center gap-1 rounded-rp-md bg-rp-accent-tint py-1 ps-4 pe-1">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
        <h2 id="welcome-card-title" className="rp-small text-rp-ink">
          {t("cardTitle")}
        </h2>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rp-small inline-flex min-h-11 items-center font-semibold text-rp-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus">
            {label}
          </Link>
        ))}
      </div>
      <button
        type="button"
        aria-label={tCommon("close")}
        onClick={() => {
          try {
            localStorage.removeItem(WELCOME_CARD_KEY);
          } catch {
            // Nothing stored, nothing to clear.
          }
          setDismissed(true);
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-rp-full text-rp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
      >
        <X size={20} strokeWidth={LUCIDE_STROKE} aria-hidden />
      </button>
    </section>
  );
}
