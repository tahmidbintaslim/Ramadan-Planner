import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { TodayContent } from "@/components/today/today-content";

export const Route = createFileRoute("/_app/today")({
  head: navHead("today"),
  // The render time, so the server render and the hydrating client render share one clock (see useNowTick).
  loader: () => ({ now: Date.now() }),
  component: TodayRoute,
});

function TodayRoute() {
  const { now } = Route.useLoaderData();
  return <TodayContent initialNow={new Date(now)} />;
}
