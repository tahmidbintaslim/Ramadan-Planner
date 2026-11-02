import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { AnnouncementsAdminContent } from "@/components/admin/announcements-admin-content";
import type { AdminAccess } from "@/actions/admin-access";

// Gate for /admin/announcements (the access level comes from the route loader, checked on the server).
export function AnnouncementsAdminPage({ access }: { access: AdminAccess }) {
  const t = useTranslations("admin");
  const tAuth = useTranslations("auth");

  if (access === "unauthorized") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("unauthorized")}{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          {tAuth("login")}
        </Link>{" "}
        /{" "}
        <Link href="/sign-up" className="text-primary hover:underline">
          {tAuth("signup")}
        </Link>
      </p>
    );
  }
  if (access === "forbidden") {
    return <p className="text-sm text-muted-foreground">{t("forbidden")}</p>;
  }
  return <AnnouncementsAdminContent />;
}
