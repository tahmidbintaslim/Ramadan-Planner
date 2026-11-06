import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getCookie: vi.fn(), setCookie: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: m.getCookie, setCookie: m.setCookie }));

import { localeCookieOptions, parseLocale, setUserLocale } from "./locale";

afterEach(() => vi.unstubAllEnvs());

describe("locale cookie", () => {
  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setUserLocale("en");
    expect(m.setCookie).toHaveBeenLastCalledWith("NEXT_LOCALE", "en", {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      secure: true,
    });
  });

  it("is not Secure in development (plain http dev server)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(localeCookieOptions().secure).toBe(false);
  });

  it("unknown values fall back to bn", () => {
    expect(parseLocale("xx")).toBe("bn");
    expect(parseLocale("en")).toBe("en");
  });
});
