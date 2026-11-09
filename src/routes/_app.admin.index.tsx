import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getAdminAccessAction } from "@/actions/admin-access";
import { AdminOverviewPage } from "@/components/admin/admin-overview";

export const Route = createFileRoute("/_app/admin/")({
  // Re-run on every visit: sign-in state can change between navigations.
  staleTime: 0,
  loader: () => getAdminAccessAction(),
  head: ({ matches }) => pageHead({ matches, title: msg(rootData(matches), "nav", "admin", "Admin") }),
  component: AdminOverviewRoute,
});

function AdminOverviewRoute() {
  return <AdminOverviewPage access={Route.useLoaderData()} />;
}
