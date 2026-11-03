import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

export const Route = createFileRoute("/_app/books")({
  head: navHead("books"),
  component: () => (
    <ComingSoonPage
      titleKey="books"
      descKey="featureBooksDesc"
      note="Coming soon: curated books, categories, and reading progress."
    />
  ),
});
