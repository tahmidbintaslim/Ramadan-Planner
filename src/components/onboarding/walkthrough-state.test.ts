// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WALKTHROUGH_SEEN_KEY,
  clampSlide,
  markWalkthroughSeen,
  primaryAction,
  slideForKey,
  slideFromScroll,
  walkthroughSeen,
} from "./walkthrough-state";

describe("walkthrough carousel state", () => {
  it("clamps to the slides that exist", () => {
    expect(clampSlide(-1, 4)).toBe(0);
    expect(clampSlide(2, 4)).toBe(2);
    expect(clampSlide(9, 4)).toBe(3);
  });

  it("reads the slide from the snap position, rounding mid-swipe", () => {
    expect(slideFromScroll(0, 390, 4)).toBe(0);
    expect(slideFromScroll(390 * 2, 390, 4)).toBe(2);
    expect(slideFromScroll(390 * 1.4, 390, 4)).toBe(1);
    expect(slideFromScroll(390 * 1.6, 390, 4)).toBe(2);
    expect(slideFromScroll(99_999, 390, 4)).toBe(3);
    expect(slideFromScroll(-390, 390, 4)).toBe(1); // RTL scrollers count down from 0
    expect(slideFromScroll(100, 0, 4)).toBe(0); // not laid out yet
  });

  it("pages with the arrow keys, Home and End, and ignores other keys", () => {
    expect(slideForKey("ArrowRight", 0, 4)).toBe(1);
    expect(slideForKey("ArrowRight", 3, 4)).toBe(3);
    expect(slideForKey("ArrowLeft", 0, 4)).toBe(0);
    expect(slideForKey("ArrowLeft", 2, 4)).toBe(1);
    expect(slideForKey("Home", 3, 4)).toBe(0);
    expect(slideForKey("End", 0, 4)).toBe(3);
    expect(slideForKey("Enter", 1, 4)).toBeNull();
  });

  it("says Next until the last slide, then finish", () => {
    expect(primaryAction(0, 4)).toBe("next");
    expect(primaryAction(2, 4)).toBe("next");
    expect(primaryAction(3, 4)).toBe("finish");
  });
});

describe("walkthrough seen flag", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is unset on a fresh device and set once marked", () => {
    expect(walkthroughSeen()).toBe(false);
    markWalkthroughSeen();
    expect(localStorage.getItem(WALKTHROUGH_SEEN_KEY)).toBe("1");
    expect(walkthroughSeen()).toBe(true);
  });

  it("counts as seen when storage is blocked, so it never loops", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(walkthroughSeen()).toBe(true);
  });
});
