"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

interface SignupPromptProps {
  open: boolean;
  onClose: () => void;
}

export function SignupPrompt({ open, onClose }: SignupPromptProps) {
  const t = useTranslations("prompt");
  const tAuth = useTranslations("auth");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/signup" onClick={onClose}>
              <UserPlus className="h-4 w-4 mr-2" />
              {tAuth("signup")}
            </Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/login" onClick={onClose}>
              <LogIn className="h-4 w-4 mr-2" />
              {tAuth("login")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("continueBrowsing")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
