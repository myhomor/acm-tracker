import { test, expect } from "@playwright/test";

test("settings shows owner and members table", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Harry G.")).toBeVisible();
  await expect(page.getByText("$45.00")).toBeVisible();
});

test("create and delete a model price", async ({ page }) => {
  const model = `e2e-model-${Date.now()}`;
  await page.goto("/settings");

  await page.getByRole("button", { name: "Model prices" }).click();

  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Input price").fill("3");
  await page.getByLabel("Output price").fill("9");
  await page.getByRole("button", { name: "+ Add" }).click();

  const row = page.getByText(model);
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: `Delete ${model}` }).click();
  await expect(page.getByText(model)).toHaveCount(0);
});
