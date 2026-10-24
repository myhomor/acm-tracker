import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api";

test("MCP report_work computes real AI cost and shows in MCP screen", async ({ page, request }) => {
  // ensure an opus price exists
  await request.post(`${API}/model-prices`, {
    data: { provider: "anthropic", model: "claude-opus-4-8", inputPer1M: 15, outputPer1M: 75 },
  }).catch(() => undefined);

  // get a task to report against
  const projects = await (await request.get(`${API}/projects`)).json();
  const helios = projects.find((p: { name: string }) => p.name === "Helios") ?? projects[0];
  const tasks = await (await request.get(`${API}/tasks?projectId=${helios.id}`)).json();
  expect(tasks.length).toBeGreaterThan(0);

  const res = await request.post(`${API}/mcp/report-work`, {
    data: {
      taskId: tasks[0].id,
      memberEmail: "owner@acm.local",
      minutes: 30,
      output: "E2E report",
      aiRuns: [{ model: "claude-opus-4-8", tokensIn: 1240, tokensOut: 980 }],
    },
  });
  const body = await res.json();
  expect(body.recorded).toBe(true);
  // (1240/1e6*15)+(980/1e6*75) = 0.0921 -> 0.09
  expect(body.aiCost).toBeCloseTo(0.09, 2);

  // the report appears in the MCP screen
  await page.goto("/mcp");
  await expect(page.getByText("claude-opus-4-8", { exact: false }).first()).toBeVisible({ timeout: 8000 });
});
