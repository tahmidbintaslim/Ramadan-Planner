/** localStorage flag: the first-run walkthrough has been seen (or skipped) on this device. */
export const WALKTHROUGH_SEEN_KEY = "rp_walkthrough_seen";

export function walkthroughSeen(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_SEEN_KEY) === "1";
  } catch {
    // Storage blocked: never trap the visitor in the walkthrough, and never replay it either.
    return true;
  }
}

export function markWalkthroughSeen(): void {
  try {
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, "1");
  } catch {
    // Storage blocked: nothing to remember.
  }
}

export function clampSlide(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}

/** The slide a snap-scroller shows: the nearest whole page (works for RTL's negative scrollLeft too). */
export function slideFromScroll(scrollLeft: number, width: number, count: number): number {
  if (width <= 0) return 0;
  return clampSlide(Math.round(Math.abs(scrollLeft) / width), count);
}

/** Keyboard paging for the carousel; null when the key is not ours. */
export function slideForKey(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return clampSlide(index + 1, count);
    case "ArrowLeft":
      return clampSlide(index - 1, count);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** The primary button: Next until the last slide, then Get started (finish). */
export function primaryAction(index: number, count: number): "next" | "finish" {
  return index >= count - 1 ? "finish" : "next";
}
