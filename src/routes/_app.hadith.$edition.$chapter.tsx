import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithChapter } from "@/actions/hadith";
import { HadithChapterPage } from "@/components/hadith/hadith-pages";

export const Route = createFileRoute("/_app/hadith/$edition/$chapter")({
  loader: async ({ params }) => {
    const data = await getHadithChapter(params.edition, params.chapter);
    if (data.kind === "not_found") throw notFound();
    return data;
  },
  head: ({ matches, params }) =>
    pageHead({ matches, title: `${msg(rootData(matches), "nav", "hadith", "Hadith")}: ${params.edition} ${params.chapter}` }),
  component: ChapterRoute,
});

function ChapterRoute() {
  return <HadithChapterPage data={Route.useLoaderData()} />;
}
