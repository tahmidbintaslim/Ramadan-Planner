import { createServerFn } from "@tanstack/react-start";
import { getLocaleFromRequest, loadMessages } from "./server";

// Server function so client navigations can call it too; the root route caches the result.
export const getLocaleAndMessages = createServerFn({ method: "GET" }).handler(async () => {
    const locale = await getLocaleFromRequest();
    return { locale, messages: await loadMessages(locale) };
});
