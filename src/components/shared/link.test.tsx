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
import { Link, isPlainHref } from "@/components/shared/link";
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
    // TanStack's Link marks the anchor with its own data attributes only when active; no full URL.
    expect(html).not.toContain("http");
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
