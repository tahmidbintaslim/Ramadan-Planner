import { useEffect, useState } from "react";
import { getAdminAccessAction } from "@/actions/admin-access";
import { useAuth } from "@/components/providers/auth-provider";

// One check per signed-in user per page session (the nav renders in several places).
const checks = new Map<string, Promise<boolean>>();

/** True only for an admin (server-checked; the admin pages check again). Guests never trigger a request. */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [admin, setAdmin] = useState<{ userId: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let check = checks.get(userId);
    if (!check) {
      check = getAdminAccessAction().then(
        (a) => a === "ok",
        () => false,
      );
      checks.set(userId, check);
    }
    let live = true;
    void check.then((ok) => live && setAdmin({ userId, ok }));
    return () => {
      live = false;
    };
  }, [userId]);
  return admin !== null && admin.userId === userId && admin.ok;
}
