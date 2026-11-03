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

const getHadithListFn = createServerFn({ method: "GET" }).handler(() => getHadithListImpl());

const getHadithEditionFn = createServerFn({ method: "GET" })
  .validator((edition: unknown) => edition as string)
  .handler(({ data }) => getHadithEditionImpl(data));

const getHadithChapterFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { edition: string; chapter: string })
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
