import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithChapter } from "@/actions/hadith";
import { HadithChapterPage } from "@/components/hadith/hadith-pages";
import { ComingSoonPage } from "@/components/shared/coming-soon-page";
import { featureOn } from "@/config/features";

export const Route = createFileRoute("/_app/hadith/$edition/$chapter")({
  loader: async ({ params }) => {
    if (!featureOn("hadith")) return null;
    const data = await getHadithChapter(params.edition, params.chapter);
    if (data.kind === "not_found") throw notFound();
    return data;
  },
  head: ({ matches, params }) =>
    pageHead({ matches, title: `${msg(rootData(matches), "nav", "hadith", "Hadith")}: ${params.edition} ${params.chapter}` }),
  component: ChapterRoute,
});

function ChapterRoute() {
  const data = Route.useLoaderData();
  if (!data) return <ComingSoonPage titleKey="hadith" />;
  return <HadithChapterPage data={data} />;
}
