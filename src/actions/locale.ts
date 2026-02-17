"use server";

import { getUserLocale, setUserLocale, type Locale } from "@/lib/locale";

export async function switchLocaleAction(): Promise<void> {
    const current = await getUserLocale();
    const next: Locale = current === "bn" ? "en" : "bn";
    await setUserLocale(next);
}

export async function setLocaleAction(locale: Locale): Promise<void> {
    await setUserLocale(locale);
}
