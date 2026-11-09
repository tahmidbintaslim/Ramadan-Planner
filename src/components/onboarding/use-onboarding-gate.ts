import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

const subscribeNoop = () => () => {};

/**
 * The Home's first-run gate. Starts as "wait" on the server and in the hydrating render (the device's choice is
 * only readable after mount), then resolves once: "clear" (show the Home and load its data) or "onboard" (go to
 * /welcome). Auth is awaited, with the same 3 s guest timeout the planner uses when the auth client never answers.
 * Decided once: signing out on the Home later does not send the user to onboarding.
 */
export function useOnboardingGate(): GateDecision {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const decide = (): GateDecision =>
    onboardingDoneThisSession() || !locationStorageReadable()
      ? "clear"
      : gateDecision({
          hasLocation: readStoredLocation() !== null,
          cookieSignedIn: signedInFromCookie(document.cookie),
          cookieMissing: !/(?:^|;\s*)__client_uat=/.test(document.cookie),
          authLoading: loading,
          signedIn: user !== null,
          authTimedOut: timedOut,
        });
  // On a client navigation (not while hydrating) the device's choice is readable in the first render: a "clear"
  // then shows the Home (and its cached data) at once, with no skeleton frame.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [state, setState] = useState<GateDecision>(() => (mounted && decide() === "clear" ? "clear" : "wait"));
  const decided = useRef(state !== "wait");

  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setTimedOut(true), GUEST_AUTH_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (decided.current) return;
    const next = decide();
    if (next === "wait") return;
    decided.current = true;
    // Deciding is a response to external state (storage, cookie, the auth client) read after mount.
    setState(next);
    if (next === "onboard") void router.navigate({ to: "/welcome", replace: true });
    // `decide` reads only loading, user and timedOut (and storage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, timedOut, router]);

  return state;
}
