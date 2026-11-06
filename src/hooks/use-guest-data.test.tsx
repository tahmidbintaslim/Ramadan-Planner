// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useGuestData } from "./use-guest-data";

function Count() {
  const { data } = useGuestData<{ n: number }>("probe_2027-02-20", { n: 0 });
  return <span>{data.n}</span>;
}

describe("useGuestData", () => {
  it("hydrates with the default value, then shows the stored data (no mismatch)", async () => {
    const html = renderToString(<Count />);
    expect(html).toContain("0");
    localStorage.setItem("rp_probe_2027-02-20", JSON.stringify({ n: 5 }));
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Count />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("5");
    // The stored value is kept (not overwritten by the default during hydration).
    expect(JSON.parse(localStorage.getItem("rp_probe_2027-02-20") || "{}")).toEqual({ n: 5 });
  });
});
