import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

function env(site: string, pub: string, vercel: string) {
  vi.stubEnv("SITE_URL", site);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", pub);
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", vercel);
}

describe("getSiteUrl", () => {
  it("prefers SITE_URL, then NEXT_PUBLIC_SITE_URL, then the Vercel host", () => {
    env("https://a.example/", "https://b.example", "c.example");
    expect(getSiteUrl()).toBe("https://a.example");
    env("", "https://b.example///", "c.example");
    expect(getSiteUrl()).toBe("https://b.example");
    env("  ", "", "c.example");
    expect(getSiteUrl()).toBe("https://c.example");
  });

  it("is empty when nothing is configured", () => {
    env("", "", "");
    expect(getSiteUrl()).toBe("");
  });
});
