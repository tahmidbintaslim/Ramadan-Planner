// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WithIntl } from "./test-utils";

vi.mock("@/components/layout/app-header", () => ({ useDistrictLabel: () => "সিলেট" }));
import { ReportTimeLink } from "./report-time-link";

afterEach(cleanup);

describe("ReportTimeLink", () => {
  it("renders a plain mailto (same on server and client), and fills place, date and source on tap", () => {
    render(
      <WithIntl>
        <ReportTimeLink source="AlAdhan · করাচি" />
      </WithIntl>,
    );
    const link = screen.getByTestId("report-time");
    expect(link).toHaveTextContent("সময় ভুল? জানান");
    expect(link.getAttribute("href")).toBe("mailto:contact@tahmid.space");
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    const href = decodeURIComponent(link.getAttribute("href")!);
    expect(href).toMatch(/^mailto:contact@tahmid\.space\?subject=নামাজের সময়ের রিপোর্ট: সিলেট · \d{4}-\d{2}-\d{2}&body=/);
    expect(href).toContain("AlAdhan · করাচি");
  });
});
