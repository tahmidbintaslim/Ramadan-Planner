import { useEffect, useState, type ReactNode } from "react";
import { ClerkFailed, ClerkLoading } from "@clerk/tanstack-react-start";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { CrescentIcon } from "@/components/icons/islamic-icons";

/** How long the sign-in/sign-up form may take to appear before the fallback card replaces the wait. */
export const CLERK_FALLBACK_MS = 6000;

/** Card shown when the account service is unavailable: the app keeps working without an account. */
export function ClerkUnavailableCard({ mode }: { mode: "signIn" | "signUp" }) {
  const t = useTranslations("auth");
  return (
    <section
      role="alert"
      data-testid="clerk-unavailable"
      className="flex flex-col items-start gap-3 rounded-rp-lg bg-rp-surface p-6 text-rp-ink shadow-rp-soft"
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-accent">
        <CrescentIcon size={24} />
      </span>
      <h1 className="rp-h1">{t(mode === "signIn" ? "unavailableSignInTitle" : "unavailableSignUpTitle")}</h1>
      <p className="rp-body text-rp-muted">{t("unavailableBody")}</p>
      <div className="flex w-full flex-wrap gap-2">
        <Link href="/today" className={buttonVariants({ variant: "primary" })}>
          {t("unavailableContinue")}
        </Link>
        <Button type="button" variant="quiet" onClick={() => window.location.reload()}>
          {t("unavailableRetry")}
        </Button>
      </div>
    </section>
  );
}

/**
 * Wraps the Clerk form: if Clerk fails to load, or is still loading after CLERK_FALLBACK_MS, the fallback card
 * shows instead of an empty page. The server render and the first client render show only the children.
 */
export function ClerkGate({ mode, children }: { mode: "signIn" | "signUp"; children: ReactNode }) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), CLERK_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <>
      <ClerkFailed>
        <ClerkUnavailableCard mode={mode} />
      </ClerkFailed>
      {timedOut ? (
        <ClerkLoading>
          <ClerkUnavailableCard mode={mode} />
        </ClerkLoading>
      ) : null}
      {children}
    </>
  );
}
