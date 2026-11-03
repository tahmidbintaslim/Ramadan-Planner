import { createTranslator, type AbstractIntlMessages } from "use-intl/core";
import { getUserLocale, parseLocale, type Locale } from "@/lib/locale";

export { LOCALES, DEFAULT_LOCALE, parseLocale, type Locale } from "@/lib/locale";

/** Reads the NEXT_LOCALE cookie of the current request (default bn). */
export const getLocaleFromRequest = (): Promise<Locale> => getUserLocale();

export async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
    // parseLocale guards the dynamic path against unexpected values.
    return (await import(`../messages/${parseLocale(locale)}.json`)).default;
}

export async function getTranslator(locale: Locale, namespace?: string) {
    const safe = parseLocale(locale);
    return createTranslator({ locale: safe, messages: await loadMessages(safe), namespace });
}

// Same names as the old Next.js i18n server helpers so server pages port with an import change.
export async function getLocale(): Promise<Locale> {
    return getLocaleFromRequest();
}

export async function getTranslations(namespace?: string) {
    return getTranslator(await getLocaleFromRequest(), namespace);
}
