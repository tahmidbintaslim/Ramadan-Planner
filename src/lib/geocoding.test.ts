import { describe, expect, it } from "vitest";
import { parseCityResults } from "./geocoding";

describe("parseCityResults", () => {
  it("keeps name, region/country, coordinates and zone; drops malformed rows", () => {
    const body = {
      results: [
        { id: 1, name: "Chicago", latitude: 41.85, longitude: -87.65, timezone: "America/Chicago", country: "United States", admin1: "Illinois", country_code: "US" },
        { id: 2, name: "Nowhere", latitude: 1, longitude: 1, timezone: "Not/AZone" },
        { id: 3, name: "", latitude: 1, longitude: 1, timezone: "UTC" },
        { id: 4, name: "NaN", latitude: "1", longitude: 1, timezone: "UTC" },
      ],
    };
    expect(parseCityResults(body)).toEqual([
      { id: 1, name: "Chicago", detail: "Illinois, United States", country_code: "US", latitude: 41.85, longitude: -87.65, timezone: "America/Chicago" },
    ]);
    expect(parseCityResults({})).toEqual([]);
    expect(parseCityResults(null)).toEqual([]);
  });
});
