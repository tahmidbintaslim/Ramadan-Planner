import { createFileRoute } from "@tanstack/react-router";
import { pageHead, msg, rootData } from "@/lib/seo";
import { AskPage } from "@/components/ask/ask-page";

// Keeps the `_app` noindex: the page is a search box with no content of its own.
export const Route = createFileRoute("/_app/ask")({
  head: ({ matches }) => {
    const root = rootData(matches);
    return pageHead({
      matches,
      title: msg(root, "ask", "metaTitle", "Ask"),
      description: msg(root, "ask", "metaDescription"),
      canonicalPath: "/ask",
    });
  },
  component: AskPage,
});
