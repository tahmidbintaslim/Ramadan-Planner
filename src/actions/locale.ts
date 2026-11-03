// Locale switching as server functions. No auth middleware: guests switch the language too.
// Callers must run `router.invalidate()` afterwards so the root loader re-reads the cookie and messages.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getUserLocale, LOCALES, setUserLocale, type Locale } from "@/lib/locale";

const switchLocaleFn = createServerFn({ method: "POST" }).handler(async () => {
    const current = await getUserLocale();
    const next: Locale = current === "bn" ? "en" : "bn";
    await setUserLocale(next);
});

const setLocaleFn = createServerFn({ method: "POST" })
    .validator(z.enum(LOCALES))
    .handler(async ({ data }) => {
        await setUserLocale(data);
    });

export async function switchLocaleAction(): Promise<void> {
    await switchLocaleFn();
}

export async function setLocaleAction(locale: Locale): Promise<void> {
    await setLocaleFn({ data: locale });
}
