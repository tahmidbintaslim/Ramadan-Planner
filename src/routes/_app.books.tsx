import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

// Hidden until it works (src/config/features.ts): reachable by direct URL only, noindex via the `_app` layout.
export const Route = createFileRoute("/_app/books")({
  head: navHead("books"),
  component: () => <ComingSoonPage titleKey="books" />,
});
