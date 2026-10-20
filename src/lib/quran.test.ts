import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  quranSurah: { findMany: vi.fn(), findUnique: vi.fn() },
  quranReciter: { findMany: vi.fn() },
  quranAyah: { count: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const EXTERNAL_LIST = [
  {
    surahName: "Al-Faatiha",
    surahNameArabic: "الفاتحة",
    surahNameArabicLong: "سورة الفاتحة",
    surahNameTranslation: "The Opening",
    revelationPlace: "Mecca",
    totalAyah: 7,
  },
];

const EXTERNAL_SURAH_112 = {
  surahName: "Al-Ikhlaas",
  surahNameArabic: "الإخلاص",
  surahNameArabicLong: "سورة الإخلاص",
  surahNameTranslation: "Sincerity",
  revelationPlace: "Mecca",
  totalAyah: 2,
  surahNo: 112,
  audio: {
    "1": { reciter: "Reciter One", url: "https://a.example/1.mp3", originalUrl: "https://b.example/1.mp3" },
  },
  english: ["Say, He is Allah, One.", "Allah, the Eternal."],
  arabic1: ["قُلْ هُوَ ٱللَّهُ أَحَدٌ", "ٱللَّهُ ٱلصَّمَدُ"],
  arabic2: ["قل هو الله احد", "الله الصمد"],
  bengali: ["বল, তিনিই আল্লাহ, এক-অদ্বিতীয়।", "আল্লাহ কারো মুখাপেক্ষী নন।"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("quran service fallback", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
    prismaMock.quranSurah.findMany.mockReset();
    prismaMock.quranSurah.findUnique.mockReset();
    prismaMock.quranReciter.findMany.mockReset();
  });

  it("uses the external surah list when the DB query throws", async () => {
    prismaMock.quranSurah.findMany.mockRejectedValue(new Error("Can't reach database server"));
    fetchMock.mockResolvedValue(jsonResponse(EXTERNAL_LIST));

    const { fetchSurahList } = await import("./quran");
    const list = await fetchSurahList();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ surahNo: 1, nameEnglish: "Al-Faatiha", nameBengali: "আল-ফাতিহা" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://quranapi.pages.dev/api/surah.json",
      expect.anything(),
    );
  });

  it("still uses the external surah list when the DB is empty", async () => {
    prismaMock.quranSurah.findMany.mockResolvedValue([]);
    fetchMock.mockResolvedValue(jsonResponse(EXTERNAL_LIST));

    const { fetchSurahList } = await import("./quran");
    expect(await fetchSurahList()).toHaveLength(1);
  });

  it("returns an empty list when both the DB and the external API fail", async () => {
    prismaMock.quranSurah.findMany.mockRejectedValue(new Error("db down"));
    fetchMock.mockResolvedValue(jsonResponse({}, 502));

    const { fetchSurahList } = await import("./quran");
    expect(await fetchSurahList()).toEqual([]);
  });

  it("loads a single surah from the external API when the DB query throws", async () => {
    prismaMock.quranSurah.findUnique.mockRejectedValue(new Error("db down"));
    fetchMock.mockResolvedValue(jsonResponse(EXTERNAL_SURAH_112));

    const { fetchSurah } = await import("./quran");
    const surah = await fetchSurah(112);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://quranapi.pages.dev/api/112.json",
      expect.anything(),
    );
    expect(surah).not.toBeNull();
    expect(surah?.nameBengali).toBe("আল-ইখলাস");
    expect(surah?.audio["1"].reciter).toBe("Reciter One");
    expect(surah?.ayahs).toHaveLength(2);
    expect(surah?.ayahs[1]).toMatchObject({
      ayahNo: 2,
      textArabicClean: "الله الصمد",
      textEnglish: "Allah, the Eternal.",
      audio: {},
    });
  });

  it("returns null for a surah when both sources fail", async () => {
    prismaMock.quranSurah.findUnique.mockRejectedValue(new Error("db down"));
    fetchMock.mockRejectedValue(new Error("network down"));

    const { fetchSurah } = await import("./quran");
    expect(await fetchSurah(1)).toBeNull();
  });

  it("falls back to the external reciter list on a DB error", async () => {
    prismaMock.quranReciter.findMany.mockRejectedValue(new Error("db down"));
    fetchMock.mockResolvedValue(jsonResponse({ "2": "Reciter Two", "1": "Reciter One" }));

    const { fetchReciters } = await import("./quran");
    expect(await fetchReciters()).toEqual([
      { id: 1, name: "Reciter One" },
      { id: 2, name: "Reciter Two" },
    ]);
  });
});
