import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

// Pathless layout replacing src/app/(app)/layout.tsx: authenticated shell (header, sidebar, mobile nav).
export const Route = createFileRoute("/_app")({
  // noindex keeps app pages out of results; follow still lets crawlers reach the public pages they link to.
  head: () => ({ meta: [{ name: "robots", content: "noindex, follow" }] }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
