import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteError, RouteProgress } from "@/components/shared/route-states";

// A quick back/forward starts a new view transition before the last one is ready; the browser then rejects the old
// one's `ready` with "Transition was skipped". The router only awaits `updateCallbackDone`, so that rejection goes
// unhandled and is reported as a page error. It is expected, so swallow it here, once per page.
if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = ((arg?: Parameters<typeof start>[0]) => {
    const transition = start(arg);
    transition.ready.catch(() => {});
    return transition;
  }) as typeof document.startViewTransition;
}

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
