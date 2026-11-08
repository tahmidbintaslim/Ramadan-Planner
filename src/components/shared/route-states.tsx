import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useTranslations } from "@/i18n/use-intl";
import { Button } from "@/components/ui/button";

/**
 * The router's pending state (defaultPendingComponent, shown after defaultPendingMs): a thin teal bar at the top of
 * the viewport. Fixed, so it never moves the page; a still bar under reduced motion.
 */
export function RouteProgress() {
  const t = useTranslations("common");
  return (
    <div
      role="progressbar"
      aria-label={t("loading")}
      data-testid="route-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px] overflow-hidden"
    >
      <div className="rp-progress-bar h-full w-2/5 bg-rp-accent" />
    </div>
  );
}

/** defaultErrorComponent: a translated message with Retry (reloads the route's data and renders it again). */
export function RouteError({ reset }: ErrorComponentProps) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3 rounded-rp-lg bg-rp-surface p-5 text-rp-ink shadow-rp-soft">
      <p className="rp-body">{t("error")}</p>
      <Button
        variant="soft"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        {t("retry")}
      </Button>
    </div>
  );
}
