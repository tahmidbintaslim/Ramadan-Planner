import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  setResponseStatus: vi.fn(),
  prisma: {
    hadithEdition: { findMany: vi.fn(), findUnique: vi.fn() },
    hadith: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus: m.setResponseStatus }));

import { getHadithChapterImpl, getHadithEditionImpl, getHadithListImpl } from "./hadith-impl";

beforeEach(() => {
  m.prisma.hadithEdition.findMany.mockReset();
  m.prisma.hadithEdition.findUnique.mockReset();
  m.prisma.hadith.findMany.mockReset();
  m.prisma.hadith.count.mockReset();
  m.prisma.$queryRaw.mockReset();
  m.setResponseStatus.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getHadithListImpl", () => {
  it("maps editions to cards, drops empty ones and duplicate '...1' editions, infers the language", async () => {
    m.prisma.hadithEdition.findMany.mockResolvedValue([
      { name: "ara-bukhari", title: "B", language: "Arabic", totalHadith: 1 },
      { name: "ara-bukhari1", title: "B1", language: null, totalHadith: 1 },
      { name: "ben-bukhari", title: "Bn", language: null, totalHadith: 1 },
      { name: "urd-muslim", title: "M", language: "Urdu", totalHadith: 1 },
      { name: "zzz-empty", title: "E", language: null, totalHadith: 0 },
    ]);
    m.prisma.$queryRaw.mockResolvedValue([
      { edition_name: "ara-bukhari", cnt: 7 },
      { edition_name: "ara-bukhari1", cnt: 7 },
      { edition_name: "ben-bukhari", cnt: 5 },
      { edition_name: "urd-muslim", cnt: 3 },
    ]);
    expect(await getHadithListImpl()).toEqual({
      loadError: false,
      editions: [
        { editionName: "ara-bukhari", editionLabel: "Bukhari", language: { key: "arabicLabel" }, count: 7 },
        { editionName: "ben-bukhari", editionLabel: "Bukhari", language: { key: "bengaliLabel" }, count: 5 },
        { editionName: "urd-muslim", editionLabel: "Muslim", language: { text: "Urdu" }, count: 3 },
      ],
    });
  });

  it("a database failure becomes loadError with no text from the error", async () => {
    m.prisma.hadithEdition.findMany.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
    const result = await getHadithListImpl();
    expect(result).toEqual({ editions: [], loadError: true });
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
    expect(m.setResponseStatus).toHaveBeenCalledWith(503);
  });
});

describe("getHadithEditionImpl", () => {
  it("unknown edition -> not_found", async () => {
    m.prisma.hadithEdition.findUnique.mockResolvedValue(null);
    expect(await getHadithEditionImpl("nope")).toEqual({ kind: "not_found" });
    expect(m.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("found -> chapters with plain numbers (bigint counts converted) and the hadith count", async () => {
    m.prisma.hadithEdition.findUnique.mockResolvedValue({ name: "ara-bukhari", title: "Sahih" });
    m.prisma.$queryRaw.mockResolvedValue([
      { book: "Faith", chapter: "C1", refBook: "1", cnt: BigInt(4) },
      { book: null, chapter: null, refBook: null, cnt: 2 },
    ]);
    m.prisma.hadith.count.mockResolvedValue(6);
    const result = await getHadithEditionImpl("ara-bukhari");
    expect(result).toEqual({
      kind: "ok",
      editionName: "ara-bukhari",
      title: "Sahih",
      chapters: [
        { book: "Faith", chapter: "C1", refBook: "1", cnt: 4 },
        { book: null, chapter: null, refBook: null, cnt: 2 },
      ],
      hadithCount: 6,
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("a database failure -> error kind, nothing leaked", async () => {
    m.prisma.hadithEdition.findUnique.mockRejectedValue(new Error("password authentication failed for user x"));
    const result = await getHadithEditionImpl("ara-bukhari");
    expect(result).toEqual({ kind: "error" });
    expect(m.setResponseStatus).toHaveBeenCalledWith(503);
  });
});

describe("getHadithChapterImpl", () => {
  const row = {
    id: 10,
    hadithNo: 5,
    book: "true",
    chapter: "Ch",
    text: "T",
    textArabic: "AR",
    reference: { book: 2, chapter: 3 },
  };

  it("unknown edition or no matching hadith -> not_found", async () => {
    m.prisma.hadithEdition.findUnique.mockResolvedValueOnce(null);
    expect(await getHadithChapterImpl("nope", "Ch")).toEqual({ kind: "not_found" });
    m.prisma.hadithEdition.findUnique.mockResolvedValueOnce({ name: "ara-bukhari", title: "S" });
    m.prisma.hadith.findMany.mockResolvedValueOnce([]);
    expect(await getHadithChapterImpl("ara-bukhari", "bad")).toEqual({ kind: "not_found" });
  });

  it("found -> items with resolved translations, normalized labels and the plain-text heading", async () => {
    m.prisma.hadithEdition.findUnique.mockResolvedValue({ name: "ara-bukhari", title: "Sahih" });
    m.prisma.hadith.findMany.mockImplementation(async (args: { where: { editionName: string } }) => {
      if (args.where.editionName === "ara-bukhari") return [row, { ...row, id: 11, hadithNo: null, reference: null, chapter: null, book: null }];
      if (args.where.editionName === "eng-bukhari") return [{ hadithNo: 5, text: "English" }];
      if (args.where.editionName === "ben-bukhari") return [{ hadithNo: 5, text: "  " }];
      return [];
    });
    const result = await getHadithChapterImpl("ara-bukhari", "Ch");
    expect(result).toEqual({
      kind: "ok",
      editionName: "ara-bukhari",
      editionTitle: "Sahih",
      chapterTitle: { text: "Ch" },
      items: [
        {
          id: 10,
          hadithNo: 5,
          bookLabel: "",
          chapterLabel: "Ch",
          refBook: "2",
          refChapter: "3",
          text: "T",
          textArabic: "AR",
          english: "English",
          bengali: null,
        },
        {
          id: 11,
          hadithNo: null,
          bookLabel: "",
          chapterLabel: "",
          refBook: null,
          refChapter: null,
          text: "T",
          textArabic: "AR",
          english: null,
          bengali: null,
        },
      ],
    });
  });

  it("the uncategorized and __book_N__ slugs keep the old filters and headings", async () => {
    m.prisma.hadithEdition.findUnique.mockResolvedValue({ name: "eng-x", title: null });
    m.prisma.hadith.findMany.mockResolvedValue([{ ...row, chapter: null }]);
    const un = await getHadithChapterImpl("eng-x", "__uncategorized__");
    expect(un).toMatchObject({ kind: "ok", editionTitle: null, chapterTitle: { text: "3" } });
    expect(m.prisma.hadith.findMany.mock.calls[0][0].where).toEqual({
      editionName: "eng-x",
      OR: [{ chapter: null }, { chapter: "" }],
    });

    m.prisma.hadith.findMany.mockClear();
    const bk = await getHadithChapterImpl("eng-x", "__book_12__");
    expect(bk).toMatchObject({ kind: "ok", chapterTitle: { bookNumber: "12" } });
    expect(m.prisma.hadith.findMany.mock.calls[0][0].where.reference).toEqual({ path: ["book"], equals: 12 });
  });

  it("a database failure -> error kind", async () => {
    m.prisma.hadithEdition.findUnique.mockRejectedValue(new Error("Can't reach database server at db:5432"));
    expect(await getHadithChapterImpl("ara-bukhari", "Ch")).toEqual({ kind: "error" });
  });
});
