import { describe, expect, it } from "vitest";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { sitemapPaths } from "./seo-files";

// Ties the sitemap to the routes' real head() output: every listed URL must resolve to a route whose merged
// head tags are indexable (the `_app` layout sets noindex; public children override it).
type Meta = Record<string, string>;
type Head = { meta?: Meta[]; links?: { rel: string; href: string }[] };
type HeadFn = (ctx: unknown) => Head | undefined;

const SITE = "https://x.test";
const rootLoaderData = {
  locale: "bn",
  siteUrl: SITE,
  messages: { common: { appName: "Ramadan Planner", metaTitle: "Ramadan Planner" }, nav: { quran: "Quran", hadith: "Hadith" },
    timetablePage: { metaTitle: "Ramadan timetable", metaDescription: "30-day Sehri and Iftar timetable" },
    supportPage: { metaTitle: "Sadaqah & contribute", metaDescription: "Free forever; give sadaqah or your time" },
    duas: { metaTitle: "Ramadan duas", metaDescription: "Sourced Ramadan duas" },
  },
};
const surahData = (n: number) => ({
  surahNumber: n,
  siteUrl: SITE,
  surah: { surahNo: n, nameEnglish: `Surah ${n}`, nameBengali: `সূরা ${n}`, totalAyah: 7 },
});

const router = createRouter({ routeTree });

function mergedHead(path: string) {
  const matched = router.matchRoutes(path);
  const matches = matched.map((m) => ({
    routeId: m.routeId,
    params: m.params,
    loaderData:
      m.routeId === "__root__" ? rootLoaderData : m.routeId === "/_app/quran/$surah" ? surahData(Number((m.params as { surah: string }).surah)) : undefined,
  }));
  const meta: Meta[] = [];
  const links: { rel: string; href: string }[] = [];
  for (const match of matches) {
    const route = (router.routesById as unknown as Record<string, { options: unknown }>)[match.routeId];
    const head = (route.options as { head?: HeadFn }).head?.({ matches, match, params: match.params, loaderData: match.loaderData });
    meta.push(...(head?.meta ?? []));
    links.push(...(head?.links ?? []));
  }
  // Deeper routes win for the same meta name (HeadContent dedupes the same way).
  const robots = meta.filter((m) => m.name === "robots").at(-1)?.content ?? "";
  return { routeIds: matches.map((m) => m.routeId), meta, robots, canonical: links.find((l) => l.rel === "canonical")?.href };
}

describe("sitemap paths are indexable", () => {
  it.each(sitemapPaths())("%s resolves to an indexable route with a matching canonical", (path) => {
    const { routeIds, robots, canonical } = mergedHead(path);
    expect(routeIds.at(-1)).not.toBe("__root__"); // a real route, not the 404 fallback
    expect(robots).not.toMatch(/noindex/);
    expect(canonical).toBe(`${SITE}${path === "/" ? "" : path}`);
  });

  it("detects noindex on a signed-in page (sanity check for the merge above)", () => {
    expect(mergedHead("/today").robots).toMatch(/noindex/);
  });
});

describe("timetable page head", () => {
  it("has its own title, description and canonical", () => {
    const { meta, canonical } = mergedHead("/timetable");
    const last = (key: string, val: string) => meta.filter((m) => m[key] === val).at(-1);
    expect(meta.filter((m) => m.title).at(-1)?.title).toBe("Ramadan timetable — Ramadan Planner");
    expect(last("name", "description")?.content).toBe("30-day Sehri and Iftar timetable");
    expect(canonical).toBe(`${SITE}/timetable`);
  });
});

describe("surah page head", () => {
  it("uses the shared pageHead tags with the Bengali surah title and digits (no app-name suffix)", () => {
    const { meta } = mergedHead("/quran/2");
    const last = (key: string, val: string) => meta.filter((m) => m[key] === val).at(-1);
    expect(meta.filter((m) => m.title).at(-1)?.title).toBe("সূরা 2 — সূরা ২");
    expect(last("property", "og:title")?.content).toBe("সূরা 2 — সূরা ২");
    expect(last("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(last("property", "og:site_name")?.content).toBe("Ramadan Planner");
    expect(last("property", "og:type")?.content).toBe("website");
    expect(last("property", "og:url")?.content).toBe(`${SITE}/quran/2`);
    expect(last("property", "og:image")?.content).toBe(`${SITE}/og.png?v=3`);
    expect(last("name", "description")?.content).toBe("সূরা 2 (Surah 2) — ৭ আয়াত");
  });
});
