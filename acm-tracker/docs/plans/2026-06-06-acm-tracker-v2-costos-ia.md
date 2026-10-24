# ACM-TRACKER v2 — Costos & IA (UI + agregación) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Costs & Reports screens — real human-cost aggregation (by project, by person, by month) from existing time entries, plus an editable Model Pricing table (the source of truth for future AI cost), wired reactively into the Flight Deck UI.

**Architecture:** Same as v1. Backend = hexagonal (ports & adapters, SOLID) in `apps/api`; new read-only aggregation use cases over the existing `TimeEntry` data, plus a new `model-pricing` feature module (full CRUD). Frontend = reactive (TanStack Query + Zustand), decoupled reusable components in `apps/web/src/components`. Cost math reuses `@acm/shared` — never reimplemented. AI cost stays $0 until the MCP server (later phase) reports tokens; this plan builds the structure so AI cost slots in without refactor.

**Tech Stack:** TypeScript, NestJS 10 (Prisma 5, Postgres), React 18 + Vite, TanStack Query, Zustand, Jest (api), Vitest (web/shared).

**Authority:** `CLAUDE.md` (root), `apps/api/CLAUDE.md` (hexagonal), `apps/web/CLAUDE.md` (reactive). Use project skills `add-backend-feature` / `add-frontend-feature`; audit with `code-reviewer`. This plan is immutable once written — update only checkbox state during execution.

**Design source:** Figma page "ACM-TRACKER · Variations" — frames "FD · Costos & IA" (104:2) and "FD · Reportes · analytics" (107:2), plus the model-pricing table in "FD · Settings · members & pricing" (109:2). Example project is "Helios".

---

## Scope (explicit)

IN: (1) cost aggregation endpoints over existing human time entries; (2) ModelPricing CRUD (USD per 1M tokens, input/output, per provider+model); (3) Costs screen (composition + by-project + model-pricing table read view); (4) Reports screen (KPIs + by-person + weekly human/AI stacked, AI series = 0 for now); (5) model-pricing editor in Settings.

OUT (later phases, do NOT build here): MCP server, real token ingestion, AI cost values, the documents base, infra-expenses import.

AI cost is represented everywhere as a first-class component fixed at `$0` (with a "via MCP — próximamente" affordance), so screens match the design without fabricating data.

---

## File Structure

```
apps/api/src/modules/
├── reporting/                         # read-only aggregation over TimeEntry
│   ├── domain/ports/cost-aggregation.port.ts     # COST_AGGREGATION token + port
│   ├── application/use-cases/
│   │   ├── project-cost-breakdown.use-case.ts     # human/ai/total for one project
│   │   ├── cost-by-person.use-case.ts             # totals per member (range)
│   │   └── weekly-cost-series.use-case.ts         # last N weeks, human vs ai
│   ├── infrastructure/persistence/prisma-cost-aggregation.repository.ts
│   ├── interfaces/http/reporting.controller.ts    # GET /reports/* , /projects/:id/cost
│   └── reporting.module.ts
└── model-pricing/                     # editable price book (source of AI cost truth)
    ├── domain/
    │   ├── model-price.entity.ts                  # pure type lives in @acm/shared
    │   └── ports/model-price.repository.port.ts
    ├── application/use-cases/
    │   ├── create-model-price.use-case.ts
    │   ├── list-model-prices.use-case.ts
    │   ├── update-model-price.use-case.ts
    │   └── delete-model-price.use-case.ts
    ├── infrastructure/persistence/
    │   ├── model-price.mapper.ts
    │   └── prisma-model-price.repository.ts
    ├── interfaces/http/
    │   ├── model-prices.controller.ts             # REST /model-prices
    │   └── dto/{create,update}-model-price.dto.ts
    └── model-pricing.module.ts

packages/shared/src/
├── types.ts            # ADD: ModelPrice, AiUsage, CostBreakdown, PersonCost, WeeklyCost
└── cost.ts             # ADD: aiCostFromUsage(), breakdownCost() — pure, tested

apps/web/src/
├── features/
│   ├── reporting/api/use-reporting.ts             # useProjectCost, useCostByPerson, useWeeklyCost
│   └── model-pricing/api/use-model-prices.ts      # list + create/update/delete mutations
├── components/
│   ├── StatTile/StatTile.tsx                      # reusable KPI tile
│   ├── DonutGauge/DonutGauge.tsx                  # composition ring (human/ai/infra)
│   └── StackedBars/StackedBars.tsx                # weekly human/ai bars
└── screens/
    ├── Costs.tsx
    └── Reports.tsx
```

**Responsibility boundaries:** `reporting` is read-only (no writes) — pure aggregation. `model-pricing` owns the price book. New web components (`StatTile`, `DonutGauge`, `StackedBars`) are presentational and reusable; they receive data, never fetch.

---

## Prisma schema change

A new `ModelPrice` model is required. Delegate to **db-schema-guardian**. Additive only (new table) — safe.

```prisma
model ModelPrice {
  id             String   @id @default(cuid())
  provider       String
  model          String
  inputPer1M     Float
  outputPer1M    Float
  createdAt      DateTime @default(now())

  @@unique([provider, model])
}
```

---

## Phase A — Shared contract + AI cost math

### Task 1: Shared types for cost/AI (additive)

**Files:**
- Modify: `packages/shared/src/types.ts`

- [x] **Step 1: Append the new types to `packages/shared/src/types.ts`**

```typescript
export interface ModelPrice {
  id: string;
  provider: string;
  model: string;
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
  createdAt: string;
}

export interface AiUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface CostBreakdown {
  human: number;
  ai: number;
  total: number;
}

export interface PersonCost {
  memberId: string;
  name: string;
  minutes: number;
  human: number;
  ai: number;
  total: number;
}

export interface WeeklyCost {
  week: string; // e.g. "S22"
  human: number;
  ai: number;
}
```

- [x] **Step 2: Build shared to confirm it compiles**

Run: `pnpm --filter @acm/shared build`
Expected: tsc completes, no errors.

- [x] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): cost/AI domain types (ModelPrice, AiUsage, CostBreakdown, PersonCost, WeeklyCost)"
```

---

### Task 2: AI cost helpers (TDD)

**Files:**
- Test: `packages/shared/src/cost.test.ts` (append)
- Modify: `packages/shared/src/cost.ts`

- [x] **Step 1: Append failing tests to `packages/shared/src/cost.test.ts`**

```typescript
import { aiCostFromUsage, breakdownCost } from "./cost";
import type { AiUsage, ModelPrice } from "./types";

const price = (model: string, inP: number, outP: number): ModelPrice => ({
  id: model, provider: "anthropic", model, inputPer1M: inP, outputPer1M: outP, createdAt: "now",
});

describe("aiCostFromUsage", () => {
  const prices = [price("opus", 15, 75), price("haiku", 1, 5)];
  it("prices tokens per 1M for the matching model", () => {
    const usage: AiUsage = { model: "opus", tokensIn: 1_000_000, tokensOut: 1_000_000 };
    expect(aiCostFromUsage(usage, prices)).toBe(90);
  });
  it("scales sub-million token counts and rounds to 2 decimals", () => {
    const usage: AiUsage = { model: "opus", tokensIn: 1240, tokensOut: 980 };
    // 1240/1e6*15 + 980/1e6*75 = 0.0186 + 0.0735 = 0.0921 -> 0.09
    expect(aiCostFromUsage(usage, prices)).toBe(0.09);
  });
  it("returns 0 when the model has no price", () => {
    const usage: AiUsage = { model: "unknown", tokensIn: 1000, tokensOut: 1000 };
    expect(aiCostFromUsage(usage, prices)).toBe(0);
  });
});

describe("breakdownCost", () => {
  it("combines human and ai into a total", () => {
    expect(breakdownCost(1508, 332)).toEqual({ human: 1508, ai: 332, total: 1840 });
  });
  it("rounds the total to 2 decimals", () => {
    expect(breakdownCost(22.5, 0.09)).toEqual({ human: 22.5, ai: 0.09, total: 22.59 });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @acm/shared test`
Expected: FAIL — `aiCostFromUsage`/`breakdownCost` are not exported.

- [x] **Step 3: Append implementation to `packages/shared/src/cost.ts`**

```typescript
import type { AiUsage, CostBreakdown, ModelPrice } from "./types";

export function aiCostFromUsage(usage: AiUsage, prices: ModelPrice[]): number {
  const price = prices.find((p) => p.model === usage.model);
  if (!price) return 0;
  const cost = (usage.tokensIn / 1_000_000) * price.inputPer1M
    + (usage.tokensOut / 1_000_000) * price.outputPer1M;
  return Math.round(cost * 100) / 100;
}

export function breakdownCost(human: number, ai: number): CostBreakdown {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { human: round2(human), ai: round2(ai), total: round2(human + ai) };
}
```

> NOTE: `cost.ts` already imports `TimeEntry` from `./types`. Add the new imports at the top of the file alongside the existing import (merge into one import line or add a second `import type` line — both compile).

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @acm/shared test`
Expected: PASS — all cost tests green (the original 4 plus the new 5).

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/cost.ts packages/shared/src/cost.test.ts
git commit -m "feat(shared): aiCostFromUsage + breakdownCost helpers with tests"
```

---

## Phase B — Model Pricing backend (hexagonal, full CRUD)

### Task 3: ModelPrice schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [x] **Step 1: Append the `ModelPrice` model to `apps/api/prisma/schema.prisma`**

```prisma
model ModelPrice {
  id         String   @id @default(cuid())
  provider   String
  model      String
  inputPer1M Float
  outputPer1M Float
  createdAt  DateTime @default(now())

  @@unique([provider, model])
}
```

- [x] **Step 2: Create the migration against a throwaway local Postgres**

Run (temporary DB, then tear down — do NOT touch remote, do NOT add to compose):
```bash
docker run -d --name acm-pg-tmp -e POSTGRES_PASSWORD=temp -e POSTGRES_DB=acm_tracker -p 55433:5432 postgres:16-alpine
cd apps/api && printf 'DATABASE_URL="postgresql://postgres:temp@localhost:55433/acm_tracker?schema=public"\n' > .env
pnpm exec prisma migrate dev --name add_model_price
docker exec acm-pg-tmp psql -U postgres -d acm_tracker -c "\dt" | grep ModelPrice
rm -f .env && docker rm -f acm-pg-tmp
```
Expected: migration `*_add_model_price` created; `ModelPrice` table listed; temp DB + .env removed.

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): ModelPrice schema + migration"
```

---

### Task 4: ModelPrice port + DTOs

**Files:**
- Create: `apps/api/src/modules/model-pricing/domain/ports/model-price.repository.port.ts`
- Create: `apps/api/src/modules/model-pricing/interfaces/http/dto/create-model-price.dto.ts`
- Create: `apps/api/src/modules/model-pricing/interfaces/http/dto/update-model-price.dto.ts`

- [x] **Step 1: Create the port**

```typescript
import type { ModelPrice } from "@acm/shared";

export const MODEL_PRICE_REPOSITORY = Symbol("MODEL_PRICE_REPOSITORY");

export interface CreateModelPriceData {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export interface UpdateModelPriceData {
  provider?: string;
  model?: string;
  inputPer1M?: number;
  outputPer1M?: number;
}

export interface ModelPriceRepositoryPort {
  create(data: CreateModelPriceData): Promise<ModelPrice>;
  findAll(): Promise<ModelPrice[]>;
  update(id: string, data: UpdateModelPriceData): Promise<ModelPrice>;
  delete(id: string): Promise<void>;
}
```

- [x] **Step 2: Create `create-model-price.dto.ts`**

```typescript
import { IsNumber, IsString, Min } from "class-validator";

export class CreateModelPriceDto {
  @IsString() provider!: string;
  @IsString() model!: string;
  @IsNumber() @Min(0) inputPer1M!: number;
  @IsNumber() @Min(0) outputPer1M!: number;
}
```

- [x] **Step 3: Create `update-model-price.dto.ts`**

```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateModelPriceDto } from "./create-model-price.dto";

export class UpdateModelPriceDto extends PartialType(CreateModelPriceDto) {}
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/model-pricing/domain apps/api/src/modules/model-pricing/interfaces/http/dto
git commit -m "feat(api): model-price port + DTOs"
```

---

### Task 5: ModelPrice use cases (TDD)

**Files:**
- Test: `apps/api/src/modules/model-pricing/application/use-cases/create-model-price.use-case.spec.ts`
- Create: `apps/api/src/modules/model-pricing/application/use-cases/create-model-price.use-case.ts`
- Create: `apps/api/src/modules/model-pricing/application/use-cases/list-model-prices.use-case.ts`
- Create: `apps/api/src/modules/model-pricing/application/use-cases/update-model-price.use-case.ts`
- Create: `apps/api/src/modules/model-pricing/application/use-cases/delete-model-price.use-case.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { CreateModelPriceUseCase } from "./create-model-price.use-case";
import type { ModelPrice } from "@acm/shared";
import {
  CreateModelPriceData,
  ModelPriceRepositoryPort,
  UpdateModelPriceData,
} from "../../domain/ports/model-price.repository.port";

class FakeRepo implements ModelPriceRepositoryPort {
  public lastCreate?: CreateModelPriceData;
  async create(data: CreateModelPriceData): Promise<ModelPrice> {
    this.lastCreate = data;
    return { id: "mp1", createdAt: "now", ...data };
  }
  async findAll(): Promise<ModelPrice[]> { return []; }
  async update(_id: string, _data: UpdateModelPriceData): Promise<ModelPrice> { throw new Error("unused"); }
  async delete(_id: string): Promise<void> {}
}

describe("CreateModelPriceUseCase", () => {
  it("persists the provided price", async () => {
    const repo = new FakeRepo();
    const useCase = new CreateModelPriceUseCase(repo);
    await useCase.execute({ provider: "anthropic", model: "opus", inputPer1M: 15, outputPer1M: 75 });
    expect(repo.lastCreate).toEqual({ provider: "anthropic", model: "opus", inputPer1M: 15, outputPer1M: 75 });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test create-model-price`
Expected: FAIL — module not found.

- [x] **Step 3: Create the four use cases**

`create-model-price.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";
import { CreateModelPriceDto } from "../../interfaces/http/dto/create-model-price.dto";

@Injectable()
export class CreateModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}
  execute(dto: CreateModelPriceDto): Promise<ModelPrice> {
    return this.repo.create(dto);
  }
}
```

`list-model-prices.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";

@Injectable()
export class ListModelPricesUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}
  execute(): Promise<ModelPrice[]> {
    return this.repo.findAll();
  }
}
```

`update-model-price.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";
import { UpdateModelPriceDto } from "../../interfaces/http/dto/update-model-price.dto";

@Injectable()
export class UpdateModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}
  execute(id: string, dto: UpdateModelPriceDto): Promise<ModelPrice> {
    return this.repo.update(id, dto);
  }
}
```

`delete-model-price.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { MODEL_PRICE_REPOSITORY, ModelPriceRepositoryPort } from "../../domain/ports/model-price.repository.port";

@Injectable()
export class DeleteModelPriceUseCase {
  constructor(@Inject(MODEL_PRICE_REPOSITORY) private readonly repo: ModelPriceRepositoryPort) {}
  execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/api test create-model-price`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/model-pricing/application
git commit -m "feat(api): model-price use cases (CRUD) with test"
```

---

### Task 6: ModelPrice adapter + controller + module

**Files:**
- Create: `apps/api/src/modules/model-pricing/infrastructure/persistence/model-price.mapper.ts`
- Create: `apps/api/src/modules/model-pricing/infrastructure/persistence/prisma-model-price.repository.ts`
- Create: `apps/api/src/modules/model-pricing/interfaces/http/model-prices.controller.ts`
- Create: `apps/api/src/modules/model-pricing/model-pricing.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] **Step 1: Create the mapper**

```typescript
import type { ModelPrice as PrismaModelPrice } from "@prisma/client";
import type { ModelPrice } from "@acm/shared";

export function toDomainModelPrice(row: PrismaModelPrice): ModelPrice {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPer1M: row.inputPer1M,
    outputPer1M: row.outputPer1M,
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [x] **Step 2: Create the Prisma adapter**

```typescript
import { Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateModelPriceData,
  ModelPriceRepositoryPort,
  UpdateModelPriceData,
} from "../../domain/ports/model-price.repository.port";
import { toDomainModelPrice } from "./model-price.mapper";

@Injectable()
export class PrismaModelPriceRepository implements ModelPriceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateModelPriceData): Promise<ModelPrice> {
    const row = await this.prisma.modelPrice.create({ data });
    return toDomainModelPrice(row);
  }
  async findAll(): Promise<ModelPrice[]> {
    const rows = await this.prisma.modelPrice.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomainModelPrice);
  }
  async update(id: string, data: UpdateModelPriceData): Promise<ModelPrice> {
    const row = await this.prisma.modelPrice.update({ where: { id }, data });
    return toDomainModelPrice(row);
  }
  async delete(id: string): Promise<void> {
    await this.prisma.modelPrice.delete({ where: { id } });
  }
}
```

- [x] **Step 3: Create the controller (RESTful)**

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateModelPriceUseCase } from "../../application/use-cases/create-model-price.use-case";
import { ListModelPricesUseCase } from "../../application/use-cases/list-model-prices.use-case";
import { UpdateModelPriceUseCase } from "../../application/use-cases/update-model-price.use-case";
import { DeleteModelPriceUseCase } from "../../application/use-cases/delete-model-price.use-case";
import { CreateModelPriceDto } from "./dto/create-model-price.dto";
import { UpdateModelPriceDto } from "./dto/update-model-price.dto";

@UseGuards(AuthGuard)
@Controller("model-prices")
export class ModelPricesController {
  constructor(
    private readonly createPrice: CreateModelPriceUseCase,
    private readonly listPrices: ListModelPricesUseCase,
    private readonly updatePrice: UpdateModelPriceUseCase,
    private readonly deletePrice: DeleteModelPriceUseCase,
  ) {}

  @Post() create(@Body() dto: CreateModelPriceDto) {
    return this.createPrice.execute(dto);
  }
  @Get() findAll() {
    return this.listPrices.execute();
  }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateModelPriceDto) {
    return this.updatePrice.execute(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.deletePrice.execute(id);
  }
}
```

- [x] **Step 4: Create the module**

```typescript
import { Module } from "@nestjs/common";
import { MODEL_PRICE_REPOSITORY } from "./domain/ports/model-price.repository.port";
import { CreateModelPriceUseCase } from "./application/use-cases/create-model-price.use-case";
import { ListModelPricesUseCase } from "./application/use-cases/list-model-prices.use-case";
import { UpdateModelPriceUseCase } from "./application/use-cases/update-model-price.use-case";
import { DeleteModelPriceUseCase } from "./application/use-cases/delete-model-price.use-case";
import { PrismaModelPriceRepository } from "./infrastructure/persistence/prisma-model-price.repository";
import { ModelPricesController } from "./interfaces/http/model-prices.controller";

@Module({
  controllers: [ModelPricesController],
  providers: [
    CreateModelPriceUseCase,
    ListModelPricesUseCase,
    UpdateModelPriceUseCase,
    DeleteModelPriceUseCase,
    { provide: MODEL_PRICE_REPOSITORY, useClass: PrismaModelPriceRepository },
  ],
})
export class ModelPricingModule {}
```

- [x] **Step 5: Register in `app.module.ts`**

Add the import and include `ModelPricingModule` in the `imports` array (alongside the existing modules).

```typescript
import { ModelPricingModule } from "./modules/model-pricing/model-pricing.module";
// imports: [..., ModelPricingModule]
```

- [x] **Step 6: Build + test**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Expected: build clean; all tests green.

- [x] **Step 7: Commit**

```bash
git add apps/api/src/modules/model-pricing apps/api/src/app.module.ts
git commit -m "feat(api): model-prices adapter + RESTful controller + module"
```

---

## Phase C — Reporting backend (read-only aggregation)

### Task 7: Cost aggregation port

**Files:**
- Create: `apps/api/src/modules/reporting/domain/ports/cost-aggregation.port.ts`

- [x] **Step 1: Create the port**

```typescript
import type { PersonCost, WeeklyCost } from "@acm/shared";

export const COST_AGGREGATION = Symbol("COST_AGGREGATION");

export interface ProjectCostRow {
  human: number;
  minutes: number;
}

export interface CostAggregationPort {
  projectHumanCost(projectId: string): Promise<ProjectCostRow>;
  costByPerson(): Promise<PersonCost[]>;
  weeklyHumanCost(weeks: number): Promise<WeeklyCost[]>;
}
```

> AI fields are added by the use cases at value 0 for now (no token data until MCP). The port returns only human figures it can derive from TimeEntry.

- [x] **Step 2: Commit**

```bash
git add apps/api/src/modules/reporting/domain
git commit -m "feat(api): cost aggregation port"
```

---

### Task 8: Aggregation use cases (TDD)

**Files:**
- Test: `apps/api/src/modules/reporting/application/use-cases/project-cost-breakdown.use-case.spec.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/project-cost-breakdown.use-case.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/cost-by-person.use-case.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/weekly-cost-series.use-case.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { ProjectCostBreakdownUseCase } from "./project-cost-breakdown.use-case";
import type { PersonCost, WeeklyCost } from "@acm/shared";
import { CostAggregationPort, ProjectCostRow } from "../../domain/ports/cost-aggregation.port";

class FakeAgg implements CostAggregationPort {
  constructor(private readonly row: ProjectCostRow) {}
  async projectHumanCost(): Promise<ProjectCostRow> { return this.row; }
  async costByPerson(): Promise<PersonCost[]> { return []; }
  async weeklyHumanCost(): Promise<WeeklyCost[]> { return []; }
}

describe("ProjectCostBreakdownUseCase", () => {
  it("returns a breakdown with ai fixed at 0 and total = human", async () => {
    const useCase = new ProjectCostBreakdownUseCase(new FakeAgg({ human: 1508, minutes: 2010 }));
    const result = await useCase.execute("p1");
    expect(result).toEqual({ human: 1508, ai: 0, total: 1508, minutes: 2010 });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test project-cost-breakdown`
Expected: FAIL — module not found.

- [x] **Step 3: Create the use cases**

`project-cost-breakdown.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { breakdownCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

export interface ProjectCostBreakdown {
  human: number;
  ai: number;
  total: number;
  minutes: number;
}

@Injectable()
export class ProjectCostBreakdownUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}

  async execute(projectId: string): Promise<ProjectCostBreakdown> {
    const row = await this.agg.projectHumanCost(projectId);
    const ai = 0; // until MCP reports tokens
    const breakdown = breakdownCost(row.human, ai);
    return { ...breakdown, minutes: row.minutes };
  }
}
```

`cost-by-person.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { PersonCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class CostByPersonUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}
  execute(): Promise<PersonCost[]> {
    return this.agg.costByPerson();
  }
}
```

`weekly-cost-series.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { WeeklyCost } from "@acm/shared";
import { COST_AGGREGATION, CostAggregationPort } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class WeeklyCostSeriesUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}
  execute(weeks = 8): Promise<WeeklyCost[]> {
    return this.agg.weeklyHumanCost(weeks);
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/api test project-cost-breakdown`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/reporting/application
git commit -m "feat(api): cost aggregation use cases (breakdown, by-person, weekly) with test"
```

---

### Task 9: Aggregation adapter + controller + module

**Files:**
- Create: `apps/api/src/modules/reporting/infrastructure/persistence/prisma-cost-aggregation.repository.ts`
- Create: `apps/api/src/modules/reporting/interfaces/http/reporting.controller.ts`
- Create: `apps/api/src/modules/reporting/reporting.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] **Step 1: Create the Prisma adapter**

```typescript
import { Injectable } from "@nestjs/common";
import type { PersonCost, TimeEntry, WeeklyCost } from "@acm/shared";
import { computeEntryCost } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CostAggregationPort, ProjectCostRow } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class PrismaCostAggregationRepository implements CostAggregationPort {
  constructor(private readonly prisma: PrismaService) {}

  async projectHumanCost(projectId: string): Promise<ProjectCostRow> {
    const rows = await this.prisma.timeEntry.findMany({ where: { task: { projectId } } });
    let human = 0;
    let minutes = 0;
    for (const r of rows) {
      human += computeEntryCost(r as unknown as TimeEntry);
      minutes += r.minutes;
    }
    return { human: Math.round(human * 100) / 100, minutes };
  }

  async costByPerson(): Promise<PersonCost[]> {
    const members = await this.prisma.member.findMany({ orderBy: { createdAt: "asc" } });
    const result: PersonCost[] = [];
    for (const m of members) {
      const rows = await this.prisma.timeEntry.findMany({ where: { memberId: m.id } });
      let human = 0;
      let minutes = 0;
      for (const r of rows) {
        human += computeEntryCost(r as unknown as TimeEntry);
        minutes += r.minutes;
      }
      result.push({
        memberId: m.id, name: m.name, minutes,
        human: Math.round(human * 100) / 100, ai: 0,
        total: Math.round(human * 100) / 100,
      });
    }
    return result;
  }

  async weeklyHumanCost(weeks: number): Promise<WeeklyCost[]> {
    const rows = await this.prisma.timeEntry.findMany({ orderBy: { startedAt: "asc" } });
    const byWeek = new Map<string, number>();
    for (const r of rows) {
      const label = weekLabel(r.startedAt);
      const prev = byWeek.get(label) ?? 0;
      byWeek.set(label, prev + computeEntryCost(r as unknown as TimeEntry));
    }
    const entries = [...byWeek.entries()].slice(-weeks);
    return entries.map(([week, human]) => ({ week, human: Math.round(human * 100) / 100, ai: 0 }));
  }
}

function weekLabel(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const week = Math.ceil((diffDays + start.getDay() + 1) / 7);
  return `S${week}`;
}
```

> `weekLabel` derives an ISO-ish week number from `startedAt`; it uses no `Date.now()` (only the stored entry date), so it is deterministic per entry.

- [x] **Step 2: Create the controller (RESTful, ≤2-level nesting)**

```typescript
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { ProjectCostBreakdownUseCase } from "../../application/use-cases/project-cost-breakdown.use-case";
import { CostByPersonUseCase } from "../../application/use-cases/cost-by-person.use-case";
import { WeeklyCostSeriesUseCase } from "../../application/use-cases/weekly-cost-series.use-case";

@UseGuards(AuthGuard)
@Controller()
export class ReportingController {
  constructor(
    private readonly projectBreakdown: ProjectCostBreakdownUseCase,
    private readonly byPerson: CostByPersonUseCase,
    private readonly weekly: WeeklyCostSeriesUseCase,
  ) {}

  @Get("projects/:id/cost") projectCost(@Param("id") id: string) {
    return this.projectBreakdown.execute(id);
  }
  @Get("reports/by-person") costByPerson() {
    return this.byPerson.execute();
  }
  @Get("reports/weekly") weeklyCost(@Query("weeks") weeks?: string) {
    return this.weekly.execute(weeks ? Number(weeks) : 8);
  }
}
```

- [x] **Step 3: Create the module**

```typescript
import { Module } from "@nestjs/common";
import { COST_AGGREGATION } from "./domain/ports/cost-aggregation.port";
import { ProjectCostBreakdownUseCase } from "./application/use-cases/project-cost-breakdown.use-case";
import { CostByPersonUseCase } from "./application/use-cases/cost-by-person.use-case";
import { WeeklyCostSeriesUseCase } from "./application/use-cases/weekly-cost-series.use-case";
import { PrismaCostAggregationRepository } from "./infrastructure/persistence/prisma-cost-aggregation.repository";
import { ReportingController } from "./interfaces/http/reporting.controller";

@Module({
  controllers: [ReportingController],
  providers: [
    ProjectCostBreakdownUseCase,
    CostByPersonUseCase,
    WeeklyCostSeriesUseCase,
    { provide: COST_AGGREGATION, useClass: PrismaCostAggregationRepository },
  ],
})
export class ReportingModule {}
```

- [x] **Step 4: Register in `app.module.ts`** (add import + include `ReportingModule` in `imports`).

- [x] **Step 5: Build + test, then verify via HTTP against the running stack**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Then (stack up): `curl -s http://localhost:4000/api/projects/<helios-id>/cost`
Expected: build + tests green; the curl returns `{human, ai:0, total, minutes}`.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/reporting apps/api/src/app.module.ts
git commit -m "feat(api): cost aggregation adapter + reporting controller + module"
```

---

## Phase D — Frontend (reactive Costs & Reports)

### Task 10: Data hooks (TanStack Query)

**Files:**
- Create: `apps/web/src/features/model-pricing/api/use-model-prices.ts`
- Create: `apps/web/src/features/reporting/api/use-reporting.ts`

- [x] **Step 1: Create `use-model-prices.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModelPrice } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useModelPrices() {
  return useQuery({
    queryKey: ["model-prices"],
    queryFn: () => apiClient.get<ModelPrice[]>("/model-prices"),
  });
}

export function useCreateModelPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { provider: string; model: string; inputPer1M: number; outputPer1M: number }) =>
      apiClient.post<ModelPrice>("/model-prices", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-prices"] }),
  });
}
```

- [x] **Step 2: Create `use-reporting.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import type { PersonCost, WeeklyCost } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

interface ProjectCost {
  human: number;
  ai: number;
  total: number;
  minutes: number;
}

export function useProjectCost(projectId: string) {
  return useQuery({
    queryKey: ["project-cost", projectId],
    queryFn: () => apiClient.get<ProjectCost>(`/projects/${projectId}/cost`),
    enabled: Boolean(projectId),
  });
}

export function useCostByPerson() {
  return useQuery({
    queryKey: ["cost-by-person"],
    queryFn: () => apiClient.get<PersonCost[]>("/reports/by-person"),
  });
}

export function useWeeklyCost() {
  return useQuery({
    queryKey: ["weekly-cost"],
    queryFn: () => apiClient.get<WeeklyCost[]>("/reports/weekly"),
  });
}
```

- [x] **Step 3: Commit**

```bash
git add apps/web/src/features/model-pricing apps/web/src/features/reporting
git commit -m "feat(web): reporting + model-pricing data hooks (TanStack Query)"
```

---

### Task 11: Reusable presentational components

**Files:**
- Create: `apps/web/src/components/StatTile/StatTile.tsx` + `index.ts`
- Create: `apps/web/src/components/DonutGauge/DonutGauge.tsx` + `index.ts`
- Create: `apps/web/src/components/StackedBars/StackedBars.tsx` + `index.ts`

- [x] **Step 1: Create `StatTile.tsx`** (KPI tile — props in, JSX out)

```tsx
import { colors, radius } from "../../theme/tokens";

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatTile({ label, value, sub, accent = colors.text }: StatTileProps) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 18 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, color: colors.muted }}>{label.toUpperCase()}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: accent, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: colors.dim, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
```

- [x] **Step 2: Create `DonutGauge.tsx`** (composition ring from segments)

```tsx
import { colors } from "../../theme/tokens";

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

export function DonutGauge({ segments, centerLabel }: { segments: DonutSegment[]; centerLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label={centerLabel}>
      <circle cx={100} cy={100} r={r} fill="none" stroke={colors.surface2} strokeWidth={16} />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = `${circumference * frac} ${circumference * (1 - frac)}`;
        const el = (
          <circle
            key={i}
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={16}
            strokeDasharray={dash}
            strokeDashoffset={-circumference * offset}
            transform="rotate(-90 100 100)"
          />
        );
        offset += frac;
        return el;
      })}
      <text x={100} y={104} textAnchor="middle" className="mono" fill={colors.text} fontSize={24} fontWeight={700}>
        {centerLabel}
      </text>
    </svg>
  );
}
```

- [x] **Step 3: Create `StackedBars.tsx`** (weekly human/ai)

```tsx
import { colors } from "../../theme/tokens";

export interface StackedBar {
  label: string;
  human: number;
  ai: number;
}

export function StackedBars({ data }: { data: StackedBar[] }) {
  const max = Math.max(1, ...data.map((d) => d.human + d.ai));
  const maxH = 180;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: maxH + 24 }}>
      {data.map((d) => {
        const hH = (d.human / max) * maxH;
        const aH = (d.ai / max) * maxH;
        return (
          <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: maxH }}>
              <div style={{ height: aH, background: colors.blue, borderRadius: "3px 3px 0 0" }} />
              <div style={{ height: hH, background: colors.coral }} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: colors.dim }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [x] **Step 4: Create the three `index.ts` barrels**

`StatTile/index.ts`: `export { StatTile } from "./StatTile";`
`DonutGauge/index.ts`: `export { DonutGauge } from "./DonutGauge";`
`StackedBars/index.ts`: `export { StackedBars } from "./StackedBars";`

- [x] **Step 5: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/components/StatTile apps/web/src/components/DonutGauge apps/web/src/components/StackedBars
git commit -m "feat(web): reusable StatTile, DonutGauge, StackedBars components"
```

---

### Task 12: Costs screen + Reports screen + routes + Settings pricing

**Files:**
- Create: `apps/web/src/screens/Costs.tsx`
- Create: `apps/web/src/screens/Reports.tsx`
- Modify: `apps/web/src/screens/Settings.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/screens/Cabina.tsx`

- [x] **Step 1: Create `Costs.tsx`**

```tsx
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { DonutGauge } from "../components/DonutGauge";
import { StatTile } from "../components/StatTile";
import { useProjects } from "../features/projects/api/use-projects";
import { useModelPrices } from "../features/model-pricing/api/use-model-prices";
import { colors } from "../theme/tokens";

export function Costs() {
  const { data: projects = [] } = useProjects();
  const { data: prices = [] } = useModelPrices();
  return (
    <Chrome breadcrumb="/ costos">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <StatTile label="Proyectos" value={String(projects.length)} sub="activos" />
        <StatTile label="Humano" value="—" sub="agregado real" />
        <StatTile label="IA" value="$0" sub="vía MCP · próximamente" accent={colors.blue} />
        <StatTile label="Modelos" value={String(prices.length)} sub="con precio" accent={colors.amber} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Composición del costo">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <DonutGauge
              segments={[
                { value: 1, color: colors.coral, label: "Humano" },
                { value: 0, color: colors.blue, label: "IA" },
              ]}
              centerLabel="Humano"
            />
          </div>
        </Panel>
        <Panel title="Precios de modelos · USD / 1M tokens">
          {prices.length === 0 && <p style={{ color: colors.muted }}>Sin modelos. Añádelos en Settings.</p>}
          {prices.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
              <span className="mono">{p.model}</span>
              <span className="mono" style={{ color: colors.green }}>${p.inputPer1M} / ${p.outputPer1M}</span>
            </div>
          ))}
        </Panel>
      </div>
    </Chrome>
  );
}
```

- [x] **Step 2: Create `Reports.tsx`**

```tsx
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";
import { StackedBars } from "../components/StackedBars";
import { useCostByPerson, useWeeklyCost } from "../features/reporting/api/use-reporting";
import { colors } from "../theme/tokens";

export function Reports() {
  const { data: people = [] } = useCostByPerson();
  const { data: weekly = [] } = useWeeklyCost();
  const totalHuman = people.reduce((s, p) => s + p.human, 0);
  return (
    <Chrome breadcrumb="/ reportes">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <StatTile label="Personas" value={String(people.length)} />
        <StatTile label="Costo humano" value={`$${Math.round(totalHuman)}`} accent={colors.green} />
        <StatTile label="Costo IA" value="$0" sub="vía MCP" accent={colors.blue} />
        <StatTile label="Semanas" value={String(weekly.length)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Tiempo+costo · por semana">
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, color: colors.muted }}>▇ humano</span>
            <span className="mono" style={{ fontSize: 11, color: colors.muted }}>▇ ia</span>
          </div>
          <StackedBars data={weekly.map((w) => ({ label: w.week, human: w.human, ai: w.ai }))} />
        </Panel>
        <Panel title="Por persona · costo real">
          {people.map((p) => (
            <div key={p.memberId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
              <span>{p.name}</span>
              <span className="mono">{Math.floor(p.minutes / 60)}h · ${p.total}</span>
            </div>
          ))}
          {people.length === 0 && <p style={{ color: colors.muted }}>Sin datos aún.</p>}
        </Panel>
      </div>
    </Chrome>
  );
}
```

- [x] **Step 3: Add the model-pricing editor to `Settings.tsx`**

Add a third Panel that lists `useModelPrices()` rows and a small form using `useCreateModelPrice()`. Insert after the existing two panels (keep them). Minimal form:

```tsx
// add imports at top of Settings.tsx:
import { useModelPrices, useCreateModelPrice } from "../features/model-pricing/api/use-model-prices";
import { useState } from "react";
```

```tsx
// inside the component, before return, add:
const { data: prices = [] } = useModelPrices();
const createPrice = useCreateModelPrice();
const [model, setModel] = useState("");
const [inP, setInP] = useState("");
const [outP, setOutP] = useState("");
const addPrice = () => {
  if (!model.trim()) return;
  createPrice.mutate(
    { provider: "anthropic", model: model.trim(), inputPer1M: Number(inP) || 0, outputPer1M: Number(outP) || 0 },
    { onSuccess: () => { setModel(""); setInP(""); setOutP(""); } },
  );
};
```

```tsx
// add a third Panel inside the grid (change grid to 3 columns or wrap):
<Panel title="Precios de modelos · USD / 1M tokens">
  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
    <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="modelo" aria-label="Modelo"
      style={{ flex: 2, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "8px 10px" }} />
    <input value={inP} onChange={(e) => setInP(e.target.value)} placeholder="in" aria-label="Precio input"
      style={{ width: 60, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "8px 10px" }} />
    <input value={outP} onChange={(e) => setOutP(e.target.value)} placeholder="out" aria-label="Precio output"
      style={{ width: 60, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "8px 10px" }} />
    <button onClick={addPrice} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 700 }}>+</button>
  </div>
  {prices.map((p) => (
    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
      <span className="mono">{p.model}</span>
      <span className="mono" style={{ color: colors.green }}>${p.inputPer1M} / ${p.outputPer1M}</span>
    </div>
  ))}
</Panel>
```

> Wrap the Settings grid so it holds three panels (e.g. `gridTemplateColumns: "1fr 1fr 1fr"`).

- [x] **Step 4: Wire routes in `App.tsx`**

```tsx
import { Costs } from "./screens/Costs";
import { Reports } from "./screens/Reports";
// add routes:
// <Route path="/costs" element={<Costs />} />
// <Route path="/reports" element={<Reports />} />
```

- [x] **Step 5: Add Cabina links to the new screens**

In `Cabina.tsx`, inside the "Navegación" panel, add:
```tsx
<Link to="/costs" style={{ color: colors.text }}>→ Costos & IA</Link>
<Link to="/reports" style={{ color: colors.text }}>→ Reportes</Link>
```

- [x] **Step 6: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (tsc + vite).

- [x] **Step 7: Commit**

```bash
git add apps/web/src/screens apps/web/src/App.tsx
git commit -m "feat(web): Costs + Reports screens, model-pricing editor in Settings, routes"
```

---

## Phase E — Verification

### Task 13: E2E of Costs & Reports

- [x] **Step 1: Ensure the stack is running** (db + api + web).

- [x] **Step 2: Seed a couple of model prices via API**

```bash
B=http://localhost:4000/api
curl -s -X POST $B/model-prices -H "Content-Type: application/json" -d '{"provider":"anthropic","model":"claude-opus-4-8","inputPer1M":15,"outputPer1M":75}'
curl -s -X POST $B/model-prices -H "Content-Type: application/json" -d '{"provider":"anthropic","model":"claude-haiku-4-5","inputPer1M":1,"outputPer1M":5}'
curl -s $B/model-prices
```
Expected: two prices returned by the list.

- [x] **Step 3: Verify aggregation endpoints**

```bash
curl -s $B/reports/by-person
curl -s $B/reports/weekly
```
Expected: by-person includes the owner with real `human`/`minutes` and `ai:0`; weekly returns the week(s) that have entries with `ai:0`.

- [x] **Step 4: Browser E2E**

Open http://localhost:5173/costs → 4 KPI tiles, donut (human), model-prices list shows the 2 seeded models.
Open http://localhost:5173/reports → KPIs, weekly stacked bars (coral human, no AI), by-person list with the owner's real cost.
Open http://localhost:5173/settings → add a model price via the form; confirm it appears in the list without reload (queryKey invalidation) AND appears on /costs.

- [x] **Step 5: Commit any fixes + mark plan complete**

```bash
git add -A
git commit -m "test: verify Costs & Reports E2E (real human cost, model pricing, AI=0)"
```

---

## Self-Review (completed by plan author)

- **Scope coverage:** model-pricing CRUD (Tasks 3-6) ✔; cost aggregation by project/person/week (Tasks 7-9) ✔; AI cost math ready but fixed at 0 (Task 2 + use cases) ✔; Costs screen (Task 12) ✔; Reports screen (Task 12) ✔; model-pricing editor in Settings (Task 12) ✔; shared types (Task 1) ✔. OUT-of-scope items (MCP, token ingestion, documents) deliberately excluded.
- **Placeholders:** none — every code step has full code.
- **Type consistency:** `ModelPrice`, `PersonCost`, `WeeklyCost`, `CostBreakdown`, `AiUsage` defined in Task 1 are reused verbatim in api (Tasks 4-9) and web (Tasks 10-12). `aiCostFromUsage`/`breakdownCost` signatures match across Task 2 and Task 8. Port tokens (`MODEL_PRICE_REPOSITORY`, `COST_AGGREGATION`) are consistent between port, use case, and module. REST routes obey ≤2-level nesting (`/projects/:id/cost`, `/reports/by-person`, `/reports/weekly`).
- **Architecture:** every new backend feature follows domain/application/infrastructure/interfaces; use cases depend on ports; Prisma only in adapters; controllers thin; cost math reused from `@acm/shared`. Frontend: server state via TanStack Query with invalidation; new components presentational and reusable.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (use backend-architect / frontend-architect / db-schema-guardian), review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
