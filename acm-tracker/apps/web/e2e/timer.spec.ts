import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api";

/**
 * Creates a project + one task via the API and returns both.
 */
async function createProjectWithTask(request: import("@playwright/test").APIRequestContext, suffix: string) {
  const project = await (
    await request.post(`${API}/projects`, { data: { name: `Timer E2E ${suffix}`, ratePerHour: 45 } })
  ).json();

  const task = await (
    await request.post(`${API}/tasks`, {
      data: { projectId: project.id, code: `TIM-${suffix}`, title: `Timer task ${suffix}` },
    })
  ).json();

  return { project, task };
}

// ---------------------------------------------------------------------------
// Test 1: dock is visible on every screen (even non-cockpit pages)
// ---------------------------------------------------------------------------
test("timer dock is visible on every screen", async ({ page }) => {
  await page.goto("/costs");
  const dock = page.getByTestId("timer-dock");
  await expect(dock).toBeVisible();
  await expect(dock).toContainText("NO TIMER");
});

// ---------------------------------------------------------------------------
// Test 2: start from dock picker, running state, stop logs a timer entry
// ---------------------------------------------------------------------------
test("start from dock picker, runs, stop logs a timer entry", async ({ page, request }) => {
  const suffix = String(Date.now());
  const { task } = await createProjectWithTask(request, suffix);

  // Stop any pre-existing timer so we start clean
  await request.post(`${API}/timer/stop`).catch(() => undefined);

  await page.goto("/");
  const dock = page.getByTestId("timer-dock");
  await expect(dock).toBeVisible();
  await expect(dock).toContainText("NO TIMER");

  // Open the picker modal
  await page.getByTestId("timer-start").click();
  const dialog = page.getByRole("dialog", { name: /start timer/i });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Select our project in the project dropdown
  const projectSelect = dialog.getByRole("combobox").first();
  await projectSelect.selectOption({ label: `Timer E2E ${suffix}` });

  // Wait for the task dropdown to load our task, then select it
  // (options inside <select> are always hidden in the DOM — just select directly)
  const taskSelect = dialog.getByRole("combobox").nth(1);
  await expect(taskSelect).toBeVisible({ timeout: 5000 });
  await taskSelect.selectOption({ label: `TIM-${suffix} · Timer task ${suffix}` });

  // Start the timer
  await page.getByTestId("timer-picker-start").click();

  // Dock should show RUNNING and the task code
  await expect(dock).toContainText("RUNNING", { timeout: 8000 });
  await expect(dock).toContainText(`TIM-${suffix}`);

  // The elapsed counter should be ticking
  await expect(page.getByTestId("timer-elapsed")).toBeVisible();

  // Stop the timer — wait for the API response to confirm the stop completed
  const [stopResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/timer/stop") && res.request().method() === "POST"),
    page.getByTestId("timer-stop").click(),
  ]);
  expect(stopResponse.status()).toBe(201);

  // Dock returns to idle (allow extra time for query invalidation + refetch)
  await expect(dock).toContainText("NO TIMER", { timeout: 15000 });

  // Navigate to tracker — the entry should appear with origin "timer"
  await page.goto("/tracker");
  await expect(page.getByText(`TIM-${suffix}`, { exact: false })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("timer", { exact: true }).first()).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 3: starting another task auto-stops and logs the previous one
// ---------------------------------------------------------------------------
test("starting another task auto-stops and logs the previous one", async ({ page, request }) => {
  const suffix = String(Date.now());

  // Create a project with two tasks
  const project = await (
    await request.post(`${API}/projects`, { data: { name: `Timer E2E 2T ${suffix}`, ratePerHour: 45 } })
  ).json();

  const task1 = await (
    await request.post(`${API}/tasks`, {
      data: { projectId: project.id, code: `T1-${suffix}`, title: `Task one ${suffix}` },
    })
  ).json();

  const task2 = await (
    await request.post(`${API}/tasks`, {
      data: { projectId: project.id, code: `T2-${suffix}`, title: `Task two ${suffix}` },
    })
  ).json();

  // Stop any pre-existing timer
  await request.post(`${API}/timer/stop`).catch(() => undefined);

  // Navigate to the project detail page
  await page.goto(`/projects/${project.id}`);

  // Switch to the Tasks tab
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.getByText(`T1-${suffix}`)).toBeVisible({ timeout: 8000 });

  const dock = page.getByTestId("timer-dock");

  // Start timer for task 1 via the play button in the task row
  await page.getByTestId(`start-timer-T1-${suffix}`).click();
  await expect(dock).toContainText(`T1-${suffix}`, { timeout: 8000 });
  await expect(dock).toContainText("RUNNING");

  // Start timer for task 2 — this should auto-stop task 1 and log it
  await page.getByTestId(`start-timer-T2-${suffix}`).click();
  await expect(dock).toContainText(`T2-${suffix}`, { timeout: 8000 });
  await expect(dock).toContainText("RUNNING");

  // Navigate to tracker — the T1 entry should be visible (auto-logged when switched)
  await page.goto("/tracker");
  await expect(page.getByText(`T1-${suffix}`, { exact: false })).toBeVisible({ timeout: 8000 });

  // Cleanup: stop the remaining timer — wait for the API response
  const [cleanupStopResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/timer/stop") && res.request().method() === "POST"),
    page.getByTestId("timer-stop").click(),
  ]);
  expect(cleanupStopResponse.status()).toBe(201);
  await expect(dock).toContainText("NO TIMER", { timeout: 15000 });
});
