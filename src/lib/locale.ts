import { cookies } from "next/headers";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";

const COOKIE_NAME = "NEXT_LOCALE";

export async function getUserLocale(): Promise<Locale> {
    const cookieStore = await cookies();
    const locale = cookieStore.get(COOKIE_NAME)?.value;
    if (locale && LOCALES.includes(locale as Locale)) {
        return locale as Locale;
    }
    return DEFAULT_LOCALE;
}

export async function setUserLocale(locale: Locale): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax",
    });
}
