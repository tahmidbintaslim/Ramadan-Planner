"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Globe, LogOut, LogIn, UserPlus } from "lucide-react";
import { useTransition } from "react";
import { switchLocaleAction } from "@/actions/locale";
import { logoutAction } from "@/actions/auth";
import { useAuth } from "@/components/providers/auth-provider";

export function SettingsContent() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const [isPending, startTransition] = useTransition();
  const { user, isGuest, loading } = useAuth();

  const handleLocaleSwitch = () => {
    startTransition(() => {
      switchLocaleAction();
    });
  };

  const handleLogout = () => {
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* Language */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            {t("language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("language")}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLocaleSwitch}
              disabled={isPending}
            >
              বাংলা / English
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Account */}
      {!loading && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {isGuest ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("profile")}
                </p>
                <Button className="w-full" asChild>
                  <Link href="/signup">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {tAuth("signup")}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    {tAuth("login")}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleLogout}
                  disabled={isPending}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {tAuth("logout")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
