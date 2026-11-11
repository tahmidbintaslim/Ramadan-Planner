import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteError, RouteProgress } from "@/components/shared/route-states";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Link intent (hover, touchstart, focus) loads the route's code and runs its loader, which warms the shared
    // data cache (src/lib/prefetch-app-data.ts).
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // A navigation still loading after 150 ms shows the thin top progress bar; a quick one shows nothing.
    defaultPendingComponent: RouteProgress,
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,
    defaultErrorComponent: RouteError,
    // Pages cross-fade (200 ms, see globals.css) where the browser supports view transitions; others swap as before.
    defaultViewTransition: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
