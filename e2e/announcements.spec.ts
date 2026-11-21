import { test, expect, visit } from "./fixtures";

const ITEM = {
  id: "11111111-1111-4111-8111-111111111111",
  titleBn: "ঈদের নামাজের সময় প্রকাশিত",
  titleEn: "Eid prayer times are out",
  bodyBn: "বিস্তারিত",
  bodyEn: "Details",
  startAt: "2027-01-01T00:00:00.000Z",
  endAt: null,
};

test("Today shows the newest announcement as a closable line; closing it keeps it closed", async ({ page, appErrors }) => {
  await page.route("**/api/announcements", (r) => r.fulfill({ json: { ok: true, data: [ITEM] } }));
  await visit(page, "/today");
  const notice = page.getByTestId("announcement-notice");
  await expect(notice).toContainText(ITEM.titleBn);
  await expect(notice.getByRole("link")).toHaveAttribute("href", `/announcements#a-${ITEM.id}`);
  await notice.getByRole("button", { name: "বন্ধ করুন" }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("announcement-notice")).toHaveCount(0);
  expect(appErrors()).toEqual([]);
});

test("no announcement, no line on Today", async ({ page }) => {
  await page.route("**/api/announcements", (r) => r.fulfill({ json: { ok: true, data: [] } }));
  await visit(page, "/today");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("announcement-notice")).toHaveCount(0);
});

test("/announcements has its title and is in the More menu", async ({ page }) => {
  await visit(page, "/announcements");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ঘোষণা");
  await expect(page.locator('a[href="/announcements"]').first()).toBeAttached();
});
