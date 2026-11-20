"use client";

import type React from "react";
import { useTranslations } from "@/i18n/use-intl";
import { useDistrictLabel } from "@/components/layout/app-header";
import { SUPPORT_CONFIG } from "@/config/support";

/**
 * "Wrong time? Tell us" after the times' source line (#18): an email to the contact address, prefilled with the
 * place, the date and the source the user sees, so a report can be checked against the local mosque or IFB.
 */
export function ReportTimeLink({ source }: { source: string }) {
  const t = useTranslations("prayer");
  const place = useDistrictLabel() ?? "";
  const email = SUPPORT_CONFIG.contactEmail?.trim();
  if (!email) return null;
  // Filled in on tap: the date, page and place differ between the server render and the browser.
  const fill = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const date = new Date().toLocaleDateString("en-CA");
    const subject = t("reportSubject", { place, date });
    const body = `${t("reportBody")}\n\n${source}\n${location.href}`;
    e.currentTarget.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <a href={`mailto:${email}`} onClick={fill} className="whitespace-nowrap text-rp-accent underline-offset-4 hover:underline print:hidden" data-testid="report-time">
      {t("reportTime")}
    </a>
  );
}
