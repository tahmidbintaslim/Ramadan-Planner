// Shared head() helpers. Root loader data (locale, messages, siteUrl) is read from the matches so each public
// route sets its own unique title/description/canonical/OG tags. Locale comes from a cookie on the SAME url, so
// there are deliberately no hreflang alternates (they would point at URLs that do not exist).

type Messages = Record<string, Record<string, unknown> | undefined>;
type RootData = { locale?: string; messages?: Messages; siteUrl?: string } | undefined;
type MatchLike = { routeId: string; loaderData?: unknown };

export function rootData(matches: readonly MatchLike[]): RootData {
  return matches.find((m) => m.routeId === "__root__")?.loaderData as RootData;
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

export function msg(root: RootData, ns: string, key: string, fallback = ""): string {
  return str(root?.messages?.[ns]?.[key], fallback);
}

export const OG_IMAGE_PATH = "/og.png";

type PageHeadOptions = {
  matches: readonly MatchLike[];
  /** Page name; the title becomes "<name> — <appName>" (or just appName when omitted). */
  title?: string;
  description?: string;
  /** Path for canonical/og:url (public, indexable pages only). */
  canonicalPath?: string;
  scripts?: { type: string; children: string }[];
};

/** Tags a public page sets. Child tags override the root's title/description/og:* (same key). */
export function pageHead({ matches, title, description, canonicalPath, scripts }: PageHeadOptions) {
  const root = rootData(matches);
  const appName = msg(root, "common", "appName", "Ramadan Planner");
  const fullTitle = title ? `${title} — ${appName}` : msg(root, "common", "metaTitle", appName);
  const desc = description ?? msg(root, "common", "metaDescription");
  const ogDesc = description ?? msg(root, "common", "metaOgDescription", desc);
  const siteUrl = root?.siteUrl ?? "";
  const url = canonicalPath !== undefined && siteUrl ? `${siteUrl}${canonicalPath === "/" ? "" : canonicalPath}` : "";
  const meta: Record<string, string>[] = [
    { title: fullTitle },
    { name: "description", content: desc },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: ogDesc },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: appName },
    { property: "og:locale", content: root?.locale === "en" ? "en_US" : "bn_BD" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
  if (siteUrl) {
    meta.push({ property: "og:image", content: `${siteUrl}${OG_IMAGE_PATH}` });
    meta.push({ property: "og:image:width", content: "1200" });
    meta.push({ property: "og:image:height", content: "630" });
  }
  if (url) meta.push({ property: "og:url", content: url });
  return {
    meta,
    links: url ? [{ rel: "canonical", href: url }] : [],
    ...(scripts ? { scripts } : {}),
  };
}

/** Signed-in pages: unique title from the nav label, no canonical (they are noindex via the `_app` layout). */
export function navHead(navKey: string) {
  return ({ matches }: { matches: readonly MatchLike[] }) => {
    const root = rootData(matches);
    return pageHead({ matches, title: msg(root, "nav", navKey, navKey) });
  };
}

/** JSON.stringify that is safe inside a <script> element: `<` (and U+2028/9) escaped. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function webApplicationJsonLd(root: RootData) {
  const siteUrl = root?.siteUrl ?? "";
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: msg(root, "common", "appName", "Ramadan Planner"),
    description: msg(root, "common", "metaDescription"),
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    inLanguage: ["bn", "en"],
    isAccessibleForFree: true,
    ...(siteUrl ? { url: siteUrl, image: `${siteUrl}${OG_IMAGE_PATH}` } : {}),
  };
}
