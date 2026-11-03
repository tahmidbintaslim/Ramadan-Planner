import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/shared/link";
import { useTranslations } from "@/i18n/use-intl";

// Port of src/app/not-found.tsx (root notFoundComponent).
export function NotFound() {
  const t = useTranslations("common");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("pageNotFoundTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{t("pageNotFoundDesc")}</p>
          <Link href="/" className="text-sm text-primary underline">
            {t("back")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
