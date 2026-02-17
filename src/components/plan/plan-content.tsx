"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export function PlanContent() {
  const t = useTranslations("plan");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            {t("goals")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {/* TODO: Goals list with add/edit/delete */}
            {t("addGoal")}
          </p>
        </CardContent>
      </Card>

      {/* Pre-Ramadan Checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("preRamadanChecklist")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {/* TODO: Pre-Ramadan checklist items */}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
