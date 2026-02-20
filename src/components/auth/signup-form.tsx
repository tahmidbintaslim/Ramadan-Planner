"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signupAction } from "@/actions/auth";

export function SignupForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await signupAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Moon className="h-6 w-6 text-primary" />
          <Link href="/" className="text-lg font-semibold text-primary">
            {tCommon("appName")}
          </Link>
        </div>
        <CardTitle className="text-xl">{t("signup")}</CardTitle>
        <CardDescription>
          {t("hasAccount")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            {t("loginHere")}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? tCommon("loading") : t("signup")}
          </Button>
        </form>

        <div className="relative my-4">
          <Separator />
        </div>

        <form action="/api/auth/google" method="POST">
          <Button variant="outline" className="w-full" type="submit">
            {t("loginWithGoogle")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
