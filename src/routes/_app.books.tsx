import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

export const Route = createFileRoute("/_app/books")({
  component: () => (
    <ComingSoonPage
      titleKey="books"
      descKey="featureBooksDesc"
      note="Coming soon: curated books, categories, and reading progress."
    />
  ),
});
