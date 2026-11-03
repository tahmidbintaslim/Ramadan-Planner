import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ fetchSurah: vi.fn() }));
vi.mock("@/lib/quran", () => ({ fetchSurah: m.fetchSurah }));

import { getSurahPageDataImpl } from "./quran-impl";

beforeEach(() => {
  m.fetchSurah.mockReset();
  vi.stubEnv("SITE_URL", "https://site.example/");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
});

describe("getSurahPageDataImpl", () => {
  it("returns only the metadata fields and the site origin for a found surah", async () => {
    m.fetchSurah.mockResolvedValue({
      surahNo: 1,
      nameEnglish: "Al-Fatihah",
      nameBengali: "আল-ফাতিহা",
      nameArabic: "x",
      totalAyah: 7,
      audio: {},
      ayahs: [{ ayahNo: 1 }],
    });
    expect(await getSurahPageDataImpl(1)).toEqual({
      surahNumber: 1,
      surah: { surahNo: 1, nameEnglish: "Al-Fatihah", nameBengali: "আল-ফাতিহা", totalAyah: 7 },
      siteUrl: "https://site.example",
    });
    expect(m.fetchSurah).toHaveBeenCalledWith(1);
  });

  it("keeps the page (surah null) when the data source fails, as the old metadata fallback did", async () => {
    m.fetchSurah.mockResolvedValue(null);
    expect(await getSurahPageDataImpl(114)).toMatchObject({ surahNumber: 114, surah: null });
  });

  it.each([[0], [115], [999], [-1], [1.5], [Number.NaN], ["1"], [null]])(
    "returns null without reading anything for %s",
    async (n) => {
      expect(await getSurahPageDataImpl(n as number)).toBeNull();
      expect(m.fetchSurah).not.toHaveBeenCalled();
    },
  );
});
