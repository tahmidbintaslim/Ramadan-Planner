import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";

export const Route = createFileRoute("/_app/quiz")({
  component: () => (
    <ComingSoonPage
      titleKey="quiz"
      descKey="featureQuizDesc"
      note="Coming soon: daily quizzes, score tracking, and detailed explanations."
    />
  ),
});
