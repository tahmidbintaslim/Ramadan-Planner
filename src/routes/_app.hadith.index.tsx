import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithList } from "@/actions/hadith";
import { HadithEditionsPage } from "@/components/hadith/hadith-pages";

export const Route = createFileRoute("/_app/hadith/")({
  loader: () => getHadithList(),
  head: ({ matches }) => {
    const h = pageHead({ matches, title: msg(rootData(matches), "nav", "hadith", "Hadith"), canonicalPath: "/hadith" });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: HadithListRoute,
});

function HadithListRoute() {
  return <HadithEditionsPage data={Route.useLoaderData()} />;
}
