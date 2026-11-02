import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import bn from "@/messages/bn.json";

vi.mock("@tanstack/react-start/server", () => ({ getCookie: vi.fn(), setCookie: vi.fn() }));

import { getTranslator, loadMessages, parseLocale, getLocaleFromRequest } from "./server";
import { getCookie } from "@tanstack/react-start/server";

describe("i18n server helpers", () => {
    it("loadMessages returns the real file's keys", async () => {
        const m = await loadMessages("bn");
        expect(Object.keys(m)).toEqual(Object.keys(bn));
    });

    it("renders a Bengali string with an ICU argument (digits are localized by the app, not the argument)", async () => {
        const t = (await getTranslator("bn", "landing")) as (k: string, v?: object) => string;
        expect(t("quranAyahs", { count: 286 })).toBe("286 আয়াত");
    });

    it("renders ICU plurals (no real plural key exists, so inline)", () => {
        const t = createTranslator({
            locale: "bn",
            messages: { x: "{n, plural, =0 {কিছু নেই} one {# টি} other {# টি}}" },
        });
        expect(t("x", { n: 0 })).toBe("কিছু নেই");
        expect(t("x", { n: 3 })).toBe("৩ টি");
    });

    it("falls back to bn for unknown locales", async () => {
        const t = (await getTranslator("fr" as never, "landing")) as (k: string, v?: object) => string;
        expect(t("quranAyahs", { count: 1 })).toBe("1 আয়াত");
    });

    it("missing key returns the key path without throwing", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const t = (await getTranslator("bn", "landing")) as (k: string) => string;
        expect(() => t("nope.nothing")).not.toThrow();
        expect(t("nope.nothing")).toBe("landing.nope.nothing");
        spy.mockRestore();
    });

    it("parses the locale cookie value, ignoring unknown values", async () => {
        expect(parseLocale("en")).toBe("en");
        expect(parseLocale("xx")).toBe("bn");
        expect(parseLocale(undefined)).toBe("bn");
        vi.mocked(getCookie).mockReturnValue("en");
        expect(await getLocaleFromRequest()).toBe("en");
        vi.mocked(getCookie).mockReturnValue("zz");
        expect(await getLocaleFromRequest()).toBe("bn");
    });
});
