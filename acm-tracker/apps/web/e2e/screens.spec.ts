import { test, expect } from "@playwright/test";

test("cabina shows burn rate gauge and team panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("BURN RATE · TODAY")).toBeVisible();
  await expect(page.getByText("TEAM · REAL COST TODAY")).toBeVisible();
  await expect(page.getByText("Harry G.")).toBeVisible();
});

test("cabina '+ log time' opens the time-entry modal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ log time" }).click();
  await expect(page.getByRole("dialog", { name: "Log time" })).toBeVisible();
});

test("costs shows model prices table", async ({ page }) => {
  await page.goto("/costs");
  await expect(page.getByText("AI · COST PER MODEL", { exact: false })).toBeVisible();
  await expect(page.getByText("COST COMPOSITION")).toBeVisible();
});

test("reports shows KPIs, per-person and CSV export", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByText("Reports · analytics")).toBeVisible();
  await expect(page.getByText("BY PERSON · REAL COST")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(".csv");
});

test("tracker shows timeline and day objective", async ({ page }) => {
  await page.goto("/tracker");
  await expect(page.getByText("TIMELINE")).toBeVisible();
  await expect(page.getByText("DAILY GOAL")).toBeVisible();
});

test("mcp screen shows endpoint and contract", async ({ page }) => {
  await page.goto("/mcp");
  await expect(page.getByRole("heading", { name: "MCP Server" })).toBeVisible();
  await expect(page.getByText("ENDPOINT")).toBeVisible();
  await expect(page.getByText("RECEIVED REPORTS", { exact: true })).toBeVisible();
});

test("auth login navigates to cabina", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByLabel("Email")).toHaveValue("owner@acm.local");
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("BURN RATE · TODAY")).toBeVisible();
});
