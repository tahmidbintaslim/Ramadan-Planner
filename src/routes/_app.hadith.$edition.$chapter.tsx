import { createFileRoute, notFound } from "@tanstack/react-router";
import { getHadithChapter } from "@/actions/hadith";
import { HadithChapterPage } from "@/components/hadith/hadith-pages";

export const Route = createFileRoute("/_app/hadith/$edition/$chapter")({
  loader: async ({ params }) => {
    const data = await getHadithChapter(params.edition, params.chapter);
    if (data.kind === "not_found") throw notFound();
    return data;
  },
  component: ChapterRoute,
});

function ChapterRoute() {
  return <HadithChapterPage data={Route.useLoaderData()} />;
}
