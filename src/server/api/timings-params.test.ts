import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
import { timingsParamError } from "./timings";

const now = new Date("2026-11-08T00:00:00Z");
const err = (q: string) => timingsParamError(new URLSearchParams(q), now);

describe("timingsParamError", () => {
  it("accepts the app's own requests", () => {
    expect(err("tz=Asia/Dhaka&date=2026-11-08&lat=23.81&lng=90.41")).toBeNull();
    expect(err("date=2027-02-20")).toBeNull();
  });
  it("rejects cache-busting extras, far dates and long labels", () => {
    expect(err("tz=Asia/Dhaka&x=1")).toBe("Unknown parameter");
    expect(err("date=2031-01-01")).toBe("Date out of range");
    expect(err(`location=${"a".repeat(121)}`)).toBe("Invalid location");
  });
});

describe("calculation params", () => {
  it("accepts allowlisted method, school, country and Hijri adjustment", () => {
    expect(err("tz=America/Chicago&method=2&school=0&cc=US&hadj=-1")).toBeNull();
    expect(err("method=0&school=1&hadj=2")).toBeNull();
  });
  it("rejects anything else before it reaches AlAdhan", () => {
    expect(err("method=6")).toBe("Invalid method");
    expect(err("method=99")).toBe("Invalid method");
    expect(err("method=1%26tune%3D9")).toBe("Invalid method");
    expect(err("school=2")).toBe("Invalid school");
    expect(err("cc=usa")).toBe("Invalid country");
    expect(err("hadj=3")).toBe("Invalid Hijri adjustment");
  });
});
