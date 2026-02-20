"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon } from "lucide-react";
import { loginAction, signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Mode = "login" | "signup";

export function SignInOrUpForm({ defaultMode = "login" }: { defaultMode?: Mode }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localMode, setLocalMode] = useState<Mode>(defaultMode);

  const mode = useMemo<Mode>(() => {
    const param = searchParams?.get("mode");
    if (param === "signup") return "signup";
    if (param === "login") return "login";
    return localMode;
  }, [localMode, searchParams]);

  const setMode = (next: Mode) => {
    setLocalMode(next);
    const url = next === "signup" ? "/sign-up" : "/sign-in";
    router.replace(url);
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "signup"
          ? await signupAction(formData)
          : await loginAction(formData);

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
        <div className="mb-2 flex items-center justify-center gap-2">
          <Moon className="h-6 w-6 text-primary" />
          <Link href="/" className="text-lg font-semibold text-primary">
            {tCommon("appName")}
          </Link>
        </div>
        <CardTitle className="text-xl">
          {mode === "signup" ? t("signup") : t("login")}
        </CardTitle>
        <CardDescription>
          {mode === "signup" ? t("hasAccount") : t("noAccount")}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-primary hover:underline"
          >
            {mode === "signup" ? t("loginHere") : t("signupHere")}
          </button>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 py-2 text-center text-sm text-destructive">
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

          {mode === "signup" && (
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
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? tCommon("loading")
              : mode === "signup"
                ? t("signup")
                : t("login")}
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

      {mode === "login" && (
        <CardFooter className="justify-center">
          <Link
            href="/forgot"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {t("forgotPassword")}
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
