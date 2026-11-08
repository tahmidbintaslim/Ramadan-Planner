// The default-suggestion titles in both languages, so an item added in one language is still recognised as its
// suggestion after a language switch or on a device set to the other language (matchDefaultKey). Only these few
// strings are bundled, not the other language's whole message file. They must equal `plan.items.<key>` in
// src/messages/bn.json and en.json (default-titles.test.ts fails otherwise); keys match DAY_DEFAULTS/NIGHT_DEFAULTS.
// `aliases` are earlier titles of the same suggestion, still recognised for items added before a rename.
export const DEFAULT_TITLES: Readonly<Record<string, { readonly bn: string; readonly en: string; readonly aliases?: readonly string[] }>> = {
  sehri: { bn: "সেহরি ও নিয়ত", en: "Sehri and intention" },
  fajr: { bn: "ফজরের নামাজ", en: "Fajr prayer", aliases: ["ফজর জামাতে", "Fajr in congregation"] },
  morningDhikr: { bn: "সকালের যিকির", en: "Morning dhikr" },
  quran: { bn: "কুরআন · আজকের পারা", en: "Quran · today's juz" },
  charity: { bn: "দান · আজকের লক্ষ্য", en: "Charity · today's goal" },
  taraweeh: { bn: "তারাবি", en: "Taraweeh" },
  sleepDhikr: { bn: "ঘুমের আগের যিকির", en: "Dhikr before sleep" },
  // Isha itself is recorded once, in the salah tracker; the night list keeps the taraweeh (shown with Isha's time).
  "night:ishaTaraweeh": { bn: "ইশা ও তারাবি", en: "Isha and Taraweeh", aliases: ["এশা ও তারাবি", "রাতের তারাবি", "Night taraweeh"] },
  "night:nightQuran": { bn: "কুরআন তিলাওয়াত", en: "Quran recitation" },
  "night:tahajjud": { bn: "তাহাজ্জুদ", en: "Tahajjud" },
  "night:qadrDua": { bn: "লাইলাতুল কদরের দোয়া", en: "Laylatul Qadr dua", aliases: ["Laylat al-Qadr dua"] },
};

/** Every known title per default key: both bundled languages plus any extra (e.g. the current locale's message). */
export function defaultTitlesByKey(extra: Readonly<Record<string, string>> = {}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, { bn, en, aliases = [] }] of Object.entries(DEFAULT_TITLES)) {
    out[key] = [...new Set([extra[key], bn, en, ...aliases].filter((x): x is string => Boolean(x)))];
  }
  for (const [key, title] of Object.entries(extra)) if (!out[key]) out[key] = [title];
  return out;
}
