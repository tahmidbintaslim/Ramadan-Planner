import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

export const Route = createFileRoute("/_app/duas")({
  component: () => (
    <ComingSoonPage
      titleKey="duas"
      descKey="featureDuasDesc"
      note="Coming soon: curated duas from Quran and Sunnah with shareable cards."
    />
  ),
});
