// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFooterYear } from "./landing-page";

function Year({ serverYear }: { serverYear: number }) {
  return <span data-testid="year">{useFooterYear(serverYear)}</span>;
}

afterEach(() => vi.useRealTimers());

describe("footer year", () => {
  it("hydrates with the server's year without a mismatch, then shows the device's year", async () => {
    const html = renderToString(<Year serverYear={2026} />);
    expect(html).toContain("2026");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    vi.useFakeTimers({ now: new Date("2027-02-20T12:00:00Z"), toFake: ["Date"] });
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Year serverYear={2026} />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("2027");
  });
});
