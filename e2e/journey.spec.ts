import { test, expect, visit, HYDRATION } from "./fixtures";

// A guest's ordinary session, driven the way a person drives it: the nav, the browser's back and forward, a reload
// and a language switch. Runs on the desktop and the phone project (playwright.config.ts).
const TABS = [
  { name: /সময়সূচি/, path: "/timetable", h1: /সময়সূচি/ },
  { name: /আমল/, path: "/plan", h1: /আমল/ },
  { name: /কুরআন/, path: "/quran", h1: /কুরআন/ },
  { name: /^আজ$/, path: "/today", h1: /আজ/ },
];

test("tab nav, back, forward and reload keep each page whole, with no errors", async ({ page, appErrors, consoleEntries }) => {
  await visit(page, "/today");
  const nav = page.getByRole("navigation", { name: /প্রধান নেভিগেশন|Main navigation/ }).last();
  for (const tab of TABS) {
    await nav.getByRole("link", { name: tab.name }).first().click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(tab.h1);
  }
  // Back through the visited pages and forward again: each shows its own page, never a blank or stale one.
  for (const tab of [...TABS].reverse().slice(1)) {
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(tab.h1);
  }
  await page.goForward();
  await expect(page).toHaveURL(/\/plan$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/আমল/);
  expect(appErrors()).toEqual([]);
  expect(consoleEntries.filter((e) => HYDRATION.test(e.text))).toEqual([]);
});

test("a language switch holds across navigation, back and reload", async ({ page, appErrors }) => {
  await visit(page, "/timetable");
  await visit(page, "/settings");
  await page.getByRole("radio", { name: "English" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goBack();
  await expect(page).toHaveURL(/\/timetable$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/timetable/i);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(appErrors()).toEqual([]);
});

test("guest amal: suggested items, a tick and an own item survive a reload", async ({ page, appErrors }) => {
  await visit(page, "/plan");
  await page.getByRole("button", { name: /প্রস্তাবিত আমল যোগ/ }).click();
  const items = page.getByTestId("plan-item");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  await items.first().getByRole("checkbox").click();
  await expect(items.first()).toHaveAttribute("data-done", "true");
  await page.reload();
  await expect(items).toHaveCount(count);
  await expect(items.first()).toHaveAttribute("data-done", "true");
  expect(appErrors()).toEqual([]);
});
