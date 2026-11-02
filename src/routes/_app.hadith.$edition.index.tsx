import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { getHadithEdition } from "@/actions/hadith";
import { HadithEditionPage } from "@/components/hadith/hadith-pages";

export const Route = createFileRoute("/_app/hadith/$edition/")({
  loader: async ({ params }) => {
    const data = await getHadithEdition(params.edition);
    if (data.kind === "not_found") throw notFound();
    return data;
  },
  head: ({ matches, params }) =>
    pageHead({ matches, title: `${msg(rootData(matches), "nav", "hadith", "Hadith")}: ${params.edition}` }),
  component: EditionRoute,
});

function EditionRoute() {
  return <HadithEditionPage data={Route.useLoaderData()} />;
}
