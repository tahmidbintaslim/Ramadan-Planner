import { describe, expect, it } from "vitest";
import {
  DHAKA_DEFAULTS,
  locationLabelFromTimezone,
  todayDateString,
} from "./prayer-times";

describe("prayer-times helpers", () => {
  it("derives readable city labels from timezone", () => {
    expect(locationLabelFromTimezone("Asia/Dhaka")).toBe("Dhaka");
    expect(locationLabelFromTimezone("America/New_York")).toBe("New York");
  });

  it("returns DD-MM-YYYY format for date string", () => {
    const value = todayDateString("Asia/Dhaka");
    expect(value).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });

  it("keeps Dhaka defaults stable", () => {
    expect(DHAKA_DEFAULTS.timezone).toBe("Asia/Dhaka");
    expect(DHAKA_DEFAULTS.latitude).toBe(23.8103);
    expect(DHAKA_DEFAULTS.longitude).toBe(90.4125);
  });
});
