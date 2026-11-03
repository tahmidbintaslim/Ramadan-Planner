import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/components/providers/auth-provider";
import {
  GUEST_AUTH_WAIT_MS,
  gateDecision,
  locationStorageReadable,
  onboardingDoneThisSession,
  readStoredLocation,
  signedInFromCookie,
  type GateDecision,
} from "@/lib/user-location";

/**
 * The Home's first-run gate. Starts as "wait" on the server and in the hydrating render (the device's choice is
 * only readable after mount), then resolves once: "clear" (show the Home and load its data) or "onboard" (go to
 * /welcome). Auth is awaited, with the same 3 s guest timeout the planner uses when the auth client never answers.
 * Decided once: signing out on the Home later does not send the user to onboarding.
 */
export function useOnboardingGate(): GateDecision {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<GateDecision>("wait");
  const [timedOut, setTimedOut] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setTimedOut(true), GUEST_AUTH_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (decided.current) return;
    const bypass = onboardingDoneThisSession() || !locationStorageReadable();
    const next = bypass
      ? "clear"
      : gateDecision({
          hasLocation: readStoredLocation() !== null,
          cookieSignedIn: signedInFromCookie(document.cookie),
          authLoading: loading,
          signedIn: user !== null,
          authTimedOut: timedOut,
        });
    if (next === "wait") return;
    decided.current = true;
    // Deciding is a response to external state (storage, cookie, the auth client) read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(next);
    if (next === "onboard") void router.navigate({ to: "/welcome", replace: true });
  }, [loading, user, timedOut, router]);

  return state;
}
