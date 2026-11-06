import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithEdition } from "@/actions/hadith";
import { HadithEditionPage } from "@/components/hadith/hadith-pages";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";
import { featureOn } from "@/config/features";

export const Route = createFileRoute("/_app/hadith/$edition/")({
  loader: async ({ params }) => {
    if (!featureOn("hadith")) return null;
    const data = await getHadithEdition(params.edition);
    if (data.kind === "not_found") throw notFound();
    return data;
  },
  head: ({ matches, params }) =>
    pageHead({ matches, title: `${msg(rootData(matches), "nav", "hadith", "Hadith")}: ${params.edition}` }),
  component: EditionRoute,
});

function EditionRoute() {
  const data = Route.useLoaderData();
  if (!data) return <ComingSoonPage titleKey="hadith" />;
  return <HadithEditionPage data={data} />;
}
