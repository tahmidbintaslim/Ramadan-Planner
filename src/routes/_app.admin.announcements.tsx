import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getAdminAccessAction } from "@/actions/admin-access";
import { AnnouncementsAdminPage } from "@/components/admin/announcements-admin-page";

export const Route = createFileRoute("/_app/admin/announcements")({
  // Re-run on every visit: sign-in state can change between navigations.
  staleTime: 0,
  loader: () => getAdminAccessAction(),
  head: ({ matches }) => pageHead({ matches, title: msg(rootData(matches), "nav", "admin", "Admin") }),
  component: AdminAnnouncementsRoute,
});

function AdminAnnouncementsRoute() {
  return <AnnouncementsAdminPage access={Route.useLoaderData()} />;
}
