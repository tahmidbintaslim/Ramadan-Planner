import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

// Pathless layout replacing src/app/(app)/layout.tsx: authenticated shell (header, sidebar, mobile nav).
export const Route = createFileRoute("/_app")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
