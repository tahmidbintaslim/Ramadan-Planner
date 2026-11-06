// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import { ZakatContent } from "./zakat-content";

afterEach(cleanup);

function setup() {
  render(
    <WithIntl>
      <ZakatContent />
    </WithIntl>,
  );
}

describe("ZakatContent", () => {
  it("starts with every field empty (no sample nisab, no ০ prefills) and placeholders", () => {
    setup();
    for (const id of ["cash", "gold", "investments", "debts", "nisab"]) {
      const input = document.getElementById(id) as HTMLInputElement;
      expect(input.value, id).toBe("");
      expect(input.placeholder, id).not.toMatch(/^[০0]$/);
    }
    expect(screen.getByLabelText(/নিসাব সীমা/)).toHaveAttribute("placeholder", "আজকের দাম অনুযায়ী লিখুন");
  });

  it("states the nisab basis without assuming a price, and calls nothing due until nisab is entered", () => {
    setup();
    const hint = screen.getByTestId("nisab-hint");
    expect(hint).toHaveTextContent("৮৭.৪৮ গ্রাম সোনা");
    expect(hint).toHaveTextContent("৬১২.৩৬ গ্রাম রুপা");
    expect(document.body.textContent).not.toMatch(/৮৫,?০০০|85,?000/);
    fireEvent.change(document.getElementById("cash")!, { target: { value: "২০০০০০" } });
    expect(screen.getByTestId("zakat-status")).toHaveAttribute("data-status", "no-nisab");
    fireEvent.change(document.getElementById("nisab")!, { target: { value: "১০০০০০" } });
    expect(screen.getByTestId("zakat-status")).toHaveAttribute("data-status", "due");
    expect(screen.getByTestId("zakat-status")).toHaveTextContent("৫,০০০.০০");
    fireEvent.change(document.getElementById("nisab")!, { target: { value: "৩০০০০০" } });
    expect(screen.getByTestId("zakat-status")).toHaveAttribute("data-status", "below");
  });
});
