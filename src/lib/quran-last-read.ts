// Where the reader stopped, kept on this device only (localStorage). Read by the Quran list's "last read" card;
// written by the reader. Nothing is sent to a server.

const KEY = "rp_quran_last_read";

export interface LastRead {
  surah: number;
  ayah: number;
}

function isPosInt(n: unknown, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max;
}

/** Validates unknown JSON from storage: surah 1..114, ayah 1..286 (the longest surah). */
export function parseLastRead(raw: string | null): LastRead | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastRead> | null;
    if (v && isPosInt(v.surah, 114) && isPosInt(v.ayah, 286)) return { surah: v.surah, ayah: v.ayah };
  } catch {
    // corrupt value
  }
  return null;
}

export function readLastRead(): LastRead | null {
  try {
    return parseLastRead(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writeLastRead(value: LastRead): void {
  if (!isPosInt(value.surah, 114) || !isPosInt(value.ayah, 286)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage blocked or full: the card just stays hidden
  }
}

/** Link target for "continue reading": the surah page, scrolled to the ayah when past the first. */
export function lastReadHref({ surah, ayah }: LastRead): string {
  return ayah > 1 ? `/quran/${surah}#ayah-${ayah}` : `/quran/${surah}`;
}
