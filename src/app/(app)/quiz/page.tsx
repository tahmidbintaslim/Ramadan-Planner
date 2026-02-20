import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QuizPage() {
  const tNav = await getTranslations("nav");
  const tLanding = await getTranslations("landing");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{tNav("quiz")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{tLanding("featureQuizDesc")}</p>
          <p className="text-xs text-muted-foreground">
            Coming soon: daily quizzes, score tracking, and detailed explanations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
