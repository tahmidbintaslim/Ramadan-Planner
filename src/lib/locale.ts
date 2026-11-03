import { getCookie, setCookie } from "@tanstack/react-start/server";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";

const COOKIE_NAME = "NEXT_LOCALE";

/** Unknown or missing values fall back to the default locale. */
export function parseLocale(value: string | undefined | null): Locale {
    return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getUserLocale(): Promise<Locale> {
    return parseLocale(getCookie(COOKIE_NAME));
}

export async function setUserLocale(locale: Locale): Promise<void> {
    setCookie(COOKIE_NAME, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax",
    });
}
