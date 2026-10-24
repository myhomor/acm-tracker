#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiClient } from "./api-client.js";
import { resolveTaskId } from "./resolve.js";
const OWNER_EMAIL = process.env.ACM_OWNER_EMAIL ?? "owner@acm.local";
const server = new McpServer({ name: "acm-tracker", version: "0.2.0" });
function json(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function text(message) {
    return { content: [{ type: "text", text: message }] };
}
server.registerTool("list_projects", {
    title: "List projects",
    description: "List ACM-TRACKER projects (id, name, client, contract amount, status).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => json(await apiClient.listProjects()));
server.registerTool("create_project", {
    title: "Create a project",
    description: "Create a project. Returns the created project (with its id).",
    inputSchema: {
        name: z.string().describe("Project name, e.g. 'Helios'."),
        client: z.string().optional().describe("Client name, optional."),
        contractAmount: z.number().optional().describe("Contract amount in USD, optional."),
    },
}, async ({ name, client, contractAmount }) => json(await apiClient.createProject({ name, client, contractAmount })));
server.registerTool("list_tasks", {
    title: "List tasks of a project",
    description: "List the tasks of a project (id, code, title, phase, status). Pass the projectId from list_projects.",
    inputSchema: { projectId: z.string().describe("The project id.") },
    annotations: { readOnlyHint: true },
}, async ({ projectId }) => json(await apiClient.listTasks(projectId)));
server.registerTool("create_task", {
    title: "Create a task",
    description: "Create a task in a project. Returns the created task (with its id).",
    inputSchema: {
        projectId: z.string().describe("The project id (from list_projects)."),
        code: z.string().describe("Short task code, e.g. 'T-142'."),
        title: z.string().describe("Task title, e.g. 'Cognito preToken lambda'."),
        phase: z.string().optional().describe("Lifecycle phase label, optional."),
        estimateMinutes: z.number().int().min(0).optional().describe("Estimated effort in minutes, optional."),
    },
}, async ({ projectId, code, title, phase, estimateMinutes }) => json(await apiClient.createTask({ projectId, code, title, phase, estimateMinutes })));
server.registerTool("report_work", {
    title: "Report work on a task",
    description: "Report time and AI usage on a task. Identify the task either by taskId, OR by projectName + taskCode (resolved server-side; set createMissing=true to create the project/task if they don't exist). The server computes the real AI cost (tokens x model price) and records a time entry. Report minutes of human time and, if a model did work, one aiRuns entry per model.",
    inputSchema: {
        taskId: z.string().optional().describe("The task id, if known (from list_tasks)."),
        projectName: z.string().optional().describe("Project name, if taskId is unknown. Used with taskCode."),
        taskCode: z.string().optional().describe("Task code (e.g. 'T-142'), if taskId is unknown. Used with projectName."),
        taskTitle: z.string().optional().describe("Task title, used only when creating a missing task."),
        createMissing: z.boolean().optional().describe("Create the project/task if they don't exist. Default false."),
        minutes: z.number().int().min(0).describe("Minutes of work to record."),
        output: z.string().optional().describe("Short note on what was produced (e.g. 'PR #318')."),
        aiRuns: z
            .array(z.object({
            model: z.string().describe("Model id, e.g. 'claude-opus-4-8'."),
            agent: z.string().optional().describe("Agent name, optional."),
            tokensIn: z.number().int().min(0).describe("Input tokens."),
            tokensOut: z.number().int().min(0).describe("Output tokens."),
        }))
            .optional()
            .describe("One entry per model used. Omit if no AI was involved."),
    },
}, async ({ taskId, projectName, taskCode, taskTitle, createMissing, minutes, output, aiRuns }) => {
    const resolvedTaskId = await resolveTaskId({
        taskId,
        projectName,
        taskCode,
        taskTitle,
        createMissing: createMissing ?? false,
    });
    const result = await apiClient.reportWork({
        taskId: resolvedTaskId,
        memberEmail: OWNER_EMAIL,
        minutes,
        output,
        aiRuns,
    });
    return text(`Recorded ${minutes} min on task ${resolvedTaskId}. AI cost: $${result.aiCost.toFixed(2)}.`);
});
server.registerTool("project_cost", {
    title: "Project cost breakdown",
    description: "Real cost of a project (human, AI, hours, contract consumption). Pass the projectId.",
    inputSchema: { projectId: z.string().describe("The project id.") },
    annotations: { readOnlyHint: true },
}, async ({ projectId }) => json(await apiClient.projectCost(projectId)));
server.registerTool("today_summary", {
    title: "Today's summary",
    description: "Today's tracked time and cost summary (human + AI).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => json(await apiClient.todaySummary()));
server.registerTool("recent_reports", {
    title: "Recent MCP reports",
    description: "The most recent work reports ingested via MCP (time, task, person, cost, AI summary).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => json(await apiClient.recentReports()));
server.registerTool("list_model_prices", {
    title: "List AI model prices",
    description: "List the model price table (provider, model, USD per 1M input/output tokens). AI cost needs a row here per model.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
}, async () => json(await apiClient.listModelPrices()));
server.registerTool("set_model_price", {
    title: "Set an AI model price",
    description: "Add or update a model's price (USD per 1M tokens). If a price for provider+model already exists, it is updated; otherwise created. report_work uses this to compute AI cost.",
    inputSchema: {
        provider: z.string().describe("Provider, e.g. 'anthropic'."),
        model: z.string().describe("Model id, e.g. 'claude-opus-4-8'."),
        inputPer1M: z.number().min(0).describe("USD per 1,000,000 input tokens."),
        outputPer1M: z.number().min(0).describe("USD per 1,000,000 output tokens."),
    },
}, async ({ provider, model, inputPer1M, outputPer1M }) => {
    const existing = (await apiClient.listModelPrices()).find((p) => p.provider === provider && p.model === model);
    const result = existing
        ? await apiClient.updateModelPrice(existing.id, { inputPer1M, outputPer1M })
        : await apiClient.createModelPrice({ provider, model, inputPer1M, outputPer1M });
    return json(result);
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`acm-tracker MCP server connected (API: ${apiClient.baseUrl})\n`);
}
main().catch((error) => {
    process.stderr.write(`acm-tracker MCP server failed: ${error}\n`);
    process.exit(1);
});
