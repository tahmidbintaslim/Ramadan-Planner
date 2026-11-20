import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { listActiveAnnouncementsAction } from "@/actions/announcements";
import { AnnouncementsPage } from "@/components/announcements/announcements-page";

export const Route = createFileRoute("/_app/announcements")({
  head: navHead("announcements"),
  // Public: active announcements only. A failed load shows a message instead of the route error screen.
  loader: async () => {
    try {
      const res = await listActiveAnnouncementsAction();
      return { items: res.ok ? res.data : null };
    } catch {
      return { items: null };
    }
  },
  component: function AnnouncementsRoute() {
    return <AnnouncementsPage items={Route.useLoaderData().items} />;
  },
});
