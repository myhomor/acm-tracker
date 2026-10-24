# ACM-TRACKER v3 — MCP Protocol (real SSE server + tool registration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a REAL Model Context Protocol server (SSE transport + tool registration) alongside the existing REST ingest, so external AI agents/clients (Claude, IDEs) can connect natively. The MCP tools delegate to the SAME existing use cases (`report-work`, `list-projects`, `list-tasks`) — zero business-logic duplication. The SDK/transport lives only in infrastructure/interfaces; the domain and application layers stay pure.

**Architecture:** Same hexagonal backend as v1/v2 (`apps/api`). The existing `mcp` module is **extended, not replaced**: its `ReportWorkUseCase` / `RecentReportsUseCase` and the `POST /mcp/report-work` REST endpoint keep working unchanged. New transport code (the `@modelcontextprotocol/sdk` server + SSE controller) is an **interface adapter** that bridges Nest's `req`/`res` to the SDK transport and registers tools whose handlers call the existing use cases (plus `ListProjectsUseCase` / `ListTasksUseCase`, imported via module exports). AI cost math reuses `@acm/shared` — never reimplemented. Frontend = reactive (TanStack Query + Zustand); the `Mcp.tsx` screen gains the SSE endpoint URL + token/connection info + a live tool list (presentational, props in).

**Tech Stack:** TypeScript, NestJS 10, `@modelcontextprotocol/sdk`, Prisma 5 (Postgres), React 18 + Vite, Jest (api), Vitest (web/shared).

**Authority:** `CLAUDE.md` (root), `apps/api/CLAUDE.md` (hexagonal). Use the project skill `add-backend-feature` for backend structure; audit with `code-reviewer` before merge. **Business logic stays in the existing use cases (ports & adapters); only transport + tool-registration is new code.** This plan is immutable once written — update only checkbox state during execution.

**Design source:** Extends the existing "FD · Settings · MCP" screen (`apps/web/src/screens/Mcp.tsx`) — add SSE endpoint + token + tool-list affordances next to the existing REST contract.

---

## Scope (explicit)

IN: (1) add `@modelcontextprotocol/sdk` dependency to `apps/api`; (2) a real MCP server built once and shared, exposing the registered tools `report_work`, `list_projects`, `list_tasks`; (3) SSE transport wired through Nest — `GET /mcp/sse` (stream) + `POST /mcp/messages` (the SDK's message endpoint), via a controller/adapter that bridges Nest `req`/`res` to the SDK `SSEServerTransport`; (4) tool handlers that delegate to the EXISTING use cases (`ReportWorkUseCase`, `ListProjectsUseCase`, `ListTasksUseCase`) — no duplicated logic; (5) a pluggable shared-token guard for the SSE/messages endpoints; (6) `Mcp.tsx` shows SSE URL + token/connection info + live tool list; (7) unit tests that the tool handlers delegate to the use cases (use cases mocked).

OUT (do NOT build here): changing/removing the existing `POST /mcp/report-work` REST endpoint or its DTO (back-compat is mandatory); new MCP tools beyond the three named; auth providers beyond the simple shared-token guard; Streamable-HTTP transport (SSE only for now); persisting connected-client state; rate limiting.

**Back-compat invariant:** `POST /mcp/report-work`, `GET /mcp/reports`, `ReportWorkDto`, `ReportWorkUseCase`, `RecentReportsUseCase`, and the `MCP_INGEST` port are untouched. The MCP tool layer is purely additive.

---

## File Structure

```
apps/api/src/modules/mcp/
├── domain/ports/
│   ├── mcp-ingest.port.ts                       # UNCHANGED (existing ingest port)
│   └── mcp-token.port.ts                         # ADD: MCP_TOKEN_VERIFIER token + port
├── application/use-cases/
│   ├── report-work.use-case.ts                  # UNCHANGED (reused by report_work tool)
│   └── recent-reports.use-case.ts               # UNCHANGED
├── infrastructure/
│   ├── mcp-server.factory.ts                    # ADD: builds McpServer, registers 3 tools
│   ├── tools/
│   │   ├── report-work.tool.ts                  # ADD: schema + handler → ReportWorkUseCase
│   │   ├── list-projects.tool.ts                # ADD: schema + handler → ListProjectsUseCase
│   │   └── list-tasks.tool.ts                   # ADD: schema + handler → ListTasksUseCase
│   └── auth/env-mcp-token.verifier.ts           # ADD: shared-token adapter (env-backed)
├── interfaces/http/
│   ├── mcp.controller.ts                        # UNCHANGED (REST ingest, back-compat)
│   ├── mcp-sse.controller.ts                    # ADD: GET /mcp/sse + POST /mcp/messages
│   ├── mcp-token.guard.ts                        # ADD: guard using MCP_TOKEN_VERIFIER
│   └── dto/report-work.dto.ts                   # UNCHANGED
└── mcp.module.ts                                 # MODIFY: import Projects/Tasks modules, register factory/tools/guard/verifier

apps/api/src/modules/projects/projects.module.ts # MODIFY: export ListProjectsUseCase
apps/api/src/modules/tasks/tasks.module.ts        # MODIFY: export ListTasksUseCase

apps/web/src/
├── features/mcp/api/use-mcp.ts                   # MODIFY: add useMcpTools() (static tool list)
├── components/ToolList/ToolList.tsx + index.ts   # ADD: presentational tool-list (props in)
└── screens/Mcp.tsx                               # MODIFY: SSE URL + token info + ToolList
```

**Responsibility boundaries:** `mcp-server.factory.ts` and the `tools/` handlers are infrastructure — they may import the SDK and the use cases, but contain NO business logic (each handler validates input → calls one use case → maps the result to an MCP tool response). The token verifier is an outbound port with an env-backed adapter (pluggable, swappable like the `AuthProvider`). `ToolList` is a dumb presentational web component.

---

## Prisma schema change

**None.** This epic adds no tables and no columns. The `report_work` tool persists `AiRun` through the existing `ReportWorkUseCase` → `MCP_INGEST` adapter, which already writes the `AiRun` model. Do not touch `apps/api/prisma/schema.prisma`.

---

## Phase A — Dependency + token port

### Task 1: Add the MCP SDK dependency

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add `@modelcontextprotocol/sdk` to `apps/api`**

Run:
```bash
pnpm --filter @acm/api add @modelcontextprotocol/sdk
```
Expected: `@modelcontextprotocol/sdk` appears under `dependencies` in `apps/api/package.json`; lockfile updated.

- [ ] **Step 2: Confirm the api still builds**

Run: `pnpm --filter @acm/api build`
Expected: tsc completes, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add @modelcontextprotocol/sdk dependency"
```

---

### Task 2: MCP token-verifier port + env adapter (TDD)

**Files:**
- Create: `apps/api/src/modules/mcp/domain/ports/mcp-token.port.ts`
- Test: `apps/api/src/modules/mcp/infrastructure/auth/env-mcp-token.verifier.spec.ts`
- Create: `apps/api/src/modules/mcp/infrastructure/auth/env-mcp-token.verifier.ts`

- [ ] **Step 1: Create the port**

```typescript
export const MCP_TOKEN_VERIFIER = Symbol("MCP_TOKEN_VERIFIER");

export interface McpTokenVerifierPort {
  verify(token: string | undefined): boolean;
}
```

> Kept small (ISP) and pluggable (DIP) — mirrors the `AuthProvider` mindset. A future OAuth/DB-backed verifier swaps in without touching callers.

- [ ] **Step 2: Write the failing test**

```typescript
import { EnvMcpTokenVerifier } from "./env-mcp-token.verifier";

describe("EnvMcpTokenVerifier", () => {
  it("accepts any token when no secret is configured", () => {
    const v = new EnvMcpTokenVerifier(undefined);
    expect(v.verify("anything")).toBe(true);
    expect(v.verify(undefined)).toBe(true);
  });
  it("accepts only the matching token when a secret is configured", () => {
    const v = new EnvMcpTokenVerifier("s3cret");
    expect(v.verify("s3cret")).toBe(true);
    expect(v.verify("wrong")).toBe(false);
    expect(v.verify(undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @acm/api test env-mcp-token`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the env adapter**

```typescript
import { Injectable } from "@nestjs/common";
import { McpTokenVerifierPort } from "../../domain/ports/mcp-token.port";

@Injectable()
export class EnvMcpTokenVerifier implements McpTokenVerifierPort {
  private readonly secret = process.env.MCP_SHARED_TOKEN;

  constructor(secret = process.env.MCP_SHARED_TOKEN) {
    this.secret = secret;
  }

  verify(token: string | undefined): boolean {
    if (!this.secret) return true;
    return token === this.secret;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @acm/api test env-mcp-token`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/mcp/domain/ports/mcp-token.port.ts apps/api/src/modules/mcp/infrastructure/auth
git commit -m "feat(api): MCP token-verifier port + env-backed shared-token adapter with test"
```

---

## Phase B — Tool handlers (delegate to existing use cases, TDD)

### Task 3: `report_work` tool handler (TDD)

**Files:**
- Test: `apps/api/src/modules/mcp/infrastructure/tools/report-work.tool.spec.ts`
- Create: `apps/api/src/modules/mcp/infrastructure/tools/report-work.tool.ts`

- [ ] **Step 1: Write the failing test (handler delegates to `ReportWorkUseCase`)**

```typescript
import { z } from "zod";
import { reportWorkTool } from "./report-work.tool";
import type { ReportWorkUseCase } from "../../application/use-cases/report-work.use-case";

describe("reportWorkTool", () => {
  it("delegates to ReportWorkUseCase.execute with the parsed input", async () => {
    const execute = jest.fn().mockResolvedValue({ recorded: true, aiCost: 12.34 });
    const useCase = { execute } as unknown as ReportWorkUseCase;
    const tool = reportWorkTool(useCase);

    const input = {
      taskId: "T-1", memberEmail: "owner@acm.local", minutes: 45,
      output: "PR #1", aiRuns: [{ model: "claude-opus-4-8", tokensIn: 1240, tokensOut: 980 }],
    };
    const result = await tool.handler(z.object(tool.inputSchema).parse(input));

    expect(execute).toHaveBeenCalledWith(input);
    expect(result.content[0].text).toContain("12.34");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test report-work.tool`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the tool definition**

```typescript
import { z } from "zod";
import type { ReportWorkUseCase } from "../../application/use-cases/report-work.use-case";

const aiRun = z.object({
  model: z.string(),
  agent: z.string().optional(),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
});

export const reportWorkInputSchema = {
  taskId: z.string(),
  memberEmail: z.string(),
  minutes: z.number().int().min(0),
  output: z.string().optional(),
  aiRuns: z.array(aiRun).optional(),
};

export function reportWorkTool(useCase: ReportWorkUseCase) {
  return {
    name: "report_work",
    description: "Record work on a task: minutes + optional AI runs. Computes real AI cost and persists an AiRun.",
    inputSchema: reportWorkInputSchema,
    handler: async (input: z.infer<z.ZodObject<typeof reportWorkInputSchema>>) => {
      const result = await useCase.execute(input);
      return { content: [{ type: "text" as const, text: `recorded · aiCost=$${result.aiCost}` }] };
    },
  };
}
```

> The tool input mirrors `ReportWorkDto` exactly; the handler passes it straight to the existing use case — no recomputation. Cost is calculated inside `ReportWorkUseCase` via `@acm/shared`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/api test report-work.tool`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/mcp/infrastructure/tools/report-work.tool.ts apps/api/src/modules/mcp/infrastructure/tools/report-work.tool.spec.ts
git commit -m "feat(api): report_work MCP tool delegating to ReportWorkUseCase with test"
```

---

### Task 4: `list_projects` + `list_tasks` tool handlers (TDD)

**Files:**
- Test: `apps/api/src/modules/mcp/infrastructure/tools/list-projects.tool.spec.ts`
- Create: `apps/api/src/modules/mcp/infrastructure/tools/list-projects.tool.ts`
- Create: `apps/api/src/modules/mcp/infrastructure/tools/list-tasks.tool.ts`

- [ ] **Step 1: Write the failing test (handlers delegate to the list use cases)**

```typescript
import { listProjectsTool } from "./list-projects.tool";
import type { ListProjectsUseCase } from "../../../projects/application/use-cases/list-projects.use-case";

describe("listProjectsTool", () => {
  it("delegates to ListProjectsUseCase.execute and serializes the result", async () => {
    const projects = [{ id: "p1", name: "Helios", status: "active" }];
    const execute = jest.fn().mockResolvedValue(projects);
    const tool = listProjectsTool({ execute } as unknown as ListProjectsUseCase);

    const result = await tool.handler();

    expect(execute).toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toEqual(projects);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test list-projects.tool`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `list-projects.tool.ts`**

```typescript
import type { ListProjectsUseCase } from "../../../projects/application/use-cases/list-projects.use-case";

export function listProjectsTool(useCase: ListProjectsUseCase) {
  return {
    name: "list_projects",
    description: "List all projects with their status.",
    inputSchema: {},
    handler: async () => {
      const projects = await useCase.execute();
      return { content: [{ type: "text" as const, text: JSON.stringify(projects) }] };
    },
  };
}
```

- [ ] **Step 4: Create `list-tasks.tool.ts`**

```typescript
import { z } from "zod";
import type { ListTasksUseCase } from "../../../tasks/application/use-cases/list-tasks.use-case";

export const listTasksInputSchema = {
  projectId: z.string().optional(),
};

export function listTasksTool(useCase: ListTasksUseCase) {
  return {
    name: "list_tasks",
    description: "List tasks, optionally filtered by projectId.",
    inputSchema: listTasksInputSchema,
    handler: async (input: { projectId?: string }) => {
      const tasks = await useCase.execute(input.projectId);
      return { content: [{ type: "text" as const, text: JSON.stringify(tasks) }] };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @acm/api test list-projects.tool`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/mcp/infrastructure/tools/list-projects.tool.ts apps/api/src/modules/mcp/infrastructure/tools/list-tasks.tool.ts apps/api/src/modules/mcp/infrastructure/tools/list-projects.tool.spec.ts
git commit -m "feat(api): list_projects + list_tasks MCP tools delegating to existing use cases with test"
```

---

## Phase C — MCP server factory + SSE transport + module wiring

### Task 5: MCP server factory (registers the three tools)

**Files:**
- Create: `apps/api/src/modules/mcp/infrastructure/mcp-server.factory.ts`

- [ ] **Step 1: Create the factory**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReportWorkUseCase } from "../application/use-cases/report-work.use-case";
import { ListProjectsUseCase } from "../../projects/application/use-cases/list-projects.use-case";
import { ListTasksUseCase } from "../../tasks/application/use-cases/list-tasks.use-case";
import { reportWorkTool } from "./tools/report-work.tool";
import { listProjectsTool } from "./tools/list-projects.tool";
import { listTasksTool } from "./tools/list-tasks.tool";

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly reportWork: ReportWorkUseCase,
    private readonly listProjects: ListProjectsUseCase,
    private readonly listTasks: ListTasksUseCase,
  ) {}

  create(): McpServer {
    const server = new McpServer({ name: "acm-tracker", version: "1.0.0" });
    for (const tool of [
      reportWorkTool(this.reportWork),
      listProjectsTool(this.listProjects),
      listTasksTool(this.listTasks),
    ]) {
      server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
    }
    return server;
  }
}
```

> Single responsibility: build a configured `McpServer`. The SDK import lives only here and in the tool files (infrastructure). Use cases are injected — the factory holds no business logic.

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @acm/api build`
Expected: clean (the factory is not yet wired into a module — that is Task 7).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/mcp/infrastructure/mcp-server.factory.ts
git commit -m "feat(api): McpServerFactory registering report_work/list_projects/list_tasks"
```

---

### Task 6: SSE controller + token guard (Nest ↔ SDK transport bridge)

**Files:**
- Create: `apps/api/src/modules/mcp/interfaces/http/mcp-token.guard.ts`
- Create: `apps/api/src/modules/mcp/interfaces/http/mcp-sse.controller.ts`

- [ ] **Step 1: Create the token guard**

```typescript
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { MCP_TOKEN_VERIFIER, McpTokenVerifierPort } from "../../domain/ports/mcp-token.port";

@Injectable()
export class McpTokenGuard implements CanActivate {
  constructor(@Inject(MCP_TOKEN_VERIFIER) private readonly verifier: McpTokenVerifierPort) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers["authorization"] as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : (req.query?.token as string | undefined);
    if (!this.verifier.verify(token)) throw new UnauthorizedException("invalid MCP token");
    return true;
  }
}
```

- [ ] **Step 2: Create the SSE controller (bridges Nest req/res to `SSEServerTransport`)**

```typescript
import { Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServerFactory } from "../../infrastructure/mcp-server.factory";
import { McpTokenGuard } from "./mcp-token.guard";

@UseGuards(McpTokenGuard)
@Controller("mcp")
export class McpSseController {
  private readonly transports = new Map<string, SSEServerTransport>();

  constructor(private readonly factory: McpServerFactory) {}

  @Get("sse")
  async sse(@Req() _req: Request, @Res() res: Response): Promise<void> {
    const transport = new SSEServerTransport("/api/mcp/messages", res);
    this.transports.set(transport.sessionId, transport);
    res.on("close", () => this.transports.delete(transport.sessionId));
    const server = this.factory.create();
    await server.connect(transport);
  }

  @Post("messages")
  async messages(@Req() req: Request, @Res() res: Response): Promise<void> {
    const sessionId = req.query.sessionId as string;
    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(400).send("unknown sessionId");
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  }
}
```

> The controller is the ONLY place the SSE transport touches Nest's `req`/`res`. It registers no logic — it instantiates a server from the factory and hands the raw response to the SDK. `setGlobalPrefix("api")` means the public paths are `/api/mcp/sse` and `/api/mcp/messages`; the transport's message path is given as `/api/mcp/messages` accordingly.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/mcp/interfaces/http/mcp-token.guard.ts apps/api/src/modules/mcp/interfaces/http/mcp-sse.controller.ts
git commit -m "feat(api): SSE controller + token guard bridging Nest to the MCP SDK transport"
```

---

### Task 7: Wire the module (export list use cases, register MCP transport)

**Files:**
- Modify: `apps/api/src/modules/projects/projects.module.ts`
- Modify: `apps/api/src/modules/tasks/tasks.module.ts`
- Modify: `apps/api/src/modules/mcp/mcp.module.ts`

- [ ] **Step 1: Export `ListProjectsUseCase` from the projects module**

Add an `exports` array to `ProjectsModule`:
```typescript
  exports: [ListProjectsUseCase],
```

- [ ] **Step 2: Export `ListTasksUseCase` from the tasks module**

Add an `exports` array to `TasksModule`:
```typescript
  exports: [ListTasksUseCase],
```

- [ ] **Step 3: Extend `mcp.module.ts` (additive — keep existing providers/controller)**

```typescript
import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { TasksModule } from "../tasks/tasks.module";
import { MCP_INGEST } from "./domain/ports/mcp-ingest.port";
import { MCP_TOKEN_VERIFIER } from "./domain/ports/mcp-token.port";
import { ReportWorkUseCase } from "./application/use-cases/report-work.use-case";
import { RecentReportsUseCase } from "./application/use-cases/recent-reports.use-case";
import { PrismaMcpIngestAdapter } from "./infrastructure/persistence/prisma-mcp-ingest.adapter";
import { EnvMcpTokenVerifier } from "./infrastructure/auth/env-mcp-token.verifier";
import { McpServerFactory } from "./infrastructure/mcp-server.factory";
import { McpController } from "./interfaces/http/mcp.controller";
import { McpSseController } from "./interfaces/http/mcp-sse.controller";
import { McpTokenGuard } from "./interfaces/http/mcp-token.guard";

@Module({
  imports: [ProjectsModule, TasksModule],
  controllers: [McpController, McpSseController],
  providers: [
    ReportWorkUseCase,
    RecentReportsUseCase,
    McpServerFactory,
    McpTokenGuard,
    { provide: MCP_INGEST, useClass: PrismaMcpIngestAdapter },
    { provide: MCP_TOKEN_VERIFIER, useClass: EnvMcpTokenVerifier },
  ],
})
export class McpModule {}
```

> `McpServerFactory` injects `ReportWorkUseCase` (local) plus `ListProjectsUseCase`/`ListTasksUseCase` (provided by the imported modules' `exports`). No use case is re-declared — reuse over re-create.

- [ ] **Step 4: Build + run the full api test suite**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Expected: build clean; all tests green (new tool/verifier specs + existing suite).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/mcp/mcp.module.ts apps/api/src/modules/projects/projects.module.ts apps/api/src/modules/tasks/tasks.module.ts
git commit -m "feat(api): wire MCP SSE transport + token verifier; export list use cases for reuse"
```

---

## Phase D — Frontend (SSE endpoint + token + live tool list)

### Task 8: Tool-list hook + presentational ToolList component

**Files:**
- Modify: `apps/web/src/features/mcp/api/use-mcp.ts`
- Create: `apps/web/src/components/ToolList/ToolList.tsx` + `index.ts`

- [ ] **Step 1: Add `useMcpTools()` to `use-mcp.ts` (append — keep `useMcpReports`)**

```typescript
export interface McpTool {
  name: string;
  description: string;
}

const MCP_TOOLS: McpTool[] = [
  { name: "report_work", description: "Reporta trabajo (minutos + tokens) → costo IA real + AiRun" },
  { name: "list_projects", description: "Lista proyectos con su estado" },
  { name: "list_tasks", description: "Lista tareas (filtra por projectId opcional)" },
];

export function useMcpTools(): McpTool[] {
  return MCP_TOOLS;
}
```

> The tool list is a static contract mirroring the server registration; no extra endpoint needed. If a discovery endpoint is added later, swap this for a `useQuery` without touching `ToolList`.

- [ ] **Step 2: Create `ToolList.tsx`** (dumb — props in, JSX out)

```tsx
import { colors, radius } from "../../theme/tokens";
import type { McpTool } from "../../features/mcp/api/use-mcp";

export function ToolList({ tools }: { tools: McpTool[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tools.map((t) => (
        <div key={t.name} style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: "10px 12px" }}>
          <span className="mono" style={{ color: colors.green }}>{t.name}</span>
          <div style={{ fontSize: 11, color: colors.dim, marginTop: 4 }}>{t.description}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the barrel**

`ToolList/index.ts`: `export { ToolList } from "./ToolList";`

- [ ] **Step 4: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/mcp/api/use-mcp.ts apps/web/src/components/ToolList
git commit -m "feat(web): useMcpTools hook + reusable ToolList component"
```

---

### Task 9: Show SSE endpoint + token + tool list on the MCP screen

**Files:**
- Modify: `apps/web/src/screens/Mcp.tsx`

- [ ] **Step 1: Add an "SSE / MCP nativo" panel and the tool list**

Import `useMcpTools` and `ToolList`; keep the existing REST contract panel and reports stream unchanged. Add, in the grid, a panel with the SSE connection info:

```tsx
import { ToolList } from "../components/ToolList";
import { useMcpReports, useMcpTools } from "../features/mcp/api/use-mcp";
```

```tsx
const tools = useMcpTools();
```

```tsx
<Panel title="MCP nativo · SSE">
  <div className="mono" style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 14px", color: colors.green }}>
    GET http://localhost:4000/api/mcp/sse
  </div>
  <div className="mono" style={{ fontSize: 11, color: colors.dim, marginTop: 10 }}>
    POST /api/mcp/messages?sessionId=… · header: Authorization: Bearer &lt;MCP_SHARED_TOKEN&gt;
  </div>
  <div className="mono" style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
    token configurable vía env MCP_SHARED_TOKEN · vacío = abierto
  </div>
</Panel>
```

- [ ] **Step 2: Add a tool-list panel below the grid (before the reports stream)**

```tsx
<Panel title="Tools registrados">
  <ToolList tools={tools} />
</Panel>
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (tsc + vite).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens/Mcp.tsx
git commit -m "feat(web): MCP screen shows SSE endpoint, token info, and live tool list"
```

---

## Phase E — Verification

### Task 10: Back-compat + MCP transport smoke

- [ ] **Step 1: Ensure the stack is running** (db + api + web).

- [ ] **Step 2: Confirm the existing REST ingest is unchanged (back-compat)**

```bash
B=http://localhost:4000/api
curl -s -X POST $B/mcp/report-work -H "Content-Type: application/json" \
  -d '{"taskId":"<task-id>","memberEmail":"owner@acm.local","minutes":30,"aiRuns":[{"model":"claude-opus-4-8","tokensIn":1240,"tokensOut":980}]}'
curl -s $B/mcp/reports
```
Expected: report-work returns `{recorded:true, aiCost:<real>}`; reports lists the new entry. (No regression vs v2.)

- [ ] **Step 3: Smoke-test the SSE stream + messages endpoint**

```bash
# stream opens and emits an endpoint event (Ctrl-C after a line appears):
curl -N -s http://localhost:4000/api/mcp/sse
```
Expected: an SSE `event: endpoint` line referencing `/api/mcp/messages?sessionId=…`. With `MCP_SHARED_TOKEN` set, the same request WITHOUT `Authorization: Bearer <token>` returns 401.

> Full client round-trip (tools/list, tools/call) is best exercised by connecting an MCP client (e.g. the SDK's example client or an IDE). The unit tests in Tasks 3–4 already prove the handlers delegate to the use cases; this step only confirms the transport opens and the guard enforces the token.

- [ ] **Step 4: Browser check**

Open http://localhost:5173/ (MCP screen via Settings) → confirm the new "MCP nativo · SSE" panel shows `GET /api/mcp/sse`, the token hint, and the "Tools registrados" panel lists `report_work`, `list_projects`, `list_tasks`. The existing REST contract + reports stream still render.

- [ ] **Step 5: Run `code-reviewer`, fix any findings, mark plan complete**

```bash
git add -A
git commit -m "test: verify MCP SSE transport smoke + REST ingest back-compat"
```

---

## Self-Review (completed by plan author)

- **Scope coverage:** SDK dependency (Task 1) ✔; token-verifier port + env adapter (Task 2) ✔; `report_work` tool delegating to `ReportWorkUseCase` (Task 3) ✔; `list_projects` + `list_tasks` tools delegating to existing list use cases (Task 4) ✔; `McpServerFactory` registering all three tools (Task 5) ✔; SSE `GET /mcp/sse` + `POST /mcp/messages` controller bridging Nest req/res to `SSEServerTransport`, with token guard (Task 6) ✔; module wiring that imports Projects/Tasks modules and reuses their use cases (Task 7) ✔; frontend SSE/token/tool-list (Tasks 8–9) ✔; delegation unit tests + transport smoke note (Tasks 3–4, 10) ✔. Back-compat of `POST /mcp/report-work` preserved (untouched controller/DTO/use case) — verified in Task 10.
- **No logic duplication:** tool handlers call existing use cases only; AI cost stays inside `ReportWorkUseCase` via `@acm/shared`. The SDK appears solely in `infrastructure/` (factory + tools) and `interfaces/http` (SSE controller).
- **Architecture:** domain (token port) pure; application untouched/reused; infrastructure holds the SDK + adapters; controllers thin (SSE controller only bridges transport, REST controller unchanged). Token verifier is a pluggable port (DIP) mirroring `AuthProvider`. Web: `ToolList` is presentational (props in); the hook holds the static contract.
- **Prisma:** no schema change — explicitly none; `report_work` persists `AiRun` through the existing ingest adapter.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (use backend-architect / frontend-architect), review between tasks with `code-reviewer`.
2. **Inline Execution** — execute tasks in this session with checkpoints.
