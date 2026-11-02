import { createFileRoute } from "@tanstack/react-router";
import { getAdminAccessAction } from "@/actions/admin-access";
import { AnnouncementsAdminPage } from "@/components/admin/announcements-admin-page";

export const Route = createFileRoute("/_app/admin/announcements")({
  // Re-run on every visit: sign-in state can change between navigations.
  staleTime: 0,
  loader: () => getAdminAccessAction(),
  component: AdminAnnouncementsRoute,
});

function AdminAnnouncementsRoute() {
  return <AnnouncementsAdminPage access={Route.useLoaderData()} />;
}
