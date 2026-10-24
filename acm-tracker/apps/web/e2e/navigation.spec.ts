import { test, expect } from "@playwright/test";

const SECTIONS = [
  { label: "Projects", path: "/projects" },
  { label: "Time", path: "/tracker" },
  { label: "Costs & AI", path: "/costs" },
  { label: "Reports", path: "/reports" },
  { label: "Documents", path: "/documents" },
  { label: "MCP Server", path: "/mcp" },
  { label: "Notifications", path: "/notifications" },
  { label: "Settings", path: "/settings" },
];

test("sidebar navigates to every section by click", async ({ page }) => {
  await page.goto("/");
  for (const s of SECTIONS) {
    await page.getByRole("link", { name: s.label }).first().click();
    await expect(page).toHaveURL(new RegExp(s.path.replace("/", "\\/")));
  }
  await page.getByRole("link", { name: "Cockpit" }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test("command palette opens with Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").click();
  await page.keyboard.press("Control+KeyK");
  await expect(page.getByRole("button", { name: "Go to MCP Server" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Go to MCP Server" }).click();
  await expect(page).toHaveURL(/\/mcp/);
});
