import { createFileRoute } from "@tanstack/react-router";
import { SettingsContent } from "@/components/settings/settings-content";

// Ported ahead of Task 5/6 because a pathless layout needs at least one child route.
export const Route = createFileRoute("/_app/settings")({
  component: SettingsContent,
});
