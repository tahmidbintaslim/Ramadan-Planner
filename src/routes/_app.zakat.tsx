import { createFileRoute } from "@tanstack/react-router";
import { msg, pageHead, rootData } from "@/lib/seo";
import { ZakatContent } from "@/components/zakat/zakat-content";

// Public and in the sitemap (overrides the `_app` noindex like /duas): "যাকাত হিসাব" is a common Ramadan search and
// the calculator needs no account.
export const Route = createFileRoute("/_app/zakat")({
  head: ({ matches }) => {
    const root = rootData(matches);
    const h = pageHead({
      matches,
      title: msg(root, "zakat", "metaTitle", "Zakat calculator"),
      description: msg(root, "zakat", "metaDescription"),
      canonicalPath: "/zakat",
    });
    return { ...h, meta: [...h.meta, { name: "robots", content: "index, follow" }] };
  },
  component: ZakatContent,
});
