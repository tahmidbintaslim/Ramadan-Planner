import { test, expect, visit, HYDRATION } from "./fixtures";
import type { Page } from "@playwright/test";

// Quran list and Sadaqah & contribute page (design system v2, Task 10). The shipped config has no payment number
// or card URL, so the donation buttons are disabled; the donor flow with a number is covered by unit tests.

const SURAHS = [
  { surahNo: 1, nameArabic: "الفاتحة", nameArabicLong: "x", nameEnglish: "Al-Faatiha", nameTranslation: "The Opening", nameBengali: "আল-ফাতিহা", revelationPlace: "Mecca", totalAyah: 7 },
  { surahNo: 2, nameArabic: "البقرة", nameArabicLong: "x", nameEnglish: "Al-Baqara", nameTranslation: "The Cow", nameBengali: "আল-বাকারা", revelationPlace: "Madina", totalAyah: 286 },
  { surahNo: 18, nameArabic: "الكهف", nameArabicLong: "x", nameEnglish: "Al-Kahf", nameTranslation: "The Cave", nameBengali: "আল-কাহফ", revelationPlace: "Mecca", totalAyah: 110 },
];

async function mockSurahs(page: Page) {
  await page.route(/\/api\/quran$/, (r) => r.fulfill({ json: SURAHS }));
}

test.describe("Quran list (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn" });

  test("lists surahs as linked rows, with no last-read card until something was read", async ({ page, appErrors, consoleEntries }) => {
    await mockSurahs(page);
    await visit(page, "/quran");
    await expect(page.getByRole("heading", { level: 1, name: "কুরআন" })).toBeVisible();
    const rows = page.getByTestId("surah-list").getByRole("link");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toHaveAttribute("href", "/quran/2");
    await expect(rows.nth(1)).toContainText("মাদানী · ২৮৬ আয়াত");
    await expect(page.getByTestId("last-read-card")).toHaveCount(0);
    // Para / page / bookmark have no data yet: present but disabled.
    await expect(page.getByRole("button", { name: /পারা/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "সূরা" })).toHaveAttribute("aria-pressed", "true");
    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });

  test("shows the last-read card from this device and continues at that ayah", async ({ page }) => {
    await mockSurahs(page);
    await page.addInitScript(() => localStorage.setItem("rp_quran_last_read", JSON.stringify({ surah: 18, ayah: 10 })));
    await visit(page, "/quran");
    const card = page.getByTestId("last-read-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("যেখানে থেমেছিলেন");
    await expect(card).toContainText("আল-কাহফ");
    await expect(card).toContainText("আয়াত ১০");
    const cont = card.getByRole("link", { name: /আজ এখান থেকে আবার শুরু করুন/ });
    await expect(cont).toHaveAttribute("href", /\/quran\/18#ayah-10$/);
    const box = await cont.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });

  test("search filters the rows", async ({ page }) => {
    await mockSurahs(page);
    await visit(page, "/quran");
    await page.getByRole("searchbox").fill("কাহফ");
    await expect(page.getByTestId("surah-list").getByRole("link")).toHaveCount(1);
  });
});

test.describe("Support page (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "bn" });

  test("renders the appeal, ledger placeholders and disabled donation buttons, indexable, no console errors", async ({ page, appErrors, consoleEntries }) => {
    const res = await visit(page, "/support");
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.getByRole("heading", { level: 1, name: "সাদাকা ও সহযোগিতা" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "এই আমল চলমান থাকুক" })).toBeVisible();
    await expect(page.getByText("রমজান ২০২৭-এর খরচ")).toBeVisible();
    await expect(page.getByTestId("cost-server")).toHaveText("শীঘ্রই প্রকাশ করা হবে");

    const wallet = page.getByTestId("wallet-button");
    await expect(wallet).toBeDisabled();
    await expect(wallet).toHaveText("শীঘ্রই চালু হবে");
    await expect(page.getByTestId("card-button")).toBeDisabled();
    await expect(page.getByTestId("support-note")).toContainText("কর-রেয়াতযোগ্য নয়");

    // Amount chips and the custom field.
    await page.getByRole("button", { name: "অন্য" }).click();
    await page.getByLabel("অন্য পরিমাণ (৳)").fill("5");
    await expect(page.getByRole("alert")).toContainText("সর্বনিম্ন ৳১০");

    // Contribute links.
    await expect(page.getByTestId("repo-link")).toHaveAttribute("href", "https://github.com/tahmidbintaslim/Ramadan-Planner");
    await expect(page.getByTestId("share-button")).toBeVisible();

    expect(appErrors()).toEqual([]);
    expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
  });

  test("is reachable from the More sheet and the last card clears the bottom nav", async ({ page }) => {
    await visit(page, "/today");
    const nav = page.getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ }).first();
    await nav.getByRole("button", { name: /আরও|More/ }).click();
    await page.getByRole("dialog").getByRole("link", { name: "সহযোগিতা" }).click();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByRole("heading", { level: 1, name: "সাদাকা ও সহযোগিতা" })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.getByTestId("share-button").boundingBox())!;
    const navBox = (await nav.boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(navBox.y);
    expect(last.height).toBeGreaterThanOrEqual(48);
  });
});

test.describe("Support page (English)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "en" });
  test("renders in English", async ({ page }) => {
    await visit(page, "/support");
    await expect(page.getByRole("heading", { level: 1, name: "Sadaqah & Support" })).toBeVisible();
    await expect(page.getByTestId("wallet-button")).toHaveText("Coming soon");
  });
});
