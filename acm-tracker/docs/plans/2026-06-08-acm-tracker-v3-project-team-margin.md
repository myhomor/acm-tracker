# ACM-TRACKER v3 — Project Team & Margin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a project's team explicit (real assignments, not just whoever logged time) and make the "Margen" gauge real. Add a `ProjectMember` join with RESTful assign/unassign/list endpoints, merge assigned members with their actual logged hours+cost on the Equipo tab, then compute project margin (contract − real cost) with budget-vs-consumed status and wire it into the existing DonutGauge.

**Architecture:** Same as v1/v2. Backend = hexagonal (ports & adapters, SOLID) in `apps/api`; a new `project-members` feature module (port + Prisma adapter + assign/unassign/list use cases, thin controller, DTOs) plus a read-only margin use case folded into the existing `reporting` module. Frontend = reactive (TanStack Query + Zustand), decoupled reusable components in `apps/web/src/components`. Cost math reuses `@acm/shared` and the existing `useProjectCost` / `cost-by-person` reporting — never reimplemented. Epic C (margin) depends on Epic B (membership) only loosely; phases sequence B before C.

**Tech Stack:** TypeScript, NestJS 10 (Prisma 5, Postgres), React 18 + Vite, TanStack Query, Zustand, Jest (api), Vitest (web/shared).

**Authority:** `CLAUDE.md` (root), `apps/api/CLAUDE.md` (hexagonal), `apps/web/CLAUDE.md` (reactive). Use project skills `add-backend-feature` / `add-frontend-feature`; delegate every Prisma schema/migration step to `db-schema-guardian`; audit with `code-reviewer` before merge. This plan is immutable once written — update only checkbox state during execution.

**Design source:** `apps/web/src/screens/ProjectDetail.tsx` — tabs Equipo and Costos. The Equipo tab today renders `ProjectTeam` (derived from `/reports/by-person?projectId=`); the Costos tab's "Margen" `DonutGauge` currently shows `centerLabel="—"`. Example project is "Helios".

---

## Scope (explicit)

IN: **(Epic B)** `ProjectMember` join (projectId, memberId, optional role/allocation) — additive Prisma migration; `project-members` hexagonal module with assign/unassign/list use cases and RESTful endpoints `GET/POST/DELETE /projects/:id/members` (≤2-level nesting); Equipo tab shows ASSIGNED members merged with their real logged hours+cost (assigned-but-no-time members still appear at 0h) plus assign/remove affordance. **(Epic C)** a budget/target on `Project` (additive `budgetAmount` column, contract stays the ceiling fallback); a read-only project-margin aggregation in `reporting` exposing `GET /projects/:id/margin` (contract/budget − real cost, margin %, healthy/at-risk/over status); the "Margen" DonutGauge wired with the real value + color states and a budget-vs-consumed bar.

OUT (do NOT build here): editing a member's allocation after assignment (assign/unassign only); per-member margin; historical margin trend; multi-currency; reworking the existing `/reports/by-person` derivation (it stays and is reused as the hours/cost source).

Real cost for margin is taken from the existing `ProjectCostBreakdownUseCase` (`/projects/:id/cost`) — never recomputed. AI cost stays `$0` (no token data until MCP), so `total === human` for now and margin math is unaffected.

---

## File Structure

```
apps/api/src/modules/
├── project-members/                    # NEW — explicit project↔member assignment
│   ├── domain/ports/project-member.repository.port.ts   # PROJECT_MEMBER_REPOSITORY token + port
│   ├── application/use-cases/
│   │   ├── assign-member.use-case.ts            # idempotent assign
│   │   ├── unassign-member.use-case.ts          # remove assignment
│   │   └── list-project-members.use-case.ts     # assignments for a project
│   ├── infrastructure/persistence/
│   │   ├── project-member.mapper.ts             # Prisma row -> domain
│   │   └── prisma-project-member.repository.ts
│   ├── interfaces/http/
│   │   ├── project-members.controller.ts        # REST /projects/:id/members
│   │   └── dto/assign-member.dto.ts
│   └── project-members.module.ts
└── reporting/                          # EXTEND — add margin (read-only)
    ├── domain/ports/cost-aggregation.port.ts    # MODIFY: add projectBudget()
    ├── application/use-cases/project-margin.use-case.ts   # NEW: margin from cost + budget
    ├── infrastructure/persistence/prisma-cost-aggregation.repository.ts  # MODIFY: projectBudget()
    ├── interfaces/http/reporting.controller.ts  # MODIFY: GET /projects/:id/margin
    └── reporting.module.ts                       # MODIFY: register ProjectMarginUseCase

packages/shared/src/
├── types.ts            # ADD: ProjectMember, ProjectMargin
└── margin.ts           # ADD: computeMargin() — pure, tested

apps/web/src/
├── features/
│   ├── project-members/api/use-project-members.ts   # list + assign + unassign mutations
│   └── reporting/api/use-reporting.ts               # MODIFY: add useProjectMargin
├── components/
│   └── BudgetBar/BudgetBar.tsx + index.ts           # reusable consumed-vs-budget bar
└── features/
    └── project-members/components/ProjectTeam.tsx   # NEW assignment-aware team (replaces reporting/ProjectTeam in ProjectDetail)
```

**Responsibility boundaries:** `project-members` owns the join (writes); `reporting` stays read-only and gains margin as composition over existing cost + the new budget read. `BudgetBar` is presentational (props in, JSX out) and reusable. The new `ProjectTeam` merges assignments (source of truth for membership) with the existing `useProjectTeam` hook (source of truth for hours/cost) — neither is reimplemented.

---

## Prisma schema change

Two additive changes — delegate BOTH to **db-schema-guardian**. New table + new nullable column only; no data loss, safe.

```prisma
model ProjectMember {
  id         String   @id @default(cuid())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId  String
  member     Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId   String
  role       String?
  allocation Float?   // fraction of capacity, 0..1, optional
  createdAt  DateTime @default(now())

  @@unique([projectId, memberId])
  @@index([projectId])
  @@index([memberId])
}

// Project: add the join back-relation + an optional budget ceiling
model Project {
  // ...existing fields...
  budgetAmount   Float?          // optional override of contractAmount as the budget ceiling
  members        ProjectMember[]
}

// Member: add the join back-relation
model Member {
  // ...existing fields...
  projectMembers ProjectMember[]
}
```

> `budgetAmount` is optional; margin uses `budgetAmount ?? contractAmount` as the ceiling. The back-relations on `Project`/`Member` are required by Prisma for the join's relations to compile.

---

## Phase A — Shared contract (types + margin math)

### Task 1: Shared types for team/margin (additive)

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Append the new types to `packages/shared/src/types.ts`**

```typescript
export interface ProjectMember {
  id: string;
  projectId: string;
  memberId: string;
  role: string | null;
  allocation: number | null; // 0..1 fraction of capacity, null if unset
  createdAt: string;
}

export type MarginStatus = "healthy" | "at-risk" | "over";

export interface ProjectMargin {
  budget: number;   // contract/budget ceiling
  consumed: number; // real cost (human + ai)
  margin: number;   // budget - consumed
  marginPct: number; // margin / budget, 0 when budget is 0
  status: MarginStatus;
}
```

- [ ] **Step 2: Build shared to confirm it compiles**

Run: `pnpm --filter @acm/shared build`
Expected: tsc completes, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): ProjectMember + ProjectMargin domain types"
```

---

### Task 2: Margin math helper (TDD)

**Files:**
- Test: `packages/shared/src/margin.test.ts`
- Create: `packages/shared/src/margin.ts`

- [ ] **Step 1: Write the failing test in `packages/shared/src/margin.test.ts`**

```typescript
import { computeMargin } from "./margin";

describe("computeMargin", () => {
  it("returns a healthy margin when well under budget", () => {
    expect(computeMargin(10000, 4000)).toEqual({
      budget: 10000, consumed: 4000, margin: 6000, marginPct: 0.6, status: "healthy",
    });
  });
  it("flags at-risk when consumption passes the warning threshold (>85%)", () => {
    expect(computeMargin(10000, 9000).status).toBe("at-risk");
  });
  it("flags over when consumed exceeds budget", () => {
    const r = computeMargin(10000, 12000);
    expect(r.status).toBe("over");
    expect(r.margin).toBe(-2000);
  });
  it("rounds money to 2 decimals and pct to 4", () => {
    const r = computeMargin(3333.333, 1111.111);
    expect(r.margin).toBe(2222.22);
    expect(r.marginPct).toBe(0.6667);
  });
  it("returns a zero-budget result without dividing by zero", () => {
    expect(computeMargin(0, 500)).toEqual({
      budget: 0, consumed: 500, margin: -500, marginPct: 0, status: "over",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @acm/shared test margin`
Expected: FAIL — `computeMargin` is not exported.

- [ ] **Step 3: Create `packages/shared/src/margin.ts`**

```typescript
import type { MarginStatus, ProjectMargin } from "./types";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

function statusOf(consumed: number, budget: number): MarginStatus {
  if (budget <= 0 || consumed > budget) return "over";
  if (consumed / budget > 0.85) return "at-risk";
  return "healthy";
}

export function computeMargin(budget: number, consumed: number): ProjectMargin {
  const margin = round2(budget - consumed);
  const marginPct = budget > 0 ? round4(margin / budget) : 0;
  return { budget: round2(budget), consumed: round2(consumed), margin, marginPct, status: statusOf(consumed, budget) };
}
```

- [ ] **Step 4: Export it from the package barrel**

Add `export * from "./margin";` to `packages/shared/src/index.ts` (alongside the existing `cost`/`types` exports).

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @acm/shared test margin`
Expected: PASS — all 5 cases green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/margin.ts packages/shared/src/margin.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): computeMargin helper with tests"
```

---

## Phase B — Project membership backend (hexagonal)

### Task 3: ProjectMember schema + budget column + migration (db-schema-guardian)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

> Delegate this whole task to **db-schema-guardian**. Additive only (new `ProjectMember` table + nullable `Project.budgetAmount`); safe.

- [ ] **Step 1: Add the `ProjectMember` model and the back-relations to `apps/api/prisma/schema.prisma`**

```prisma
model ProjectMember {
  id         String   @id @default(cuid())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId  String
  member     Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId   String
  role       String?
  allocation Float?
  createdAt  DateTime @default(now())

  @@unique([projectId, memberId])
  @@index([projectId])
  @@index([memberId])
}
```

Add to the existing `Project` model: `budgetAmount Float?` and `members ProjectMember[]`.
Add to the existing `Member` model: `projectMembers ProjectMember[]`.

- [ ] **Step 2: Create the migration against a throwaway local Postgres**

Run (temporary DB, then tear down — do NOT touch remote, do NOT add to compose):
```bash
docker run -d --name acm-pg-tmp -e POSTGRES_PASSWORD=temp -e POSTGRES_DB=acm_tracker -p 55433:5432 postgres:16-alpine
cd apps/api && printf 'DATABASE_URL="postgresql://postgres:temp@localhost:55433/acm_tracker?schema=public"\n' > .env
pnpm exec prisma migrate dev --name add_project_member_and_budget
docker exec acm-pg-tmp psql -U postgres -d acm_tracker -c "\dt" | grep ProjectMember
rm -f .env && docker rm -f acm-pg-tmp
```
Expected: migration `*_add_project_member_and_budget` created; `ProjectMember` table listed; temp DB + .env removed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): ProjectMember join + Project.budgetAmount schema + migration"
```

---

### Task 4: ProjectMember port + DTO

**Files:**
- Create: `apps/api/src/modules/project-members/domain/ports/project-member.repository.port.ts`
- Create: `apps/api/src/modules/project-members/interfaces/http/dto/assign-member.dto.ts`

- [ ] **Step 1: Create the port**

```typescript
import type { ProjectMember } from "@acm/shared";

export const PROJECT_MEMBER_REPOSITORY = Symbol("PROJECT_MEMBER_REPOSITORY");

export interface AssignMemberData {
  projectId: string;
  memberId: string;
  role?: string | null;
  allocation?: number | null;
}

export interface ProjectMemberRepositoryPort {
  assign(data: AssignMemberData): Promise<ProjectMember>;
  unassign(projectId: string, memberId: string): Promise<void>;
  listByProject(projectId: string): Promise<ProjectMember[]>;
}
```

- [ ] **Step 2: Create `assign-member.dto.ts`**

```typescript
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class AssignMemberDto {
  @IsString() memberId!: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) allocation?: number;
}
```

> `projectId` comes from the route param, never the body — keep it out of the DTO.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/project-members/domain apps/api/src/modules/project-members/interfaces/http/dto
git commit -m "feat(api): project-member port + assign DTO"
```

---

### Task 5: ProjectMember use cases (TDD)

**Files:**
- Test: `apps/api/src/modules/project-members/application/use-cases/assign-member.use-case.spec.ts`
- Create: `apps/api/src/modules/project-members/application/use-cases/assign-member.use-case.ts`
- Create: `apps/api/src/modules/project-members/application/use-cases/unassign-member.use-case.ts`
- Create: `apps/api/src/modules/project-members/application/use-cases/list-project-members.use-case.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { AssignMemberUseCase } from "./assign-member.use-case";
import type { ProjectMember } from "@acm/shared";
import {
  AssignMemberData,
  ProjectMemberRepositoryPort,
} from "../../domain/ports/project-member.repository.port";

class FakeRepo implements ProjectMemberRepositoryPort {
  public lastAssign?: AssignMemberData;
  async assign(data: AssignMemberData): Promise<ProjectMember> {
    this.lastAssign = data;
    return {
      id: "pm1", projectId: data.projectId, memberId: data.memberId,
      role: data.role ?? null, allocation: data.allocation ?? null, createdAt: "now",
    };
  }
  async unassign(): Promise<void> {}
  async listByProject(): Promise<ProjectMember[]> { return []; }
}

describe("AssignMemberUseCase", () => {
  it("assigns the member to the project via the port", async () => {
    const repo = new FakeRepo();
    const useCase = new AssignMemberUseCase(repo);
    await useCase.execute("p1", { memberId: "m1", role: "dev" });
    expect(repo.lastAssign).toEqual({ projectId: "p1", memberId: "m1", role: "dev", allocation: undefined });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @acm/api test assign-member`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the three use cases**

`assign-member.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectMember } from "@acm/shared";
import { PROJECT_MEMBER_REPOSITORY, ProjectMemberRepositoryPort } from "../../domain/ports/project-member.repository.port";
import { AssignMemberDto } from "../../interfaces/http/dto/assign-member.dto";

@Injectable()
export class AssignMemberUseCase {
  constructor(@Inject(PROJECT_MEMBER_REPOSITORY) private readonly repo: ProjectMemberRepositoryPort) {}
  execute(projectId: string, dto: AssignMemberDto): Promise<ProjectMember> {
    return this.repo.assign({ projectId, memberId: dto.memberId, role: dto.role, allocation: dto.allocation });
  }
}
```

`unassign-member.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { PROJECT_MEMBER_REPOSITORY, ProjectMemberRepositoryPort } from "../../domain/ports/project-member.repository.port";

@Injectable()
export class UnassignMemberUseCase {
  constructor(@Inject(PROJECT_MEMBER_REPOSITORY) private readonly repo: ProjectMemberRepositoryPort) {}
  execute(projectId: string, memberId: string): Promise<void> {
    return this.repo.unassign(projectId, memberId);
  }
}
```

`list-project-members.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { ProjectMember } from "@acm/shared";
import { PROJECT_MEMBER_REPOSITORY, ProjectMemberRepositoryPort } from "../../domain/ports/project-member.repository.port";

@Injectable()
export class ListProjectMembersUseCase {
  constructor(@Inject(PROJECT_MEMBER_REPOSITORY) private readonly repo: ProjectMemberRepositoryPort) {}
  execute(projectId: string): Promise<ProjectMember[]> {
    return this.repo.listByProject(projectId);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @acm/api test assign-member`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/project-members/application
git commit -m "feat(api): project-member use cases (assign, unassign, list) with test"
```

---

### Task 6: ProjectMember adapter + controller + module

**Files:**
- Create: `apps/api/src/modules/project-members/infrastructure/persistence/project-member.mapper.ts`
- Create: `apps/api/src/modules/project-members/infrastructure/persistence/prisma-project-member.repository.ts`
- Create: `apps/api/src/modules/project-members/interfaces/http/project-members.controller.ts`
- Create: `apps/api/src/modules/project-members/project-members.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the mapper**

```typescript
import type { ProjectMember as PrismaProjectMember } from "@prisma/client";
import type { ProjectMember } from "@acm/shared";

export function toDomainProjectMember(row: PrismaProjectMember): ProjectMember {
  return {
    id: row.id,
    projectId: row.projectId,
    memberId: row.memberId,
    role: row.role,
    allocation: row.allocation,
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 2: Create the Prisma adapter (idempotent assign via upsert)**

```typescript
import { Injectable } from "@nestjs/common";
import type { ProjectMember } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  AssignMemberData,
  ProjectMemberRepositoryPort,
} from "../../domain/ports/project-member.repository.port";
import { toDomainProjectMember } from "./project-member.mapper";

@Injectable()
export class PrismaProjectMemberRepository implements ProjectMemberRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async assign(data: AssignMemberData): Promise<ProjectMember> {
    const { projectId, memberId, role = null, allocation = null } = data;
    const row = await this.prisma.projectMember.upsert({
      where: { projectId_memberId: { projectId, memberId } },
      update: { role, allocation },
      create: { projectId, memberId, role, allocation },
    });
    return toDomainProjectMember(row);
  }

  async unassign(projectId: string, memberId: string): Promise<void> {
    await this.prisma.projectMember.deleteMany({ where: { projectId, memberId } });
  }

  async listByProject(projectId: string): Promise<ProjectMember[]> {
    const rows = await this.prisma.projectMember.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
    return rows.map(toDomainProjectMember);
  }
}
```

> `deleteMany` (not `delete`) keeps unassign idempotent — removing a non-existent assignment is a no-op, so DELETE can return 204 without a 404 race.

- [ ] **Step 3: Create the controller (RESTful, ≤2-level nesting)**

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { AssignMemberUseCase } from "../../application/use-cases/assign-member.use-case";
import { UnassignMemberUseCase } from "../../application/use-cases/unassign-member.use-case";
import { ListProjectMembersUseCase } from "../../application/use-cases/list-project-members.use-case";
import { AssignMemberDto } from "./dto/assign-member.dto";

@UseGuards(AuthGuard)
@Controller("projects/:projectId/members")
export class ProjectMembersController {
  constructor(
    private readonly assign: AssignMemberUseCase,
    private readonly unassign: UnassignMemberUseCase,
    private readonly list: ListProjectMembersUseCase,
  ) {}

  @Get() findAll(@Param("projectId") projectId: string) {
    return this.list.execute(projectId);
  }

  @Post() create(@Param("projectId") projectId: string, @Body() dto: AssignMemberDto) {
    return this.assign.execute(projectId, dto);
  }

  @Delete(":memberId") @HttpCode(204) remove(@Param("projectId") projectId: string, @Param("memberId") memberId: string) {
    return this.unassign.execute(projectId, memberId);
  }
}
```

- [ ] **Step 4: Create the module**

```typescript
import { Module } from "@nestjs/common";
import { PROJECT_MEMBER_REPOSITORY } from "./domain/ports/project-member.repository.port";
import { AssignMemberUseCase } from "./application/use-cases/assign-member.use-case";
import { UnassignMemberUseCase } from "./application/use-cases/unassign-member.use-case";
import { ListProjectMembersUseCase } from "./application/use-cases/list-project-members.use-case";
import { PrismaProjectMemberRepository } from "./infrastructure/persistence/prisma-project-member.repository";
import { ProjectMembersController } from "./interfaces/http/project-members.controller";

@Module({
  controllers: [ProjectMembersController],
  providers: [
    AssignMemberUseCase,
    UnassignMemberUseCase,
    ListProjectMembersUseCase,
    { provide: PROJECT_MEMBER_REPOSITORY, useClass: PrismaProjectMemberRepository },
  ],
})
export class ProjectMembersModule {}
```

- [ ] **Step 5: Register in `app.module.ts`**

Add the import and include `ProjectMembersModule` in the `imports` array (alongside the existing modules).

```typescript
import { ProjectMembersModule } from "./modules/project-members/project-members.module";
// imports: [..., ProjectMembersModule]
```

- [ ] **Step 6: Build + test**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Expected: build clean; all tests green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/project-members apps/api/src/app.module.ts
git commit -m "feat(api): project-members adapter + RESTful controller + module"
```

---

## Phase C — Project margin backend (read-only aggregation)

### Task 7: Extend the cost-aggregation port with project budget

**Files:**
- Modify: `apps/api/src/modules/reporting/domain/ports/cost-aggregation.port.ts`
- Modify: `apps/api/src/modules/reporting/infrastructure/persistence/prisma-cost-aggregation.repository.ts`

- [ ] **Step 1: Add `projectBudget` to `CostAggregationPort`**

```typescript
// add to the CostAggregationPort interface:
projectBudget(projectId: string): Promise<number>;
```

- [ ] **Step 2: Implement `projectBudget` in `PrismaCostAggregationRepository`**

```typescript
async projectBudget(projectId: string): Promise<number> {
  const project = await this.prisma.project.findUnique({
    where: { id: projectId },
    select: { budgetAmount: true, contractAmount: true },
  });
  return project?.budgetAmount ?? project?.contractAmount ?? 0;
}
```

> Budget ceiling = `budgetAmount` when set, else `contractAmount`, else 0. No cost recomputation here — margin reuses the existing `projectHumanCost`/breakdown.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/reporting/domain apps/api/src/modules/reporting/infrastructure
git commit -m "feat(api): cost-aggregation port reads project budget"
```

---

### Task 8: Project margin use case (TDD)

**Files:**
- Test: `apps/api/src/modules/reporting/application/use-cases/project-margin.use-case.spec.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/project-margin.use-case.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { ProjectMarginUseCase } from "./project-margin.use-case";
import type { PersonCost, WeeklyCost } from "@acm/shared";
import { CostAggregationPort, ProjectCostRow, TeamTodayRow, TodaySummary } from "../../domain/ports/cost-aggregation.port";

class FakeAgg implements CostAggregationPort {
  constructor(private readonly human: number, private readonly budget: number) {}
  async projectHumanCost(): Promise<ProjectCostRow> { return { human: this.human, minutes: 0 }; }
  async projectBudget(): Promise<number> { return this.budget; }
  async costByPerson(): Promise<PersonCost[]> { return []; }
  async weeklyHumanCost(): Promise<WeeklyCost[]> { return []; }
  async todaySummary(): Promise<TodaySummary> { return { trackedMinutes: 0, billableMinutes: 0, cost: 0 }; }
  async teamToday(): Promise<TeamTodayRow[]> { return []; }
}

describe("ProjectMarginUseCase", () => {
  it("computes a healthy margin from budget and real cost (ai=0)", async () => {
    const useCase = new ProjectMarginUseCase(new FakeAgg(4000, 10000));
    const result = await useCase.execute("p1");
    expect(result).toEqual({ budget: 10000, consumed: 4000, margin: 6000, marginPct: 0.6, status: "healthy" });
  });
  it("flags over-budget when real cost exceeds the ceiling", async () => {
    const useCase = new ProjectMarginUseCase(new FakeAgg(12000, 10000));
    expect((await useCase.execute("p1")).status).toBe("over");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @acm/api test project-margin`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the use case (composes existing cost + budget via `computeMargin`)**

```typescript
import { Inject, Injectable } from "@nestjs/common";
import { breakdownCost, computeMargin } from "@acm/shared";
import type { ProjectMargin } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class ProjectMarginUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  async execute(projectId: string): Promise<ProjectMargin> {
    const [cost, budget] = await Promise.all([
      this.agg.projectHumanCost(projectId),
      this.agg.projectBudget(projectId),
    ]);
    const consumed = breakdownCost(cost.human, 0).total; // ai = 0 until MCP
    return computeMargin(budget, consumed);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @acm/api test project-margin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reporting/application/use-cases/project-margin.use-case.ts apps/api/src/modules/reporting/application/use-cases/project-margin.use-case.spec.ts
git commit -m "feat(api): project-margin use case (composes cost + budget) with test"
```

---

### Task 9: Expose the margin endpoint + register the use case

**Files:**
- Modify: `apps/api/src/modules/reporting/interfaces/http/reporting.controller.ts`
- Modify: `apps/api/src/modules/reporting/reporting.module.ts`

- [ ] **Step 1: Add the route to `ReportingController`** (inject `ProjectMarginUseCase`, add the handler)

```typescript
// constructor: add `private readonly projectMargin: ProjectMarginUseCase,`
@Get("projects/:id/margin") projectMarginRoute(@Param("id") id: string) {
  return this.projectMargin.execute(id);
}
```

> Obeys ≤2-level nesting (`/projects/:id/margin`), same shape as the existing `/projects/:id/cost`.

- [ ] **Step 2: Register `ProjectMarginUseCase` in `reporting.module.ts`** (add import + add to the `providers` array).

- [ ] **Step 3: Build + test, then verify via HTTP against the running stack**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Then (stack up): `curl -s http://localhost:4000/api/projects/<helios-id>/margin`
Expected: build + tests green; the curl returns `{budget, consumed, margin, marginPct, status}`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/reporting/interfaces apps/api/src/modules/reporting/reporting.module.ts
git commit -m "feat(api): expose GET /projects/:id/margin"
```

---

## Phase D — Frontend (reactive Equipo + Margen)

### Task 10: Data hooks (TanStack Query)

**Files:**
- Create: `apps/web/src/features/project-members/api/use-project-members.ts`
- Modify: `apps/web/src/features/reporting/api/use-reporting.ts`

- [ ] **Step 1: Create `use-project-members.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectMember } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId),
  });
}

export function useAssignMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { memberId: string; role?: string; allocation?: number }) =>
      apiClient.post<ProjectMember>(`/projects/${projectId}/members`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", projectId] }),
  });
}

export function useUnassignMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => apiClient.del<void>(`/projects/${projectId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", projectId] }),
  });
}
```

- [ ] **Step 2: Add `useProjectMargin` to `use-reporting.ts`**

```typescript
import type { ProjectMargin } from "@acm/shared";

export function useProjectMargin(projectId: string) {
  return useQuery({
    queryKey: ["project-margin", projectId],
    queryFn: () => apiClient.get<ProjectMargin>(`/projects/${projectId}/margin`),
    enabled: Boolean(projectId),
  });
}
```

> Keep the existing `useProjectCost` / `useProjectTeam` exports untouched — they remain the hours/cost source.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/project-members/api apps/web/src/features/reporting/api/use-reporting.ts
git commit -m "feat(web): project-members + project-margin data hooks (TanStack Query)"
```

---

### Task 11: Reusable BudgetBar component

**Files:**
- Create: `apps/web/src/components/BudgetBar/BudgetBar.tsx` + `index.ts`

- [ ] **Step 1: Create `BudgetBar.tsx`** (consumed-vs-budget bar — props in, JSX out, theme tokens only)

```tsx
import type { MarginStatus } from "@acm/shared";
import { colors } from "../../theme/tokens";

const STATUS_COLOR: Record<MarginStatus, string> = {
  healthy: colors.green,
  "at-risk": colors.amber,
  over: colors.coral,
};

interface BudgetBarProps {
  consumed: number;
  budget: number;
  status: MarginStatus;
}

export function BudgetBar({ consumed, budget, status }: BudgetBarProps) {
  const pct = budget > 0 ? Math.min(consumed / budget, 1) : 1;
  const fill = STATUS_COLOR[status];
  return (
    <div>
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: colors.dim, marginBottom: 6 }}>
        <span>${consumed.toLocaleString("en-US")}</span>
        <span>de ${budget.toLocaleString("en-US")}</span>
      </div>
      <div style={{ height: 8, background: colors.surface2, borderRadius: 4 }}>
        <div style={{ height: 8, width: `${pct * 100}%`, background: fill, borderRadius: 4 }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the barrel**

`BudgetBar/index.ts`: `export { BudgetBar } from "./BudgetBar";`

- [ ] **Step 3: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/BudgetBar
git commit -m "feat(web): reusable BudgetBar component"
```

---

### Task 12: Assignment-aware Equipo tab + real Margen gauge

**Files:**
- Create: `apps/web/src/features/project-members/components/ProjectTeam.tsx`
- Modify: `apps/web/src/screens/ProjectDetail.tsx`

- [ ] **Step 1: Create the assignment-aware `ProjectTeam.tsx`**

Merge assignments (membership source of truth) with `useProjectTeam` (hours/cost source). Assigned-but-no-time members appear at 0h. Reuse the existing `Panel`, `DataTable`, `Avatar`, `useMembers`, and `useProjectTeam` — do not refetch by hand.

```tsx
import { Panel } from "../../../components/Panel";
import { DataTable } from "../../../components/DataTable";
import { Avatar } from "../../../components/Avatar";
import { useMembers } from "../../members/api/use-members";
import { useProjectTeam } from "../../reporting/api/use-reporting";
import { useProjectMembers, useAssignMember, useUnassignMember } from "../api/use-project-members";
import { colors } from "../../../theme/tokens";

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function ProjectTeam({ projectId }: { projectId: string }) {
  const { data: assignments = [] } = useProjectMembers(projectId);
  const { data: cost = [] } = useProjectTeam(projectId);
  const { data: members = [] } = useMembers();
  const assign = useAssignMember(projectId);
  const unassign = useUnassignMember(projectId);

  const costByMember = new Map(cost.map((c) => [c.memberId, c]));
  const assignedIds = new Set(assignments.map((a) => a.memberId));
  const unassigned = members.filter((m) => !assignedIds.has(m.id));

  return (
    <Panel title="Equipo · asignados y costo real">
      {unassigned.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {unassigned.map((m) => (
            <button key={m.id} onClick={() => assign.mutate({ memberId: m.id })}
              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
              + {m.name}
            </button>
          ))}
        </div>
      )}
      <DataTable
        columns={[
          { key: "person", label: "Persona" },
          { key: "hours", label: "Horas", width: 80, align: "right" },
          { key: "human", label: "Costo humano", width: 130, align: "right" },
          { key: "total", label: "Total", width: 100, align: "right" },
          { key: "action", label: "", width: 90, align: "right" },
        ]}
        rows={assignments.map((a, i) => {
          const member = members.find((m) => m.id === a.memberId);
          const c = costByMember.get(a.memberId);
          return {
            id: a.memberId,
            cells: {
              person: (
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar initials={initialsOf(member?.name ?? "?")} index={i} size={30} />
                  <span style={{ fontWeight: 600 }}>{member?.name ?? a.memberId}</span>
                </span>
              ),
              hours: <span className="mono" style={{ color: colors.muted }}>{Math.floor((c?.minutes ?? 0) / 60)}h</span>,
              human: <span className="mono">${c?.human ?? 0}</span>,
              total: <span className="mono" style={{ fontWeight: 700, color: colors.green }}>${c?.total ?? 0}</span>,
              action: (
                <button onClick={() => unassign.mutate(a.memberId)}
                  style={{ background: "transparent", color: colors.coral, border: "none", cursor: "pointer" }}>
                  quitar
                </button>
              ),
            },
          };
        })}
        emptyLabel="Sin asignados. Añade a alguien del equipo arriba."
      />
    </Panel>
  );
}
```

- [ ] **Step 2: Point the Equipo tab at the new component + wire the real Margen gauge**

In `apps/web/src/screens/ProjectDetail.tsx`:
- Change the `ProjectTeam` import from `../features/reporting/components/ProjectTeam` to `../features/project-members/components/ProjectTeam`.
- Add `import { useProjectMargin } from "../features/reporting/api/use-reporting";` and `import { BudgetBar } from "../components/BudgetBar";`.
- Inside the component: `const { data: margin } = useProjectMargin(id);`
- Replace the Margen Panel body (`centerLabel="—"`) with the real value, status color, and a `BudgetBar`:

```tsx
const MARGIN_COLOR = { healthy: colors.green, "at-risk": colors.amber, over: colors.coral } as const;
const marginColor = margin ? MARGIN_COLOR[margin.status] : colors.green;
```

```tsx
<Panel title="Margen">
  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
    <DonutGauge
      segments={[
        { value: Math.max(margin?.margin ?? 0, 0), color: marginColor, label: "margen" },
        { value: margin?.consumed ?? 0, color: colors.surface2, label: "consumido" },
      ]}
      centerLabel={margin ? `${Math.round(margin.marginPct * 100)}%` : "—"}
    />
  </div>
  {margin && <BudgetBar consumed={margin.consumed} budget={margin.budget} status={margin.status} />}
</Panel>
```

> Reuse the existing `DonutGauge` (do not fork it). The gauge's healthy/at-risk/over color comes from `margin.status`; the budget-vs-consumed bar is the reusable `BudgetBar`.

- [ ] **Step 3: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (tsc + vite).

- [ ] **Step 4: Delete the now-unused reporting `ProjectTeam` if nothing else imports it**

Search `apps/web/src` for `reporting/components/ProjectTeam`. If `ProjectDetail.tsx` was the only importer, delete `apps/web/src/features/reporting/components/ProjectTeam.tsx` (no dead weight per CLAUDE.md). If anything else still imports it, leave it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/project-members/components apps/web/src/screens/ProjectDetail.tsx
git commit -m "feat(web): assignment-aware Equipo tab + real Margen gauge with BudgetBar"
```

---

## Phase E — Verification

### Task 13: E2E of Equipo & Margen

- [ ] **Step 1: Ensure the stack is running** (db + api + web).

- [ ] **Step 2: Assign / list / unassign members via API**

```bash
B=http://localhost:4000/api
P=<helios-id>; M=<member-id>
curl -s -X POST $B/projects/$P/members -H "Content-Type: application/json" -d "{\"memberId\":\"$M\",\"role\":\"dev\"}"
curl -s $B/projects/$P/members
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $B/projects/$P/members/$M
curl -s $B/projects/$P/members
```
Expected: POST returns the assignment; list includes it; DELETE returns `204`; list is empty again.

- [ ] **Step 3: Verify the margin endpoint**

```bash
curl -s $B/projects/$P/margin
```
Expected: `{budget, consumed, margin, marginPct, status}` with `status` one of healthy/at-risk/over and `consumed` matching `/projects/$P/cost` `.total`.

- [ ] **Step 4: Browser E2E**

Open http://localhost:5173/projects/<helios-id> → Equipo tab: assign a member from the chips, confirm they appear in the table at 0h (or their real hours if they logged time) without reload (queryKey invalidation); click "quitar" and confirm they leave the table.
Costos tab → "Margen" gauge shows a real percentage and status color (green/amber/coral), and the BudgetBar shows consumed vs budget.

- [ ] **Step 5: Run `code-reviewer` over the diff, commit any fixes + mark plan complete**

```bash
git add -A
git commit -m "test: verify Equipo assignment + Margen E2E (real membership, budget, margin status)"
```

---

## Self-Review (completed by plan author)

- **Scope coverage:** Epic B — `ProjectMember` schema/migration (Task 3) ✔; port + DTO (Task 4) ✔; assign/unassign/list use cases (Task 5) ✔; adapter + RESTful `/projects/:id/members` controller + module (Task 6) ✔; assignment-aware Equipo tab merged with real hours/cost (Tasks 10–12) ✔. Epic C — `budgetAmount` column (Task 3) ✔; budget read on the port (Task 7) ✔; margin use case via `computeMargin` (Task 8) ✔; `GET /projects/:id/margin` (Task 9) ✔; real Margen gauge + BudgetBar with status colors (Tasks 11–12) ✔. OUT-of-scope items (allocation editing, per-member margin, trend) deliberately excluded.
- **Placeholders:** none — every code step has full code.
- **Type consistency:** `ProjectMember`, `ProjectMargin`, `MarginStatus` defined in Task 1 are reused verbatim in api (Tasks 4–9) and web (Tasks 10–12). `computeMargin` signature matches across Task 2, Task 8, and the gauge color mapping in Task 12. Port token `PROJECT_MEMBER_REPOSITORY` is consistent across port, use cases, and module; `COST_AGGREGATION` reused (not redefined) for the margin use case. REST routes obey ≤2-level nesting (`/projects/:id/members`, `/projects/:id/members/:memberId`, `/projects/:id/margin`).
- **Architecture:** every backend change follows domain/application/infrastructure/interfaces; use cases depend on ports; Prisma only in adapters; controllers thin; margin composes existing `projectHumanCost` + new `projectBudget` rather than recomputing cost; cost/margin math from `@acm/shared`. Frontend: server state via TanStack Query with invalidation on assign/unassign; `BudgetBar` presentational and reusable; existing `DonutGauge` reused, not forked.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (use backend-architect / frontend-architect / db-schema-guardian), review between tasks with code-reviewer.
2. **Inline Execution** — execute tasks in this session with checkpoints.
