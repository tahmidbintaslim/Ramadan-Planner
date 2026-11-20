// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import { PEACE_API_URL } from "@/config/peace-api";
import { AskPage, type PeaceMatch } from "./ask-page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MATCHES: PeaceMatch[] = [
  {
    id: "q:2:153",
    kind: "quran",
    score: 0.71,
    reference: "Al-Baqarah 2:153",
    referenceBengali: "সূরা আল-বাকারা ২:১৫৩",
    url: "https://quran.com/2/153",
    arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا",
    english: "O you who have believed",
    bengali: "হে মুমিনগণ",
    grade: null,
  },
  {
    id: "h:malik:7",
    kind: "hadith",
    score: 0.55,
    reference: "Muwatta Malik, book 58, hadith 7",
    collection: "Muwatta Malik",
    url: null,
    arabic: "وَمَنْ يَتَصَبَّرْ",
    english: "Whoever tries to be patient",
    bengali: null,
    grade: null,
  },
];

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function ask(text: string) {
  fireEvent.change(screen.getByLabelText("আপনার প্রশ্ন"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "খুঁজুন" }));
}

describe("AskPage", () => {
  it("shows the notice and the API's results, with the missing hadith grade stated, not invented", async () => {
    const fetchMock = stubFetch({ matches: MATCHES, notice: "These are stored texts, not a fatwa." });
    render(
      <WithIntl>
        <AskPage />
      </WithIntl>,
    );
    ask("ধৈর্য");

    expect(await screen.findByText(/কোনো ফতোয়া নয়/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(PEACE_API_URL, expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ query: "ধৈর্য", kinds: ["quran", "hadith"], limit: 6 });

    const ayah = screen.getByTestId("ask-result-q:2:153");
    expect(within(ayah).getByText("সূরা আল-বাকারা ২:১৫৩")).toBeInTheDocument();
    expect(within(ayah).getByText("হে মুমিনগণ")).toBeInTheDocument();
    expect(within(ayah).getByRole("link", { name: "quran.com" })).toHaveAttribute("href", "https://quran.com/2/153");
    expect(within(ayah).queryByText(/মান:/)).not.toBeInTheDocument();
    expect(within(ayah).queryByText("0.71")).not.toBeInTheDocument();

    const hadith = screen.getByTestId("ask-result-h:malik:7");
    expect(within(hadith).getByText("মান: উৎসে উল্লেখ নেই")).toBeInTheDocument();
    // No Bengali text: falls back to the English the API returned.
    expect(within(hadith).getByText("Whoever tries to be patient")).toBeInTheDocument();
    expect(within(hadith).getByText("وَمَنْ يَتَصَبَّرْ")).toHaveAttribute("dir", "rtl");
    expect(within(hadith).queryByRole("link")).not.toBeInTheDocument();
  });

  it("says when the API is rate limited", async () => {
    stubFetch({ error: "rate_limited" }, 429);
    render(
      <WithIntl>
        <AskPage />
      </WithIntl>,
    );
    ask("ধৈর্য");
    expect(await screen.findByRole("alert")).toHaveTextContent("অনেক প্রশ্ন এসেছে, একটু পরে চেষ্টা করুন");
  });
});
