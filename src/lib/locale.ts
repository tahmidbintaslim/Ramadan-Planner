import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";

const COOKIE_NAME = "NEXT_LOCALE";

/** Unknown or missing values fall back to the default locale. */
export function parseLocale(value: string | undefined | null): Locale {
    return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/**
 * First visit (no cookie): Bengali in Bangladesh or when the browser lists Bengali; English for any other browser
 * language abroad (international users); Bengali when nothing is known. Many Bangladeshi phones are set to English,
 * so the visitor's country (Vercel's x-vercel-ip-country) wins over the browser language.
 */
export function negotiateLocale(acceptLanguage: string | undefined | null, country: string | undefined | null): Locale {
    if (country?.toUpperCase() === "BD") return "bn";
    const langs = (acceptLanguage ?? "")
        .split(",")
        .map((part) => part.split(";")[0].trim().toLowerCase())
        .filter((l) => l && l !== "*");
    if (langs.length === 0) return DEFAULT_LOCALE;
    return langs.some((l) => l === "bn" || l.startsWith("bn-")) ? "bn" : "en";
}

export async function getUserLocale(): Promise<Locale> {
    const cookie = getCookie(COOKIE_NAME);
    if (cookie) return parseLocale(cookie);
    return negotiateLocale(getRequestHeader("accept-language"), getRequestHeader("x-vercel-ip-country"));
}

/** Attributes of the locale cookie: Secure in production (HTTPS only; browsers also accept it on http://localhost). */
export function localeCookieOptions() {
    return {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
    };
}

export async function setUserLocale(locale: Locale): Promise<void> {
    setCookie(COOKIE_NAME, locale, localeCookieOptions());
}
