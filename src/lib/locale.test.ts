import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getCookie: vi.fn(), setCookie: vi.fn(), getRequestHeader: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: m.getCookie, setCookie: m.setCookie, getRequestHeader: m.getRequestHeader }));

import { getUserLocale, localeCookieOptions, negotiateLocale, parseLocale, setUserLocale } from "./locale";

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

describe("first-visit locale", () => {
  it("Bangladesh is Bengali even with an English browser", () => {
    expect(negotiateLocale("en-US,en;q=0.9", "BD")).toBe("bn");
  });
  it("a browser listing Bengali gets Bengali anywhere", () => {
    expect(negotiateLocale("en-GB,bn;q=0.8", "GB")).toBe("bn");
    expect(negotiateLocale("bn-BD", null)).toBe("bn");
  });
  it("other languages abroad get English", () => {
    expect(negotiateLocale("th-TH,th;q=0.9,en;q=0.8", "TH")).toBe("en");
    expect(negotiateLocale("en-US", undefined)).toBe("en");
  });
  it("nothing known stays Bengali", () => {
    expect(negotiateLocale(undefined, undefined)).toBe("bn");
    expect(negotiateLocale("*", null)).toBe("bn");
  });
  it("the cookie wins over the request", async () => {
    m.getCookie.mockReturnValueOnce("bn");
    m.getRequestHeader.mockReturnValue("en-US");
    expect(await getUserLocale()).toBe("bn");
  });
});
