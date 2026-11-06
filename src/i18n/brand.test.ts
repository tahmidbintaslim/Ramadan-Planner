import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { APP_NAME_TOKEN, withBrand } from "./brand";

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("withBrand", () => {
  it("fills the app-name token from common.appName, deeply", () => {
    const m = withBrand({ common: { appName: "X" }, a: { b: `Use ${APP_NAME_TOKEN} today`, c: `${APP_NAME_TOKEN}-এর` } });
    expect(m.a).toEqual({ b: "Use X today", c: "X-এর" });
    expect(withBrand({ a: "plain" })).toEqual({ a: "plain" });
  });

  it("no brand spelling outside common.appName in either message file", () => {
    for (const [file, brand] of [
      [bn, /রমজান প্ল্যানার|Ramadan Planner/],
      [en, /Ramadan Planner/],
    ] as const) {
      const { appName, ...rest } = (file as { common: Record<string, string> }).common;
      expect(appName).toMatch(brand);
      const others = strings({ ...file, common: rest });
      expect(others.filter((s) => brand.test(s))).toEqual([]);
    }
  });

  it("every message with the token resolves to the app name", () => {
    for (const file of [bn, en]) {
      const resolved = strings(withBrand(file as never));
      expect(resolved.some((s) => s.includes(APP_NAME_TOKEN))).toBe(false);
    }
  });
});
