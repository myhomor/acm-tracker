import { test, expect } from "@playwright/test";

test("defaults to English and switches to Spanish", async ({ page }) => {
  await page.goto("/settings");
  await page.evaluate(() => localStorage.removeItem("acm.lang"));
  await page.reload();

  await expect(page.getByText("Members & rates").first()).toBeVisible();

  await page.getByText("Preferences").click();
  await expect(page.getByText("Language")).toBeVisible();

  await page.getByTestId("lang-es").click();

  await expect(page.getByText("Idioma")).toBeVisible();
  await expect(page.getByText("Miembros & tarifas").first()).toBeVisible();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("acm.lang"))).toBe("es");
  await page.reload();
  await expect(page.getByText("Miembros & tarifas").first()).toBeVisible();
});

test("language preference is stored in localStorage", async ({ page }) => {
  await page.goto("/settings");
  await page.evaluate(() => localStorage.removeItem("acm.lang"));
  await page.reload();

  await page.getByText("Preferences").click();
  await page.getByTestId("lang-es").click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("acm.lang"))).toBe("es");
});
