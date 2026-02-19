"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { forgotPasswordAction } from "@/actions/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = (await forgotPasswordAction(formData)) as {
        error?: string;
      };
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(t("resetEmailSent"));
      }
    });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t("forgotPassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {success && <div className="text-sm text-success">{success}</div>}

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? tCommon("loading") : t("sendReset")}
          </Button>
        </form>

        <div className="relative my-4">
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
}

export default ForgotPasswordForm;
