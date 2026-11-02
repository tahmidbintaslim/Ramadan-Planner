import { createFileRoute } from "@tanstack/react-router";
import { getHadithList } from "@/actions/hadith";
import { HadithEditionsPage } from "@/components/hadith/hadith-pages";

export const Route = createFileRoute("/_app/hadith/")({
  loader: () => getHadithList(),
  component: HadithListRoute,
});

function HadithListRoute() {
  return <HadithEditionsPage data={Route.useLoaderData()} />;
}
