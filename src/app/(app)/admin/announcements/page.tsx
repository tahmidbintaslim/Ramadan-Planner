import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { isUserAdmin } from "@/lib/admin";
import { AnnouncementsAdminContent } from "@/components/admin/announcements-admin-content";
import { getAppAuthUser } from "@/lib/auth/server";

export default async function AdminAnnouncementsPage() {
  const t = await getTranslations("admin");
  const tAuth = await getTranslations("auth");
  const user = await getAppAuthUser();

  if (!user) {
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

  const admin = await isUserAdmin({ userId: user.id, email: user.email });
  if (!admin) {
    return <p className="text-sm text-muted-foreground">{t("forbidden")}</p>;
  }

  return <AnnouncementsAdminContent />;
}
