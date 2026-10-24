import { test, expect } from "@playwright/test";

test("create, toggle and delete a notification rule", async ({ page }) => {
  const event = `Evento E2E ${Date.now()}`;
  await page.goto("/notifications");

  await page.getByLabel("Event").fill(event);
  await page.getByLabel("Condition").fill("condición e2e");
  await page.getByRole("button", { name: "+ Rule" }).click();

  await expect(page.getByText(event)).toBeVisible();

  // toggle off then verify it still exists (toggle is functional, not destructive)
  await page.getByRole("button", { name: `Toggle rule ${event}` }).click();
  await expect(page.getByText(event)).toBeVisible();

  await page.getByRole("button", { name: `Delete rule ${event}` }).click();
  await expect(page.getByText(event)).toHaveCount(0);
});
