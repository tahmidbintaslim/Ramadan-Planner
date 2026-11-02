import { createServerFn } from "@tanstack/react-start";
import { getSiteUrl } from "@/server/site-url";
import { getLocaleFromRequest, loadMessages } from "./server";

// Server function so client navigations can call it too; the root route caches the result.
// `siteUrl` ("" when unset) feeds canonical/og:url/JSON-LD in the per-route head().
export const getLocaleAndMessages = createServerFn({ method: "GET" }).handler(async () => {
    const locale = await getLocaleFromRequest();
    return { locale, messages: await loadMessages(locale), siteUrl: getSiteUrl() };
});
