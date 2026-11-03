// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/shared/link";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Button asChild > Link", () => {
  it("forwards ref, onClick and the Button classes onto the one router anchor", async () => {
    const seen: { ref: HTMLAnchorElement | null; clicks: number } = { ref: null, clicks: 0 };
    const node = createElement(
      Button,
      { asChild: true, variant: "outline" },
      createElement(
        Link,
        {
          href: "/plan?week=2#top",
          onClick: (e: { preventDefault: () => void }) => {
            seen.clicks += 1;
            e.preventDefault(); // keep the test on this page; we only check delivery
          },
          ref: (el: HTMLAnchorElement | null) => {
            seen.ref = el;
          },
        },
        "Plan",
      ),
    );
    const root = createRootRoute({ component: Outlet });
    const index = createRoute({ getParentRoute: () => root, path: "/", component: () => node });
    const plan = createRoute({ getParentRoute: () => root, path: "/plan", component: () => null });
    const router = createRouter({
      routeTree: root.addChildren([index, plan]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(createElement(RouterProvider, { router }));
    });

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(seen.ref).toBe(anchors[0]);
    expect(anchors[0].getAttribute("href")).toBe("/plan?week=2#top");
    expect(anchors[0].className).toContain("inline-flex");

    await act(async () => {
      anchors[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(seen.clicks).toBe(1);

    await act(async () => reactRoot.unmount());
  });
});
