// Client: record one usage event (src/lib/usage-events.ts). Fire-and-forget, never throws, nothing while the
// visitor asks not to be tracked (Do Not Track or Global Privacy Control).
import type { UsageEventName } from "@/lib/usage-events";

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export function track(name: UsageEventName, path: string = location.pathname): void {
  if (typeof window === "undefined" || optedOut()) return;
  const locale = document.documentElement.lang.startsWith("en") ? "en" : "bn";
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path, locale }),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {});
}
