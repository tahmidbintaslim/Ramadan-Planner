import { describe, expect, it } from "vitest";
import { msg, navHead, pageHead, rootData, safeJsonLd, webApplicationJsonLd } from "./seo";

const matches = (locale = "en", siteUrl = "https://x.test") => [
  {
    routeId: "__root__",
    loaderData: {
      locale,
      siteUrl,
      messages: {
        common: { appName: "Ramadan Planner", metaTitle: "Ramadan Planner", metaDescription: "Plan.", metaOgDescription: "Track." },
        nav: { quran: "Quran", hadith: "Hadith", today: "Today" },
      },
    },
  },
];
const get = (h: { meta: Record<string, string>[] }, key: string, val: string) =>
  h.meta.filter((m) => m[key] === val);

describe("pageHead", () => {
  it("builds a unique title, canonical from SITE_URL, og:* and a static og:image", () => {
    const h = pageHead({ matches: matches(), title: "Quran", canonicalPath: "/quran" });
    expect(h.meta[0]).toEqual({ title: "Quran — Ramadan Planner" });
    expect(h.links).toEqual([{ rel: "canonical", href: "https://x.test/quran" }]);
    expect(get(h, "property", "og:url")[0].content).toBe("https://x.test/quran");
    expect(get(h, "property", "og:image")[0].content).toBe("https://x.test/og.png?v=4");
    expect(get(h, "name", "twitter:card")[0].content).toBe("summary_large_image");
  });

  it("canonical for the landing page is the bare origin", () => {
    const h = pageHead({ matches: matches(), canonicalPath: "/" });
    expect(h.links).toEqual([{ rel: "canonical", href: "https://x.test" }]);
    expect(h.meta[0]).toEqual({ title: "Ramadan Planner" });
  });

  it("emits no canonical/og:url/og:image without a site URL, and never duplicates a tag", () => {
    const h = pageHead({ matches: matches("bn", ""), title: "Quran", canonicalPath: "/quran" });
    expect(h.links).toEqual([]);
    expect(get(h, "property", "og:url")).toHaveLength(0);
    expect(get(h, "property", "og:image")).toHaveLength(0);
    const keys = h.meta.map((m) => m.title ?? m.name ?? m.property);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no hreflang alternates: the locale comes from a cookie on the same URL", () => {
    expect(JSON.stringify(pageHead({ matches: matches(), canonicalPath: "/" }))).not.toMatch(/hreflang|alternate/);
  });

  it("maps locale to og:locale", () => {
    expect(get(pageHead({ matches: matches("bn") }), "property", "og:locale")[0].content).toBe("bn_BD");
    expect(get(pageHead({ matches: matches("en") }), "property", "og:locale")[0].content).toBe("en_US");
  });
});

describe("navHead", () => {
  it("gives each signed-in page a distinct title and no canonical", () => {
    const t = navHead("today")({ matches: matches() }).meta[0];
    const q = navHead("quran")({ matches: matches() }).meta[0];
    expect(t).toEqual({ title: "Today — Ramadan Planner" });
    expect(q).not.toEqual(t);
    expect(navHead("today")({ matches: matches() }).links).toEqual([]);
  });

  it("survives missing root data", () => {
    expect(navHead("today")({ matches: [] }).meta[0]).toEqual({ title: "today — Ramadan Planner" });
    expect(msg(rootData([]), "nav", "x", "fb")).toBe("fb");
  });
});

describe("JSON-LD", () => {
  it("is built from existing copy only", () => {
    const ld = webApplicationJsonLd(rootData(matches()));
    expect(ld).toMatchObject({
      "@type": "WebApplication",
      name: "Ramadan Planner",
      description: "Plan.",
      url: "https://x.test",
      image: "https://x.test/og.png?v=4",
      inLanguage: ["bn", "en"],
    });
  });

  it("escapes < so the payload cannot close the script element", () => {
    const s = safeJsonLd({ name: "</script><script>alert(1)</script>", a: " " });
    expect(s).not.toContain("<");
    expect(s).not.toContain(" ");
    expect(JSON.parse(s).name).toBe("</script><script>alert(1)</script>");
  });
});
