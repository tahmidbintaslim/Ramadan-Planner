import { createFileRoute, redirect } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { needsOnboarding } from "@/lib/user-location";
import { TodayContent } from "@/components/today/today-content";
import { prefetchDay } from "@/lib/prefetch-app-data";

export const Route = createFileRoute("/_app/today")({
  head: navHead("today"),
  // First-run gate for client navigations (browser only: the server cannot see the device's choice). A full page
  // load is gated after hydration in TodayContent instead, so both renders agree.
  beforeLoad: () => {
    if (needsOnboarding()) throw redirect({ to: "/welcome", replace: true });
  },
  // The render time, so the server render and the hydrating client render share one clock (see useNowTick).
  // Also warms the shared data cache on link intent (hover, touchstart, focus), without blocking navigation.
  loader: () => {
    prefetchDay();
    return { now: Date.now() };
  },
  component: TodayRoute,
});

function TodayRoute() {
  const { now } = Route.useLoaderData();
  return <TodayContent initialNow={new Date(now)} />;
}
