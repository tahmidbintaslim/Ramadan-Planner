// Loader server functions for the /hadith pages. PUBLIC reads (no authMiddleware: the old pages had no auth).
// Bodies are server-only (src/server/hadith-impl.ts, the only place Prisma is touched).
import { createServerFn } from "@tanstack/react-start";
import {
  getHadithChapterImpl,
  getHadithEditionImpl,
  getHadithListImpl,
} from "@/server/hadith-impl";
import type { HadithChapterData, HadithEditionData, HadithListData } from "@/server/hadith-impl";

export type {
  HadithChapterData,
  HadithEditionData,
  HadithEditionCard,
  HadithItem,
  HadithListData,
} from "@/server/hadith-impl";

// Route params are attacker-controlled. Anything that is not a short string becomes "" (the Impls answer
// not_found for it) instead of reaching the database. Edition names are short slugs ("ben-bukhari");
// chapter params are book numbers or "__book_<ref>__".
const MAX_EDITION_LENGTH = 100;
const MAX_CHAPTER_LENGTH = 200;
function boundedString(value: unknown, max: number): string {
  return typeof value === "string" && value.length <= max ? value : "";
}

const getHadithListFn = createServerFn({ method: "GET" }).handler(() => getHadithListImpl());

const getHadithEditionFn = createServerFn({ method: "GET" })
  .validator((edition: unknown) => boundedString(edition, MAX_EDITION_LENGTH))
  .handler(({ data }) => getHadithEditionImpl(data));

const getHadithChapterFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const { edition, chapter } = (input ?? {}) as { edition?: unknown; chapter?: unknown };
    return {
      edition: boundedString(edition, MAX_EDITION_LENGTH),
      chapter: boundedString(chapter, MAX_CHAPTER_LENGTH),
    };
  })
  .handler(({ data }) => getHadithChapterImpl(data.edition, data.chapter));

export function getHadithList(): Promise<HadithListData> {
  return getHadithListFn();
}
export function getHadithEdition(edition: string): Promise<HadithEditionData> {
  return getHadithEditionFn({ data: edition });
}
export function getHadithChapter(edition: string, chapter: string): Promise<HadithChapterData> {
  return getHadithChapterFn({ data: { edition, chapter } });
}
