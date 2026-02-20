import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("pageNotFoundTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t("pageNotFoundDesc")}
          </p>
          <Link href="/" className="text-sm text-primary underline">
            {t("back")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
