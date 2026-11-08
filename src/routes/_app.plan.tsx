import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { navHead } from "@/lib/seo";
import { signedInFromCookie } from "@/lib/user-location";
import { PlanContent } from "@/components/plan/plan-content";
import { prefetchPlan } from "@/lib/prefetch-app-data";

const requestCookie = createIsomorphicFn()
  .server(() => getRequestHeader("cookie") ?? "")
  .client(() => document.cookie);

export const Route = createFileRoute("/_app/plan")({
  head: navHead("plan"),
  // Warms the shared data cache on link intent (hover, touchstart, focus) without blocking navigation, and tells
  // the screen from the session cookie whether this is a guest, so the server render already holds the guest's layout.
  loader: () => {
    prefetchPlan();
    return { cookieGuest: !signedInFromCookie(requestCookie()) };
  },
  component: PlanRoute,
});

function PlanRoute() {
  return <PlanContent cookieGuest={Route.useLoaderData().cookieGuest} />;
}
