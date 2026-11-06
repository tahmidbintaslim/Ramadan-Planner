// The app's sourced Ramadan duas, in one place: the Home phase card, the Laylatul Qadr card on /plan and the /duas
// page all read them from here. Each has Arabic, a transliteration, a meaning and a reference line (messages
// `duas.items.<id>.*`); nothing here is new religious text.
//
// - Laylatul Qadr: the Arabic was already in the app (Tirmidhi 3513).
// - Iftar dua and niyyah: the transliteration, meaning and reference were already in the app; the Arabic lines are
//   the original script of those same transliterations and are marked `arabicReview: true` until a scholar has
//   checked them (the niyyah's reference line already says it is pending scholar review).

export type DuaCategory = "sehri" | "iftar" | "lastTen";
export type DuaId = "niyyah" | "iftar" | "qadr";

export interface Dua {
  id: DuaId;
  category: DuaCategory;
  arabic: string;
  /** The Arabic line still needs a scholar's check (shown as written; flagged for the review workflow). */
  arabicReview?: boolean;
}

export const DUA_CATEGORIES: readonly DuaCategory[] = ["sehri", "iftar", "lastTen"];

export const DUAS: readonly Dua[] = [
  { id: "niyyah", category: "sehri", arabic: "نَوَيْتُ أَنْ أَصُومَ غَدًا مِنْ شَهْرِ رَمَضَانَ", arabicReview: true },
  {
    id: "iftar",
    category: "iftar",
    arabic: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ",
    arabicReview: true,
  },
  { id: "qadr", category: "lastTen", arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي" },
];

export function duaById(id: DuaId): Dua {
  const dua = DUAS.find((d) => d.id === id);
  if (!dua) throw new Error(`unknown dua ${id}`);
  return dua;
}

export function duasIn(category: DuaCategory): Dua[] {
  return DUAS.filter((d) => d.category === category);
}
