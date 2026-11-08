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

test("reminders: add from the sheet, the row shows when and how, the switch turns it off, delete from the sheet", async ({ page }) => {
  await visit(page, "/reminders");
  await page.getByTestId("reminder-add").click();
  const form = page.getByTestId("reminder-form");
  await form.locator("#new-reminder-type").selectOption("iftar");
  await form.locator("#new-reminder-offset").fill("-10");
  await form.getByRole("button", { name: "Add Reminder" }).click();
  await expect(form).toBeHidden();

  const rows = page.getByTestId("reminder-rules");
  await expect(rows.getByText("Iftar", { exact: true })).toBeVisible();
  await expect(rows.getByText("10 min before · Notification")).toBeVisible();
  const toggle = rows.getByRole("switch", { name: "Iftar" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rp_reminder_rules") || "[]"))).toEqual([
    expect.objectContaining({ type: "iftar", offsetMinutes: -10, enabled: false }),
  ]);

  await rows.getByText("Iftar", { exact: true }).click();
  await page.getByTestId("reminder-form").getByRole("button", { name: "Delete" }).click();
  await expect(rows).toBeHidden();
});
