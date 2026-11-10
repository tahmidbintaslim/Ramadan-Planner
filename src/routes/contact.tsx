import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/landing/site-pages";
import { msg, pageHead, rootData } from "@/lib/seo";

// Public site page (outside the app shell): indexable, in the sitemap, with its own title and description.
export const Route = createFileRoute("/contact")({
  // The server's year for the footer, so the hydrating render matches the server HTML (see useFooterYear).
  loader: () => ({ serverYear: new Date().getFullYear() }),
  head: ({ matches }) => {
    const root = rootData(matches);
    return pageHead({
      matches,
      canonicalPath: "/contact",
      title: msg(root, "marketing", "contactMetaTitle", "Contact"),
      description: msg(root, "marketing", "contactMetaDescription"),
    });
  },
  component: function ContactRoute() {
    return <ContactPage serverYear={Route.useLoaderData().serverYear} />;
  },
});
