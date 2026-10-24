import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api";

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Daily cost target is editable and burn gauge caption reflects it
// ──────────────────────────────────────────────────────────────────────────────
test("daily cost target is editable and the burn gauge caption reflects it", async ({ page, request }) => {
  // Read the current value first so we can restore it afterwards
  const settingsRes = await request.get(`${API}/workspace-settings`);
  const originalSettings = await settingsRes.json();
  const originalTarget: number = originalSettings.dailyCostTarget ?? 2400;

  // Pick a test value that is different from the current one
  const testTarget = originalTarget === 3000 ? 4000 : 3000;
  const testTargetFormatted = testTarget.toLocaleString("en-US"); // "3,000" or "4,000"

  // Navigate to Settings → Preferences
  await page.goto("/settings");
  await page.getByRole("button", { name: "Preferences" }).click();

  // The Budget panel contains an EditableRate for "Daily cost target".
  // In view mode it renders as a button with aria-label="Editar Daily cost target".
  await page.getByRole("button", { name: "Editar Daily cost target" }).click();

  // Now in edit mode: an <input> with aria-label="Daily cost target" appears
  const input = page.getByLabel("Daily cost target");
  await input.fill(String(testTarget));
  await input.press("Enter");

  // Navigate to the cockpit and verify the caption
  await page.goto("/");
  await expect(
    page.getByText(new RegExp(`daily target \\$${testTargetFormatted}`, "i")),
  ).toBeVisible({ timeout: 8000 });

  // Restore the original value via API so other tests aren't affected
  await request.patch(`${API}/workspace-settings`, {
    data: { dailyCostTarget: originalTarget },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Margin tile shows aggregated margin
// ──────────────────────────────────────────────────────────────────────────────
test("margin tile shows aggregated margin", async ({ page, request }) => {
  const tag = Date.now();

  // Create a project with a rate so margin can be calculated
  const projRes = await request.post(`${API}/projects`, {
    data: { name: `E2E Margin ${tag}`, ratePerHour: 80 },
  });
  const project = await projRes.json();
  const projectId: string = project.id;

  // Create a task in that project
  const taskRes = await request.post(`${API}/tasks`, {
    data: { projectId, code: `MGN-${tag}`, title: `Margin task ${tag}` },
  });
  const task = await taskRes.json();
  const taskId: string = task.id;

  // Log 60 minutes of time against that task (owner's rate is $45/h, revenue is $80/h)
  await request.post(`${API}/time-entries`, {
    data: { taskId, minutes: 60 },
  });

  // Go to cockpit and assert the MARGIN tile is non-empty
  await page.goto("/");

  // The margin tile's sub text is "N projects" (t("cabina.marginProjects", {count}))
  // This sub text only appears when marginSummary is successfully loaded.
  // StatTile renders sub text in a sibling div inside the same tile container.
  await expect(page.getByText(/\d+ projects/i)).toBeVisible({ timeout: 8000 });

  // Also confirm the margin tile label is present
  await expect(page.getByText("MARGIN")).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Cabina MCP stream shows reports after report_work
// ──────────────────────────────────────────────────────────────────────────────
test("cabina MCP stream shows reports after report_work", async ({ page, request }) => {
  // Seed a model price (same pattern as mcp-report-work.spec.ts)
  await request.post(`${API}/model-prices`, {
    data: { provider: "anthropic", model: "claude-opus-4-8", inputPer1M: 15, outputPer1M: 75 },
  }).catch(() => undefined);

  // Get a project + task to report against
  const projects = await (await request.get(`${API}/projects`)).json();
  const helios = projects.find((p: { name: string }) => p.name === "Helios") ?? projects[0];
  const tasks = await (await request.get(`${API}/tasks?projectId=${helios.id}`)).json();
  expect(tasks.length).toBeGreaterThan(0);

  const taskCode: string = tasks[0].code;

  // POST a report_work entry (exact payload shape from mcp-report-work.spec.ts)
  const res = await request.post(`${API}/mcp/report-work`, {
    data: {
      taskId: tasks[0].id,
      memberEmail: "owner@acm.local",
      minutes: 30,
      output: "E2E cabina MCP stream test",
      aiRuns: [{ model: "claude-opus-4-8", tokensIn: 1240, tokensOut: 980 }],
    },
  });
  const body = await res.json();
  expect(body.recorded).toBe(true);

  // Navigate to cockpit
  await page.goto("/");

  // The MCP panel title is "MCP · live ingestion" → Panel.tsx uppercases it → "MCP · LIVE INGESTION"
  await expect(page.getByText("MCP · LIVE INGESTION")).toBeVisible({ timeout: 8000 });

  // At least one report row must be visible — the McpStream renders r.task which is the task label
  // Look for the task code that we just reported
  await expect(page.getByText(taskCode, { exact: false }).first()).toBeVisible({ timeout: 8000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Tracker AI tile shows real ai cost
// ──────────────────────────────────────────────────────────────────────────────
test("tracker AI tile shows real ai cost", async ({ page, request }) => {
  // Seed a model price (idempotent)
  await request.post(`${API}/model-prices`, {
    data: { provider: "anthropic", model: "claude-opus-4-8", inputPer1M: 15, outputPer1M: 75 },
  }).catch(() => undefined);

  // Get a project + task and post a report_work so aiCost > 0
  const projects = await (await request.get(`${API}/projects`)).json();
  const helios = projects.find((p: { name: string }) => p.name === "Helios") ?? projects[0];
  const tasks = await (await request.get(`${API}/tasks?projectId=${helios.id}`)).json();
  expect(tasks.length).toBeGreaterThan(0);

  await request.post(`${API}/mcp/report-work`, {
    data: {
      taskId: tasks[0].id,
      memberEmail: "owner@acm.local",
      minutes: 15,
      output: "E2E tracker AI tile test",
      aiRuns: [{ model: "claude-opus-4-8", tokensIn: 500, tokensOut: 400 }],
    },
  });

  // Navigate to tracker
  await page.goto("/tracker");

  // The "From AI" tile (t("tracker.tileIaLabel") = "From AI") → StatTile uppercases → "FROM AI"
  // Tracker.tsx: value: today ? `$${today.aiCost}` : "—"
  // After report_work above today.aiCost must be > 0, so the value contains "$" not "—"
  // StatTile renders: label div + value div + optional sub div — all siblings inside one container div
  // We locate the tile container by finding the "FROM AI" label then going up one level to its parent
  const aiTile = page.locator("div").filter({ hasText: /^FROM AI/ }).first();
  // Wait for the tile to appear
  await expect(page.getByText("FROM AI")).toBeVisible({ timeout: 8000 });
  // The value inside that tile container must contain "$" and not be "—"
  await expect(aiTile).not.toContainText("—");
  await expect(aiTile).toContainText("$");
});
