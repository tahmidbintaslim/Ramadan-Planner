import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithList } from "@/actions/hadith";
import { HadithEditionsPage } from "@/components/hadith/hadith-pages";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";
import { featureOn } from "@/config/features";

// While hadith is switched off (src/config/features.ts) this is a calm coming-soon page: nothing is fetched, it is
// noindex (the `_app` layout) and no menu or sitemap lists it.
export const Route = createFileRoute("/_app/hadith/")({
  loader: () => (featureOn("hadith") ? getHadithList() : null),
  head: ({ matches }) => {
    if (!featureOn("hadith")) return pageHead({ matches, title: msg(rootData(matches), "nav", "hadith", "Hadith") });
    const h = pageHead({ matches, title: msg(rootData(matches), "nav", "hadith", "Hadith"), canonicalPath: "/hadith" });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: HadithListRoute,
});

function HadithListRoute() {
  const data = Route.useLoaderData();
  if (!data) return <ComingSoonPage titleKey="hadith" />;
  return <HadithEditionsPage data={data} />;
}
