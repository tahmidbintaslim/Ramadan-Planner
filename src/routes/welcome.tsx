import { createFileRoute, redirect } from "@tanstack/react-router";
import { readStoredLocation } from "@/lib/user-location";
import { msg, pageHead, rootData } from "@/lib/seo";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";

// First-run onboarding (district picker, no sign-up). Outside the app shell; a per-device step, so noindex and
// not in the sitemap. /today sends first-time guests here (see needsOnboarding).
export type WelcomeStep = "language" | "location";

export const Route = createFileRoute("/welcome")({
  // Each step is its own history entry, so the browser's back and forward move between steps.
  validateSearch: (search: Record<string, unknown>): { step?: WelcomeStep } =>
    search.step === "language" || search.step === "location" ? { step: search.step } : {},
  // A device that has finished onboarding never re-enters it (e.g. pressing back from Today).
  beforeLoad: () => {
    if (typeof window !== "undefined" && readStoredLocation() !== null) throw redirect({ to: "/today", replace: true });
  },
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "onboarding", "metaTitle", "Welcome"),
      description: msg(root, "onboarding", "subtitle"),
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "noindex, follow" }] };
  },
  component: WelcomeScreen,
});
