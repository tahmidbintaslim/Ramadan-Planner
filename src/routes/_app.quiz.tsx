import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

export const Route = createFileRoute("/_app/quiz")({
  head: navHead("quiz"),
  component: () => (
    <ComingSoonPage
      titleKey="quiz"
      descKey="featureQuizDesc"
    />
  ),
});
