// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import { DUAS } from "@/lib/duas";
import { DuasPage } from "./duas-page";

afterEach(cleanup);

describe("DuasPage", () => {
  it("lists the three categories in order, each linking to its section, with counts", () => {
    render(
      <WithIntl>
        <DuasPage />
      </WithIntl>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "দোয়া ও যিকির" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "দোয়ার বিভাগ" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#duas-sehri", "#duas-iftar", "#duas-lastTen"]);
    expect(links[0]).toHaveTextContent("সেহরি ও নিয়ত");
    expect(links[0]).toHaveTextContent("১টি দোয়া");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["সেহরি ও নিয়ত", "ইফতার", "শেষ দশক"]);
  });

  it("shows every dua as Arabic, transliteration, meaning, then a reference line", () => {
    render(
      <WithIntl>
        <DuasPage />
      </WithIntl>,
    );
    for (const dua of DUAS) {
      const card = screen.getByTestId(`dua-${dua.id}`);
      const paras = Array.from(card.querySelectorAll("p"));
      const arabic = within(card).getByText(dua.arabic);
      expect(arabic).toHaveAttribute("lang", "ar");
      expect(arabic).toHaveAttribute("dir", "rtl");
      expect(arabic).toHaveClass("font-arabic");
      // Arabic comes before the transliteration, meaning and reference (the last line, in the gold caption).
      expect(paras.indexOf(arabic as HTMLParagraphElement)).toBeLessThan(paras.length - 3);
      expect(paras.at(-1)).toHaveClass("text-rp-gold-text");
      expect(paras.at(-1)!.textContent!.length).toBeGreaterThan(5);
    }
    expect(within(screen.getByTestId("dua-iftar")).getByText("সূত্র: আবু দাউদ ২৩৫৭")).toBeInTheDocument();
    expect(within(screen.getByTestId("dua-qadr")).getByText("সূত্র: তিরমিজি ৩৫১৩")).toBeInTheDocument();
  });

  it("works in English", () => {
    render(
      <WithIntl locale="en">
        <DuasPage />
      </WithIntl>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Duas & Adhkar" })).toBeInTheDocument();
    expect(screen.getAllByText("1 dua")).toHaveLength(3);
    expect(screen.getByText("Source: Tirmidhi 3513")).toBeInTheDocument();
  });
});
