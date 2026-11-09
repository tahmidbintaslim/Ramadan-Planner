import { createServerFn } from "@tanstack/react-start";
import { getSiteUrl } from "@/server/site-url";
import { getLocaleFromRequest, loadMessages } from "./server";
import { LOCALES, setUserLocale, type Locale } from "@/lib/locale";

// Server function so client navigations can call it too; the root route caches the result.
// `siteUrl` ("" when unset) feeds canonical/og:url/JSON-LD in the per-route head().
// `lang`: the page URL's ?lang= (bn | en). It wins over the cookie and is remembered in it, so a visitor who lands on
// an English URL (a search result, a shared link) stays in English as they navigate.
export const getLocaleAndMessages = createServerFn({ method: "GET" })
  .validator((lang: unknown) => (LOCALES.includes(lang as Locale) ? (lang as Locale) : undefined))
  .handler(async ({ data: lang }) => {
    if (lang) await setUserLocale(lang);
    const locale = lang ?? (await getLocaleFromRequest());
    return { locale, messages: await loadMessages(locale), siteUrl: getSiteUrl() };
});
