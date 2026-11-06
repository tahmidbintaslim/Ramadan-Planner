import { test, expect, visit } from "./fixtures";
import type { Page } from "@playwright/test";

// The timetable's place and zone (production showed "UTC · sehri 11:09 PM"): a browser in UTC must still get
// Dhaka's times in Asia/Dhaka, labelled Dhaka, when no location is stored; a stored district is used as is.
// These call the real /api/ramadan-timetable (AlAdhan upstream), like the app does.

const SYLHET = { v: 1, kind: "district", districtId: "sylhet", lat: 24.9, lng: 91.87, tz: "Asia/Dhaka", savedAt: "2027-01-01T00:00:00.000Z" };

/** The first row's sehri time in 24-hour minutes, from the English 12-hour text ("Sehri 4:57 AM"). */
async function firstSehriMinutes(page: Page): Promise<number> {
  const row = page.locator("[data-decade-panel] li").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const m = /Sehri\s*(\d{1,2}):(\d{2})\s*(AM|PM)/.exec(await row.innerText());
  expect(m, await row.innerText()).not.toBeNull();
  const h = (Number(m![1]) % 12) + (m![3] === "PM" ? 12 : 0);
  return h * 60 + Number(m![2]);
}

test.describe("timetable zone (browser in UTC)", () => {
  test.use({ timezoneId: "UTC", viewport: { width: 390, height: 844 }, appLocale: "en", onboarded: false });

  test("no stored location: Dhaka's times in Asia/Dhaka, labelled Dhaka, never UTC", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ramadan-timetable")) asked.push(r.url());
    });
    await visit(page, "/timetable");
    const caption = page.getByTestId("timetable-caption");
    await expect(caption).toContainText("Dhaka", { timeout: 30_000 });
    await expect(caption).not.toContainText("UTC");
    expect(new URL(asked[0]).searchParams.get("tz")).toBe("Asia/Dhaka");
    const sehri = await firstSehriMinutes(page);
    expect(sehri).toBeGreaterThanOrEqual(4 * 60);
    expect(sehri).toBeLessThan(6 * 60);
  });

  test("a stored district is used: its coordinates and its name", async ({ page }) => {
    await page.addInitScript((loc) => localStorage.setItem("rp_location", JSON.stringify(loc)), SYLHET);
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ramadan-timetable")) asked.push(r.url());
    });
    await visit(page, "/timetable");
    await expect(page.getByTestId("timetable-caption")).toContainText("Sylhet", { timeout: 30_000 });
    const q = new URL(asked[0]).searchParams;
    expect([q.get("tz"), q.get("lat"), q.get("lng")]).toEqual(["Asia/Dhaka", "24.90", "91.87"]);
    const sehri = await firstSehriMinutes(page);
    expect(sehri).toBeGreaterThanOrEqual(4 * 60);
    expect(sehri).toBeLessThan(6 * 60);
  });

  test("the API never pairs Dhaka's sun with the UTC clock", async ({ request }) => {
    const res = await request.get("/api/ramadan-timetable?tz=UTC");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { timezone: string; days: { sehri: string }[] };
    expect(body.timezone).toBe("Asia/Dhaka");
    const [h] = body.days[0].sehri.split(":").map(Number);
    expect(h).toBeGreaterThanOrEqual(4);
    expect(h).toBeLessThan(6);
  });
});
