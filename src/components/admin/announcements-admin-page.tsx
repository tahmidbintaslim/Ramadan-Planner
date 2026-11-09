import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnnouncementsAdminContent } from "@/components/admin/announcements-admin-content";
import type { AdminAccess } from "@/actions/admin-access";
import { AdminTabs } from "@/components/admin/admin-tabs";

// Gate for the /admin pages (the access level comes from the route loader, checked on the server); every admin
// server function checks rights again.
export function AdminGate({ access, children }: { access: AdminAccess; children: React.ReactNode }) {
  const t = useTranslations("admin");
  const tAuth = useTranslations("auth");
  const tComing = useTranslations("comingSoon");

  if (access !== "ok") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="rp-h1 text-rp-ink">{t("title")}</h1>
        <Card className="items-start px-5" data-testid="admin-gate">
          <p className="rp-body text-rp-ink">{access === "unauthorized" ? t("unauthorized") : t("forbidden")}</p>
          {access === "unauthorized" ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/sign-in" className={buttonVariants({ variant: "primary" })}>
                {tAuth("login")}
              </Link>
              <Link href="/sign-up" className={buttonVariants({ variant: "outline" })}>
                {tAuth("signup")}
              </Link>
            </div>
          ) : (
            <Link href="/today" className={buttonVariants({ variant: "soft" })}>
              {tComing("backToToday")}
            </Link>
          )}
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

export function AnnouncementsAdminPage({ access }: { access: AdminAccess }) {
  return (
    <AdminGate access={access}>
      <AdminTabs current="/admin/announcements" />
      <AnnouncementsAdminContent />
    </AdminGate>
  );
}
