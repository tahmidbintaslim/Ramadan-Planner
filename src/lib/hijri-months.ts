// Hijri month names in Bengali (by month number, 1 = Muharram). Shared by the timings service and the UI.
export const HIJRI_MONTHS_BN: Record<number, string> = {
  1: "মুহাররম",
  2: "সফর",
  3: "রবিউল আউয়াল",
  4: "রবিউস সানি",
  5: "জমাদিউল আউয়াল",
  6: "জমাদিউস সানি",
  7: "রজব",
  8: "শাবান",
  9: "রমজান",
  10: "শাওয়াল",
  11: "জিলকদ",
  12: "জিলহজ",
};

/** The Hijri month name in the UI language: Bengali by number in bn, the English name without diacritics in en. */
export function hijriMonthLabel(month: number | null | undefined, englishName: string | null | undefined, locale: string): string {
  if (locale.startsWith("bn") && month && HIJRI_MONTHS_BN[month]) return HIJRI_MONTHS_BN[month];
  const en = englishName ?? "";
  return en.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
