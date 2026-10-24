import { test, expect } from "@playwright/test";

test("project detail tabs switch sections", async ({ page }) => {
  // open the first project
  await page.goto("/projects");
  await page.locator("a[href^='/projects/']").first().click();
  await expect(page).toHaveURL(/\/projects\/.+/);

  // Summary shows the cost panel
  await expect(page.getByText("Actual cost · accumulated")).toBeVisible();

  // Tasks tab hides the cost panel, shows tasks
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.getByText("Actual cost · accumulated")).toHaveCount(0);
  await expect(page.getByText("Tasks · time + cost", { exact: false })).toBeVisible();

  // Documents tab stays on the project and shows its scoped documents
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByText("Documents ·", { exact: false })).toBeVisible();

  // Time tab shows the chronological timeline, not the tasks table
  await page.getByRole("button", { name: "Time", exact: true }).click();
  await expect(page.getByText("Time · entry timeline")).toBeVisible();
  await expect(page.getByText("Tasks · time + cost", { exact: false })).toHaveCount(0);

  // Team tab shows the project team panel
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.getByText("Team · time logged", { exact: false })).toBeVisible();
});

test("documents sidebar filters by phase", async ({ page }) => {
  const title = `Doc Kickoff ${Date.now()}`;
  await page.goto("/documents");

  // select Kickoff phase, then create a doc -> it gets that phase
  await page.getByRole("button", { name: "Kickoff" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "+ New" }).click();
  await expect(page.getByText(title)).toBeVisible();

  // switch to a different phase -> the kickoff doc is filtered out
  await page.getByRole("button", { name: "Sales" }).click();
  await expect(page.getByText(title)).toHaveCount(0);

  // back to Kickoff -> visible again
  await page.getByRole("button", { name: "Kickoff" }).click();
  await expect(page.getByText(title)).toBeVisible();

  // cleanup
  await page.getByRole("button", { name: `Delete ${title}` }).click();
});

test("settings sidebar navigates to MCP and Notifications", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "MCP & tokens" }).click();
  await expect(page).toHaveURL(/\/mcp/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page).toHaveURL(/\/notifications/);
});
