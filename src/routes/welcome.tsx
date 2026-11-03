import { createFileRoute } from "@tanstack/react-router";
import { msg, pageHead, rootData } from "@/lib/seo";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";

// First-run onboarding (district picker, no sign-up). Outside the app shell; a per-device step, so noindex and
// not in the sitemap. /today sends first-time guests here (see needsOnboarding).
export const Route = createFileRoute("/welcome")({
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
