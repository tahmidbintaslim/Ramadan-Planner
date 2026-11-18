"use client";

import { useState, useTransition } from "react";
import { useClerk } from "@clerk/tanstack-react-start";
import { ChevronRight, Download, Shield, Trash2 } from "lucide-react";
import { useTranslations } from "@/i18n/use-intl";
import { Link } from "@/components/shared/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { clearPersonalDeviceData } from "@/lib/sign-out-cleanup";
import { deleteAccountAction, exportAccountDataAction } from "@/actions/account";
import { cn } from "@/lib/utils";
import { DIVIDER, ROW } from "./location-prayer-card";

/** Settings rows for the privacy policy (everyone) and, when signed in, data export and account deletion (#52). */
export function AccountDataRows({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { signOut } = useClerk();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = () => {
    setError(null);
    startTransition(async () => {
      const res = await exportAccountDataAction();
      if (!res.ok) {
        setError(t("exportFailed"));
        return;
      }
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ramadan-planner-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const deleteAccount = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccountAction();
      if (!res.ok) {
        setConfirmOpen(false);
        setError(t("deleteFailed"));
        return;
      }
      await clearPersonalDeviceData();
      // Deleting the account already ended its session, so Clerk's sign-out can fail; leave for Home either way.
      await signOut({ redirectUrl: "/?deleted=1" }).catch(() => {});
      window.location.assign("/?deleted=1");
    });
  };

  return (
    <>
      <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
        <li className={DIVIDER}>
          <Link href="/privacy" className={ROW}>
            <Shield size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
            <span className="min-w-0 flex-1">{t("privacy")}</span>
            <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
          </Link>
        </li>
        {signedIn ? (
          <>
            <li className={DIVIDER}>
              <button type="button" onClick={exportData} disabled={isPending} className={ROW} data-testid="export-data">
                <Download size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
                <span className="min-w-0 flex-1 text-start">{t("exportData")}</span>
              </button>
            </li>
            <li className={DIVIDER}>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={isPending}
                className={cn(ROW, "text-destructive")}
                data-testid="delete-account"
              >
                <Trash2 size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 text-start">{t("deleteAccount")}</span>
              </button>
            </li>
          </>
        ) : null}
      </ul>
      {error ? (
        <p role="alert" className="rp-small px-4 text-destructive">
          {error}
        </p>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={(open) => !isPending && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteAccountTitle")}</DialogTitle>
            <DialogDescription>{t("deleteAccountBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={isPending} data-testid="delete-account-confirm">
              {t("deleteAccountConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
