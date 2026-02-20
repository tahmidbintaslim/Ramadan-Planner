import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DuasPage() {
  const tNav = await getTranslations("nav");
  const tLanding = await getTranslations("landing");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{tNav("duas")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {tLanding("featureDuasDesc")}
          </p>
          <p className="text-xs text-muted-foreground">
            Coming soon: curated duas from Quran and Sunnah with shareable cards.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
