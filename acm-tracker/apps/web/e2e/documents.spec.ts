import { test, expect } from "@playwright/test";

test("create and delete a document", async ({ page }) => {
  const title = `Doc E2E ${Date.now()}`;
  await page.goto("/documents");

  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "+ New" }).click();

  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
