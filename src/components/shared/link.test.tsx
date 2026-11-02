import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Link, isPlainHref, splitHref } from "@/components/shared/link";
import { usePathname } from "@/hooks/use-pathname";

async function render(initialPath: string, node: ReactNode): Promise<string> {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => node });
  const page = createRoute({ getParentRoute: () => root, path: "$", component: () => node });
  const router = createRouter({
    routeTree: root.addChildren([index, page]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  return renderToString(createElement(RouterProvider, { router }));
}

describe("Link", () => {
  it("renders an internal href as a router link with the given attributes", async () => {
    const html = await render(
      "/",
      <Link href="/quran/2" className="nav" aria-label="Quran" data-x="1">
        Quran
      </Link>,
    );
    expect(html).toContain('href="/quran/2"');
    expect(html).toContain('class="nav"');
    expect(html).toContain('aria-label="Quran"');
    expect(html).toContain("Quran</a>");
  });

  it("keeps ?query and #hash of an internal href (split into search + hash, same URL out)", async () => {
    const html = await render("/", <Link href="/a?x=1&y=two#sec">a</Link>);
    expect(html).toContain('href="/a?x=1&amp;y=two#sec"');
    expect((await render("/", <Link href="/a?x=1">a</Link>))).toContain('href="/a?x=1"');
    expect((await render("/", <Link href="/a#y">a</Link>))).toContain('href="/a#y"');
    expect((await render("/", <Link href="/settings?google=connected">a</Link>))).toContain(
      'href="/settings?google=connected"',
    );
  });

  it("renders a relative href as a plain anchor (the router would resolve it against the route)", async () => {
    const html = await render("/quran/2", <Link href="foo/bar?x=1">r</Link>);
    expect(html).toContain('href="foo/bar?x=1"');
    expect(html).not.toContain("data-status");
    expect(html).not.toContain("data-discover");
  });

  it("marks the link for the current path as active", async () => {
    const html = await render("/quran", <Link href="/quran">Q</Link>);
    expect(html).toMatch(/data-status="active"/);
  });

  it.each([
    ["https://example.com/a?b=1"],
    ["mailto:hello@example.com"],
    ["#section"],
    ["tel:+8801"],
    ["/api/calendar/google/connect"],
  ])("renders %s as a plain anchor with the original attributes", async (href) => {
    const html = await render(
      "/",
      <Link href={href} target="_blank" rel="noopener noreferrer" className="x" prefetch={false}>
        out
      </Link>,
    );
    expect(html).toContain(`href="${href.replace(/&/g, "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('class="x"');
    expect(html).not.toContain("prefetch");
    expect(html).not.toContain("data-status");
  });

  it("ignores next/link-only props", async () => {
    const html = await render("/", <Link href="/today" prefetch scroll={false}>t</Link>);
    expect(html).not.toContain("prefetch");
    expect(html).not.toContain("scroll");
  });

  it("classifies hrefs", () => {
    expect(isPlainHref("/dashboard")).toBe(false);
    expect(isPlainHref("/quran/12")).toBe(false);
    expect(isPlainHref("//cdn.example.com/x")).toBe(true);
    expect(isPlainHref("#top")).toBe(true);
    expect(isPlainHref("foo")).toBe(true);
    expect(isPlainHref("./foo")).toBe(true);
    expect(isPlainHref("../foo")).toBe(true);
    expect(isPlainHref("/api/x")).toBe(true);
  });

  it("splits internal hrefs into path, search and hash", () => {
    expect(splitHref("/a")).toEqual({ path: "/a", search: undefined, hash: undefined });
    expect(splitHref("/a?x=1#y")).toEqual({ path: "/a", search: { x: 1 }, hash: "y" });
    expect(splitHref("/a?x=hello&y=2")).toEqual({ path: "/a", search: { x: "hello", y: 2 }, hash: undefined });
    expect(splitHref("/a#y")).toEqual({ path: "/a", search: undefined, hash: "y" });
  });
});

describe("usePathname", () => {
  function Show() {
    return createElement("span", null, `path=${usePathname()}`);
  }

  it("returns the current path without search or hash", async () => {
    expect(await render("/settings?google=connected#a", createElement(Show))).toContain("path=/settings<");
    expect(await render("/quran/2", createElement(Show))).toContain("path=/quran/2<");
  });
});
