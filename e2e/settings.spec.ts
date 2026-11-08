import { test, expect, visit } from "./fixtures";

// Settings is a grouped list (Figma page 12, D2): language, text & theme, location & prayer times, time format,
// reminders. (The account group waits for Clerk, which never loads with the CI placeholder key.)

test.use({ viewport: { width: 390, height: 844 }, appLocale: "en" });

test("grouped list: text & theme opens its dialog; reminders and support are rows", async ({ page }) => {
  await visit(page, "/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByTestId("settings-text-theme").click();
  await expect(page.getByRole("dialog", { name: "Text & Theme" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Reminders", exact: true })).toHaveAttribute("href", "/reminders");
  await expect(page.getByRole("main").getByRole("link", { name: "Support & Contribute" })).toHaveAttribute("href", "/support");
  // Profile fields are for signed-in users only.
  await expect(page.getByLabel("Latitude")).toHaveCount(0);
});
