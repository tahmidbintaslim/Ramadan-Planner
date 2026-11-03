import { useTranslations } from "@/i18n/use-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Shared body of the placeholder pages (/duas, /books, /quiz): nav title, landing blurb, coming-soon note.
export function ComingSoonPage({
  titleKey,
  descKey,
  note,
}: {
  titleKey: "duas" | "books" | "quiz";
  descKey: "featureDuasDesc" | "featureBooksDesc" | "featureQuizDesc";
  note: string;
}) {
  const tNav = useTranslations("nav");
  const tLanding = useTranslations("landing");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="rp-h1 text-rp-ink">{tNav(titleKey)}</h1>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{tLanding(descKey)}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </div>
  );
}
