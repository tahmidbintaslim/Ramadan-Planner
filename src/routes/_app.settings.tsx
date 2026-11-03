import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { SettingsContent } from "@/components/settings/settings-content";

// Ported ahead of Task 5/6 because a pathless layout needs at least one child route.
export const Route = createFileRoute("/_app/settings")({
  head: navHead("settings"),
  component: SettingsContent,
});
