import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { SupportPage, type DonationResult } from "@/components/support/support-page";
import { rememberMonthlySession } from "@/components/support/card-donation";

interface SupportSearch {
  /** Set by the Stripe Checkout success/cancel URLs (src/server/api/donations.ts). */
  donation?: DonationResult;
  monthly?: boolean;
  session_id?: string;
}

// Public and indexable (and in the sitemap): it is the project's open appeal, with no personal data on it.
// Overrides the `_app` noindex like /quran and /timetable do.
export const Route = createFileRoute("/_app/support")({
  validateSearch: (search: Record<string, unknown>): SupportSearch => ({
    donation: search.donation === "success" || search.donation === "cancel" ? search.donation : undefined,
    monthly: search.monthly === 1 || search.monthly === "1" || search.monthly === true ? true : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "supportPage", "metaTitle", "Sadaqah & contribute"),
      description: msg(root, "supportPage", "metaDescription"),
      canonicalPath: "/support",
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: SupportRoute,
});

function SupportRoute() {
  const { donation, monthly, session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();

  // A monthly donor returns with the Checkout Session id: keep it on this device (it opens the Stripe customer
  // portal later) and drop it from the address bar so it is not bookmarked, shared or kept in history.
  useEffect(() => {
    if (!sessionId) return;
    if (donation === "success" && monthly) rememberMonthlySession(sessionId);
    void navigate({ to: "/support", search: { donation, monthly }, replace: true });
  }, [sessionId, donation, monthly, navigate]);

  return <SupportPage donationResult={donation} donationMonthly={!!monthly} />;
}
