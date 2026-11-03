// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { lastReadHref, parseLastRead, readLastRead, writeLastRead } from "./quran-last-read";

afterEach(() => localStorage.clear());

describe("quran last read", () => {
  it("round-trips through localStorage", () => {
    expect(readLastRead()).toBeNull();
    writeLastRead({ surah: 18, ayah: 10 });
    expect(readLastRead()).toEqual({ surah: 18, ayah: 10 });
  });
  it("rejects invalid and corrupt values", () => {
    expect(parseLastRead("{not json")).toBeNull();
    expect(parseLastRead(JSON.stringify({ surah: 0, ayah: 1 }))).toBeNull();
    expect(parseLastRead(JSON.stringify({ surah: 115, ayah: 1 }))).toBeNull();
    expect(parseLastRead(JSON.stringify({ surah: 2, ayah: 287 }))).toBeNull();
    expect(parseLastRead(JSON.stringify({ surah: "2", ayah: 1 }))).toBeNull();
    expect(parseLastRead(null)).toBeNull();
    writeLastRead({ surah: 500, ayah: 1 });
    expect(readLastRead()).toBeNull();
  });
  it("links to the ayah only past the first", () => {
    expect(lastReadHref({ surah: 2, ayah: 1 })).toBe("/quran/2");
    expect(lastReadHref({ surah: 2, ayah: 255 })).toBe("/quran/2#ayah-255");
  });
});
