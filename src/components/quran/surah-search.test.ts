import { describe, expect, it } from "vitest";
import { normalizeSearch } from "./quran-surah-list";

describe("normalizeSearch", () => {
  const hit = (name: string, query: string) => normalizeSearch(name).includes(normalizeSearch(query));
  it("folds Bengali long and short vowels", () => {
    expect(hit("ইয়াসীন", "ইয়াসিন")).toBe(true);
  });
  it("ignores case, hyphens and long-vowel spellings in Latin", () => {
    expect(hit("Ya-Sin", "yasin")).toBe(true);
    expect(hit("Yaa-Seen", "yasin")).toBe(true);
    expect(hit("Al-Baqara", "al baqara")).toBe(true);
  });
  it("still rejects unrelated names", () => {
    expect(hit("Al-Kahf", "yasin")).toBe(false);
  });
});
