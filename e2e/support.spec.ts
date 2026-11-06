import { test, expect, visit, HYDRATION } from "./fixtures";
import type { Page } from "@playwright/test";

// Quran list and Sadaqah & contribute page (design system v2, Task 10). The shipped config has no payment number
// or card URL, so the bKash/Nagad button is disabled; the donor flow with a number is covered by unit tests.
// Card donations (Stripe) depend on the BUILD-TIME flag VITE_STRIPE_DONATIONS_ENABLED: CI builds the e2e server
// with it on (the Vercel build keeps it off). Tests for one state skip themselves on a build with the other.

const SURAHS = [
  { surahNo: 1, nameArabic: "الفاتحة", nameArabicLong: "x", nameEnglish: "Al-Faatiha", nameTranslation: "The Opening", nameBengali: "আল-ফাতিহা", revelationPlace: "Mecca", totalAyah: 7 },
  { surahNo: 2, nameArabic: "البقرة", nameArabicLong: "x", nameEnglish: "Al-Baqara", nameTranslation: "The Cow", nameBengali: "আল-বাকারা", revelationPlace: "Madina", totalAyah: 286 },
  { surahNo: 18, nameArabic: "الكهف", nameArabicLong: "x", nameEnglish: "Al-Kahf", nameTranslation: "The Cave", nameBengali: "আল-কাহফ", revelationPlace: "Mecca", totalAyah: 110 },
];

/** Whether this build has card donations on (VITE_STRIPE_DONATIONS_ENABLED=true at build time). */
async function stripeOn(page: Page): Promise<boolean> {
  return (await page.getByTestId("give-card").getAttribute("data-stripe-enabled")) === "true";
}

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
    if (await stripeOn(page)) {
      // The Stripe form replaces the "coming soon" card button.
      await expect(page.getByTestId("card-button")).toHaveCount(0);
      await expect(page.getByTestId("card-donation")).toBeVisible();
    } else {
      await expect(page.getByTestId("card-button")).toBeDisabled();
      await expect(page.getByTestId("card-donation")).toHaveCount(0);
    }
    await expect(page.getByTestId("support-note")).toContainText("কর-রেয়াতযোগ্য নয়");

    // Amount chips and the custom field (bKash/Nagad card).
    const give = page.getByTestId("give-card");
    await give.getByRole("button", { name: "অন্য" }).click();
    await page.getByLabel("অন্য পরিমাণ (৳)").fill("5");
    await expect(give.getByRole("alert")).toContainText("সর্বনিম্ন ৳১০");

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
    await expect(page.getByRole("heading", { level: 1, name: "Support & Contribute" })).toBeVisible();
    await expect(page.getByTestId("wallet-button")).toHaveText("Coming soon");
  });
});

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_e2e_mock";
const SUMMARY = {
  months: [{ month: "2026-11", currency: "usd", grossMinor: 2500, refundedMinor: 0, payments: 1 }],
  donorCount: 1,
  generatedAt: "2026-11-06T00:00:00.000Z",
};

test.describe("Support page, card donations (flag on)", () => {
  test.use({ viewport: { width: 390, height: 844 }, appLocale: "en" });

  test.beforeEach(async ({ page }) => {
    // Nothing reaches Stripe: the API routes are mocked and the Stripe page is a local stub.
    await page.route(/\/api\/donations\/summary$/, (r) => r.fulfill({ json: SUMMARY }));
    await page.route(/^https:\/\/checkout\.stripe\.com\//, (r) =>
      r.fulfill({ contentType: "text/html", body: "<!doctype html><title>Stripe Checkout (mock)</title><h1>mock</h1>" }),
    );
  });

  test("sends the choice to the checkout endpoint and redirects to the returned URL", async ({ page, appErrors }) => {
    let body: unknown = null;
    await page.route(/\/api\/donations\/checkout$/, async (r) => {
      body = r.request().postDataJSON();
      await r.fulfill({ json: { ok: true, url: CHECKOUT_URL } });
    });
    await visit(page, "/support");
    test.skip(!(await stripeOn(page)), "build has VITE_STRIPE_DONATIONS_ENABLED off");

    const form = page.getByTestId("card-donation");
    await expect(form.getByRole("heading", { name: "Give by card" })).toBeVisible();
    await expect(page.getByTestId("transparency-card")).toContainText("Transparency");
    await expect(page.getByTestId("transparency-donors")).toHaveText("1");

    await form.getByLabel("Currency").selectOption("gbp");
    await form.getByRole("button", { name: "£25" }).click();
    await form.getByRole("button", { name: "Monthly" }).click();
    const button = form.getByTestId("stripe-button");
    await expect(button).toHaveText("Give £25 every month");
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);

    await button.click();
    await page.waitForURL(CHECKOUT_URL);
    expect(body).toEqual({ amount: 25, currency: "gbp", frequency: "monthly", locale: "en" });
    expect(appErrors()).toEqual([]);
  });

  test("taka is one-time only, and a failed checkout shows an error without leaving", async ({ page }) => {
    await page.route(/\/api\/donations\/checkout$/, (r) => r.fulfill({ status: 503, json: { ok: false } }));
    await visit(page, "/support");
    test.skip(!(await stripeOn(page)), "build has VITE_STRIPE_DONATIONS_ENABLED off");

    const form = page.getByTestId("card-donation");
    await form.getByLabel("Currency").selectOption("bdt");
    await expect(form.getByRole("button", { name: "Monthly" })).toBeDisabled();
    await form.getByTestId("stripe-button").click();
    await expect(form.getByTestId("card-error")).toContainText("can't start right now");
    await expect(page).toHaveURL(/\/support$/);
  });

  test("thanks a returning monthly donor, drops the session id from the URL and offers the portal", async ({ page }) => {
    await visit(page, "/support?donation=success&monthly=1&session_id=cs_test_e2eReturn123456");
    test.skip(!(await stripeOn(page)), "build has VITE_STRIPE_DONATIONS_ENABLED off");
    await expect(page.getByTestId("donation-success")).toContainText("JazakAllahu khayran");
    await expect(page).not.toHaveURL(/session_id/);
    await expect(page.getByTestId("manage-monthly")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("rp_donation_monthly_session"))).toBe("cs_test_e2eReturn123456");
  });

  test("reassures after a cancelled checkout", async ({ page }) => {
    await visit(page, "/support?donation=cancel");
    test.skip(!(await stripeOn(page)), "build has VITE_STRIPE_DONATIONS_ENABLED off");
    await expect(page.getByTestId("donation-cancel")).toContainText("You were not charged.");
    await expect(page.getByTestId("donation-success")).toHaveCount(0);
  });
});
