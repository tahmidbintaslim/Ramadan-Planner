import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/admin";
import { AnnouncementsAdminContent } from "@/components/admin/announcements-admin-content";

export default async function AdminAnnouncementsPage() {
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-muted-foreground">{t("unauthorized")}</p>;
  }

  const admin = await isUserAdmin({ userId: user.id, email: user.email });
  if (!admin) {
    return <p className="text-sm text-muted-foreground">{t("forbidden")}</p>;
  }

  return <AnnouncementsAdminContent />;
}
