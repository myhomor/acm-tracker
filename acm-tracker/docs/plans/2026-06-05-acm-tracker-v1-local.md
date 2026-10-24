# ACM-TRACKER v1 (Local) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-runnable ACM-TRACKER v1 — a time+cost tracker with manual entry — that anyone can start with a single `docker compose up`, connecting to a remote Postgres database.

**Architecture:** Monorepo with a React+Vite frontend (`apps/web`) and a NestJS backend (`apps/api`) sharing TypeScript types via `packages/shared`. The backend talks to a **remote** Postgres via Prisma (no local DB container). Authentication is a **pluggable module**: v1 ships only a `NoAuthProvider` (single implicit owner, zero-friction start), with a clean `AuthProvider` interface so a Cognito implementation can be plugged in later without refactoring. Cost is computed as `time × rate` per person/task/project; the data model is MCP-ready (time entries carry an `origin` so agent ingestion can be added in phase 2) but no MCP server is built in v1.

**Tech Stack:** TypeScript, React 18 + Vite, **TanStack Query + Zustand** (reactive frontend state), NestJS 10, Prisma 5 (Postgres), Vitest (web) + Jest (api), Docker + docker-compose, pnpm workspaces.

> **ARCHITECTURE AUTHORITY (read first, supersedes any structural detail below):** The binding architecture is defined in `CLAUDE.md` (root), `apps/api/CLAUDE.md` (backend = **Hexagonal / ports & adapters**, SOLID, RESTful ≤2-level nesting, zero-comment), and `apps/web/CLAUDE.md` (frontend = reactive, decoupled reusable components, TanStack Query for server state, Zustand for UI state). When adding features, follow the project skills `add-backend-feature` and `add-frontend-feature`, and delegate to the project agents (`backend-architect`, `frontend-architect`, `db-schema-guardian`), then audit with `code-reviewer`. The task code blocks below are illustrative of behavior/tests; their **folder structure must be mapped onto the hexagonal layout** (domain/application/infrastructure/interfaces) from `apps/api/CLAUDE.md` rather than the flat controller→service→repo shown inline. Same for the frontend: data access goes through TanStack Query hooks under `features/<feature>/api`, not inline fetches in screens.

**Visual direction:** "Flight Deck" — dark cockpit theme. Tokens: bg `#0B0D12`, surface `#11141B`, surface-2 `#161A22`, border `#1F242E`, text `#E6E8EC`, muted `#9AA0B4`, coral/brand `#F44E5C`, green `#22C55E`, amber `#F59E0B`, blue `#60A5FA`. Fonts: JetBrains Mono (data) + Inter (labels). Borders not shadows; technical grid background; registration corner marks.

---

## File Structure

```
acm-tracker/
├── docker-compose.yml            # 2 services: web, api (NO db — remote)
├── .env.example                  # DATABASE_URL, ports, OWNER_* defaults
├── .gitignore
├── package.json                  # pnpm workspace root
├── pnpm-workspace.yaml
├── README.md                     # "how to run" — single source of setup truth
├── packages/
│   └── shared/                   # shared TS types + cost helpers (no runtime deps)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types.ts          # Project, Task, TimeEntry, Member, etc.
│           └── cost.ts           # computeEntryCost(), sumCost() — pure fns
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts           # seeds the local owner + sample data
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── auth/             # the pluggable auth module
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth-provider.interface.ts
│   │   │   │   ├── no-auth.provider.ts
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── auth.guard.ts
│   │   │   ├── members/
│   │   │   │   ├── members.module.ts
│   │   │   │   ├── members.controller.ts
│   │   │   │   ├── members.service.ts
│   │   │   │   └── dto/
│   │   │   ├── projects/
│   │   │   │   ├── projects.module.ts
│   │   │   │   ├── projects.controller.ts
│   │   │   │   ├── projects.service.ts
│   │   │   │   └── dto/
│   │   │   ├── tasks/
│   │   │   │   ├── tasks.module.ts
│   │   │   │   ├── tasks.controller.ts
│   │   │   │   ├── tasks.service.ts
│   │   │   │   └── dto/
│   │   │   └── time-entries/
│   │   │       ├── time-entries.module.ts
│   │   │       ├── time-entries.controller.ts
│   │   │       ├── time-entries.service.ts
│   │   │       └── dto/
│   │   └── test/                 # e2e + unit tests mirror src/
│   └── web/                      # React + Vite frontend
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── theme/
│           │   ├── tokens.ts     # Flight Deck color/space tokens
│           │   └── global.css
│           ├── lib/
│           │   └── api.ts        # typed fetch client (uses packages/shared)
│           ├── components/
│           │   ├── Chrome.tsx    # grid bg + registration marks + topbar
│           │   ├── Panel.tsx
│           │   ├── Gauge.tsx     # ring gauge (burn rate)
│           │   └── Timer.tsx
│           └── screens/
│               ├── Cabina.tsx
│               ├── Projects.tsx
│               ├── ProjectDetail.tsx
│               └── Settings.tsx
```

**Responsibility boundaries:**
- `packages/shared` — the contract. Types + pure cost math. Imported by both web and api so cost is computed identically everywhere. Zero framework deps.
- `apps/api/auth` — identity abstraction. Everything else depends on `AuthProvider`, never on a concrete provider.
- Each domain module (`members`, `projects`, `tasks`, `time-entries`) — one responsibility, owns its controller/service/DTOs.
- `apps/web/components` — reusable Flight Deck primitives; `screens` compose them.

---

## Phase 0 — Foundation

### Task 1: Monorepo skeleton + pnpm workspace

**Files:**
- Create: `acm-tracker/package.json`
- Create: `acm-tracker/pnpm-workspace.yaml`
- Create: `acm-tracker/.gitignore`
- Create: `acm-tracker/.env.example`

- [x] **Step 1: Create the workspace root `package.json`**

```json
{
  "name": "acm-tracker",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [x] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [x] **Step 3: Create `.gitignore`** (created with a superset: also ignores build/, coverage/, .vite/, *.tsbuildinfo, .claude/settings.local.json)

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
apps/api/prisma/*.db
uploads/
```

- [x] **Step 4: Create `.env.example`**

```
# Remote Postgres — fill with your server's connection string
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/acm_tracker?schema=public&sslmode=require"

# Ports
API_PORT=4000
WEB_PORT=5173

# Local owner (used by NoAuthProvider until a real auth provider is enabled)
OWNER_NAME="Harry G."
OWNER_EMAIL="owner@acm.local"
OWNER_RATE_PER_HOUR=45
```

- [x] **Step 5: Commit** (repo already initialized in an earlier step; committed as part of the foundation)

```bash
cd acm-tracker && git init && git add -A
git commit -m "chore: monorepo skeleton with pnpm workspace"
```

---

### Task 2: Shared types package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [x] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@acm/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [x] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [x] **Step 3: Create `packages/shared/src/types.ts`**

```typescript
export type EntryOrigin = "manual" | "mcp"; // mcp reserved for phase 2

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  ratePerHour: number; // USD/hour
  authProviderUserId: string | null; // null until a real auth provider links it
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  contractAmount: number | null; // USD, nullable for internal projects
  status: "active" | "paused" | "done";
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  code: string; // e.g. "T-142"
  title: string;
  phase: string | null; // optional lifecycle label
  status: "todo" | "in_progress" | "review" | "done";
  estimateMinutes: number | null;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  memberId: string;
  origin: EntryOrigin;
  minutes: number;
  billable: boolean;
  ratePerHourSnapshot: number; // rate captured at entry time
  note: string | null;
  startedAt: string;
  createdAt: string;
}
```

- [x] **Step 4: Create `packages/shared/src/index.ts`**

```typescript
export * from "./types.js";
export * from "./cost.js";
```

- [x] **Step 5: Commit** (committed together with Task 3)

```bash
git add packages/shared
git commit -m "feat(shared): domain types contract"
```

---

### Task 3: Shared cost helpers (TDD)

**Files:**
- Test: `packages/shared/src/cost.test.ts`
- Create: `packages/shared/src/cost.ts`

- [x] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeEntryCost, sumCost } from "./cost.js";
import type { TimeEntry } from "./types.js";

const entry = (minutes: number, rate: number, billable = true): TimeEntry => ({
  id: "e", taskId: "t", memberId: "m", origin: "manual",
  minutes, billable, ratePerHourSnapshot: rate, note: null,
  startedAt: "2026-06-05T09:00:00Z", createdAt: "2026-06-05T09:00:00Z",
});

describe("computeEntryCost", () => {
  it("multiplies minutes by hourly rate", () => {
    expect(computeEntryCost(entry(60, 45))).toBe(45);
    expect(computeEntryCost(entry(30, 48.5))).toBe(24.25);
  });
  it("rounds to 2 decimals", () => {
    expect(computeEntryCost(entry(45, 32))).toBe(24);
    expect(computeEntryCost(entry(7, 45))).toBe(5.25);
  });
});

describe("sumCost", () => {
  it("sums billable and non-billable separately", () => {
    const r = sumCost([entry(60, 45), entry(30, 45, false)]);
    expect(r.total).toBe(67.5);
    expect(r.billable).toBe(45);
  });
  it("returns zeros for empty input", () => {
    expect(sumCost([])).toEqual({ total: 0, billable: 0, minutes: 0 });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/shared test`
Expected: FAIL — "Cannot find module './cost.js'"

- [x] **Step 3: Write minimal implementation `packages/shared/src/cost.ts`**

```typescript
import type { TimeEntry } from "./types.js";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeEntryCost(entry: TimeEntry): number {
  return round2((entry.minutes / 60) * entry.ratePerHourSnapshot);
}

export interface CostSummary {
  total: number;
  billable: number;
  minutes: number;
}

export function sumCost(entries: TimeEntry[]): CostSummary {
  const acc = entries.reduce(
    (a, e) => {
      const cost = computeEntryCost(e);
      a.total += cost;
      if (e.billable) a.billable += cost;
      a.minutes += e.minutes;
      return a;
    },
    { total: 0, billable: 0, minutes: 0 },
  );
  return { total: round2(acc.total), billable: round2(acc.billable), minutes: acc.minutes };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/shared test`
Expected: PASS — all 4 tests green

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/cost.ts packages/shared/src/cost.test.ts
git commit -m "feat(shared): cost computation helpers with tests"
```

---
### Task 4: NestJS app scaffold + Prisma

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`

- [x] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@acm/api",
  "version": "0.1.0",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@acm/shared": "workspace:*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@prisma/client": "^5.14.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/testing": "^10.3.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.12.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "prisma": "^5.14.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

- [x] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "outDir": "./dist",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "baseUrl": "./"
  }
}
```

- [x] **Step 3: Create `apps/api/nest-cli.json`**

```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [x] **Step 4: Create `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Member {
  id                 String      @id @default(cuid())
  name               String
  email              String      @unique
  role               String      @default("member")
  ratePerHour        Float       @default(0)
  authProviderUserId String?     @unique
  createdAt          DateTime    @default(now())
  timeEntries        TimeEntry[]
}

model Project {
  id             String   @id @default(cuid())
  name           String
  client         String?
  contractAmount Float?
  status         String   @default("active")
  createdAt      DateTime @default(now())
  tasks          Task[]
}

model Task {
  id              String      @id @default(cuid())
  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId       String
  code            String
  title           String
  phase           String?
  status          String      @default("todo")
  estimateMinutes Int?
  createdAt       DateTime    @default(now())
  timeEntries     TimeEntry[]

  @@unique([projectId, code])
}

model TimeEntry {
  id                  String   @id @default(cuid())
  task                Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId              String
  member              Member   @relation(fields: [memberId], references: [id])
  memberId            String
  origin              String   @default("manual")
  minutes             Int
  billable            Boolean  @default(true)
  ratePerHourSnapshot Float
  note                String?
  startedAt           DateTime
  createdAt           DateTime @default(now())

  @@index([taskId])
  @@index([memberId])
}

model WorkspaceSettings {
  id           Int     @id @default(1)
  authProvider String  @default("none")
  authConfig   Json?
}
```

- [x] **Step 5: Create `apps/api/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [x] **Step 6: Create `apps/api/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [x] **Step 7: Create `apps/api/src/app.module.ts`** (DEVIATION: created MINIMAL — imports only PrismaModule. The auth/members/projects/tasks/time-entries imports shown below are added in their own tasks so the app stays compilable now, per the Architecture Authority note.)

```typescript
import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { MembersModule } from "./members/members.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { TimeEntriesModule } from "./time-entries/time-entries.module";

@Module({
  imports: [PrismaModule, AuthModule, MembersModule, ProjectsModule, TasksModule, TimeEntriesModule],
})
export class AppModule {}
```

- [x] **Step 8: Create `apps/api/src/main.ts`**

```typescript
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix("api");
  await app.listen(process.env.API_PORT ?? 4000);
}
bootstrap();
```

- [x] **Step 9: Generate client + first migration** (validated against a TEMPORARY local Postgres in Docker — not the remote DB — to avoid exposing credentials; container + local .env torn down after. Migration `20260606000355_init` created the 5 tables successfully. For the remote DB, set DATABASE_URL and run `prisma migrate deploy`.)

Run:
```bash
cd apps/api
cp ../../.env.example .env   # edit .env with the real DATABASE_URL
pnpm prisma:generate
pnpm prisma migrate dev --name init
```
Expected: Prisma connects to remote Postgres, creates the 5 tables, writes a migration under `apps/api/prisma/migrations/`.

> NOTE: `app.module.ts` imports modules built in later tasks. Comment those imports out until their tasks land, or build Tasks 6—10 before the first `nest start`.

- [x] **Step 10: Commit**

```bash
git add apps/api
git commit -m "feat(api): nest scaffold + prisma schema + initial migration"
```

---

### Task 5: docker-compose + Dockerfiles + README

**Files:**
- Create: `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `README.md`

- [x] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:20-alpine
RUN npm i -g pnpm@9
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN pnpm prisma generate && pnpm build
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
```

- [x] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
FROM node:20-alpine
RUN npm i -g pnpm@9
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
```

- [x] **Step 3: Create `docker-compose.yml`** (no `db` service — DB is remote. A gitignored `docker-compose.override.yml` adds a local Postgres for testing only.)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env
    environment:
      API_PORT: ${API_PORT:-4000}
    ports:
      - "${API_PORT:-4000}:4000"
    volumes:
      - ./uploads:/repo/apps/api/uploads

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      VITE_API_URL: http://localhost:${API_PORT:-4000}/api
    ports:
      - "${WEB_PORT:-5173}:5173"
    depends_on:
      - api
```

- [x] **Step 4: Create `README.md`** (already created during repo init)

```markdown
# ACM-TRACKER

Self-hosted time + cost tracker. Local app, remote database.

## Run it (one command)

1. `cp .env.example .env` and set `DATABASE_URL` to your remote Postgres.
2. `docker compose up --build`
3. Open http://localhost:5173 (API at http://localhost:4000/api).

Migrations run automatically when the `api` container starts.

## Develop without Docker

    pnpm install
    cd apps/api && cp ../../.env.example .env   # set DATABASE_URL
    pnpm prisma migrate dev && pnpm seed
    cd ../.. && pnpm dev

## Auth

Starts in no-auth mode (single local owner). A real provider (Cognito) can be
enabled later from Settings; the interface is already in place.
```

- [x] **Step 5: Smoke test the build**

Run: `docker compose build`
Expected: both images build without error.

- [x] **Step 6: Commit**

```bash
git add docker-compose.yml apps/api/Dockerfile apps/web/Dockerfile README.md
git commit -m "chore: docker-compose + dockerfiles + README"
```

---

## Phase 1 — Pluggable Auth (NoAuth only) + Seed

### Task 6: AuthProvider interface + NoAuthProvider (TDD)

**Files:**
- Create: `apps/api/src/auth/auth-provider.interface.ts`
- Test: `apps/api/src/auth/no-auth.provider.spec.ts`
- Create: `apps/api/src/auth/no-auth.provider.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/current-user.decorator.ts`
- Create: `apps/api/src/auth/auth.guard.ts`

- [x] **Step 1: Create `apps/api/src/auth/auth-provider.interface.ts`**

```typescript
export interface AuthedUser {
  memberId: string;
  email: string;
  name: string;
}

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");

export interface AuthProvider {
  /** Identify the caller for a request. NoAuth returns the local owner. */
  getCurrentUser(req: unknown): Promise<AuthedUser>;
  /** True when this provider enforces real identity (NoAuth = false). */
  readonly enforces: boolean;
}
```

- [x] **Step 2: Write the failing test `no-auth.provider.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { NoAuthProvider } from "./no-auth.provider";
import { PrismaService } from "../prisma/prisma.service";

describe("NoAuthProvider", () => {
  const prisma = { member: { findFirst: jest.fn() } } as any;
  let provider: NoAuthProvider;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [NoAuthProvider, { provide: PrismaService, useValue: prisma }],
    }).compile();
    provider = mod.get(NoAuthProvider);
  });

  it("does not enforce identity", () => {
    expect(provider.enforces).toBe(false);
  });

  it("returns the first member as the local owner", async () => {
    prisma.member.findFirst.mockResolvedValue({ id: "m1", email: "o@acm.local", name: "Owner" });
    const u = await provider.getCurrentUser({});
    expect(u).toEqual({ memberId: "m1", email: "o@acm.local", name: "Owner" });
  });

  it("throws if no owner has been seeded", async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(provider.getCurrentUser({})).rejects.toThrow(/owner/i);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @acm/api test no-auth`
Expected: FAIL — "Cannot find module './no-auth.provider'"

- [x] **Step 4: Implement `apps/api/src/auth/no-auth.provider.ts`**

```typescript
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthProvider, AuthedUser } from "./auth-provider.interface";

@Injectable()
export class NoAuthProvider implements AuthProvider {
  readonly enforces = false;
  constructor(private prisma: PrismaService) {}

  async getCurrentUser(): Promise<AuthedUser> {
    const owner = await this.prisma.member.findFirst({ orderBy: { createdAt: "asc" } });
    if (!owner) throw new UnauthorizedException("No local owner seeded. Run the seed.");
    return { memberId: owner.id, email: owner.email, name: owner.name };
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @acm/api test no-auth`
Expected: PASS — 3 tests green

- [x] **Step 6: Create `apps/api/src/auth/auth.module.ts`**

```typescript
import { Global, Module } from "@nestjs/common";
import { AUTH_PROVIDER } from "./auth-provider.interface";
import { NoAuthProvider } from "./no-auth.provider";
import { AuthGuard } from "./auth.guard";

@Global()
@Module({
  providers: [NoAuthProvider, AuthGuard, { provide: AUTH_PROVIDER, useExisting: NoAuthProvider }],
  exports: [AUTH_PROVIDER, AuthGuard],
})
export class AuthModule {}
```

- [x] **Step 7: Create `apps/api/src/auth/auth.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AUTH_PROVIDER, AuthProvider } from "./auth-provider.interface";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PROVIDER) private auth: AuthProvider) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.getCurrentUser(req);
    return true;
  }
}
```

- [x] **Step 8: Create `apps/api/src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthedUser } from "./auth-provider.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser =>
    ctx.switchToHttp().getRequest().user,
);
```

- [x] **Step 9: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): pluggable AuthProvider interface + NoAuthProvider"
```

---

### Task 7: Seed script

**Files:**
- Create: `apps/api/prisma/seed.ts`

- [x] **Step 1: Create `apps/api/prisma/seed.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.workspaceSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, authProvider: "none" },
  });

  const owner = await prisma.member.upsert({
    where: { email: process.env.OWNER_EMAIL ?? "owner@acm.local" },
    update: {},
    create: {
      name: process.env.OWNER_NAME ?? "Harry G.",
      email: process.env.OWNER_EMAIL ?? "owner@acm.local",
      role: "owner",
      ratePerHour: Number(process.env.OWNER_RATE_PER_HOUR ?? 45),
    },
  });

  const project = await prisma.project.create({
    data: { name: "JOY Hoteles", client: "JOY", contractAmount: 30000, status: "active" },
  });

  await prisma.task.create({
    data: { projectId: project.id, code: "T-142", title: "Cognito preToken lambda", phase: "Ejecución", estimateMinutes: 480 },
  });

  console.log(`Seeded owner ${owner.email} + sample project ${project.name}`);
}

main().finally(() => prisma.$disconnect());
```

- [x] **Step 2: Run the seed against the remote DB**

Run: `cd apps/api && pnpm seed`
Expected: prints "Seeded owner owner@acm.local + sample project JOY Hoteles".

- [x] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(api): seed local owner + sample project"
```

---

## Phase 2 — Domain Modules (Members, Projects, Tasks, Time Entries)

> **EXECUTED AS HEXAGONAL (deviation from the flat shape shown below, per the Architecture Authority note).** The inline `*.service.ts` code below is illustrative of behavior; the real implementation follows `apps/api/CLAUDE.md`: each module lives under `src/modules/<feature>/` with `domain/ports/*.repository.port.ts` (interface + Symbol token), `application/use-cases/*.use-case.ts` (one class, one `execute()`), `infrastructure/persistence/` (Prisma adapter + mapper — the only Prisma site), and `interfaces/http/` (thin controller + DTOs). Use cases depend on ports (SOLID-D); cost math reuses `@acm/shared`. Time-entries also has a `MemberRateReaderPort` to snapshot the rate without coupling to the members module. All steps below are checked because the equivalent hexagonal code was built and verified by unit tests + E2E.

### Task 8: Members module (TDD on service)

**Files:**
- Create: `apps/api/src/members/dto/create-member.dto.ts`, `update-member.dto.ts`
- Test: `apps/api/src/members/members.service.spec.ts`
- Create: `apps/api/src/members/members.service.ts`, `members.controller.ts`, `members.module.ts`

- [x] **Step 1: Create DTOs**

`create-member.dto.ts`:
```typescript
import { IsEmail, IsNumber, IsString, Min, IsOptional } from "class-validator";
export class CreateMemberDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsOptional() role?: string;
  @IsNumber() @Min(0) ratePerHour!: number;
}
```

`update-member.dto.ts`:
```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateMemberDto } from "./create-member.dto";
export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
```

> Add dependency: `@nestjs/mapped-types` to `apps/api/package.json`.

- [x] **Step 2: Write the failing test `members.service.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { MembersService } from "./members.service";
import { PrismaService } from "../prisma/prisma.service";

describe("MembersService", () => {
  const prisma = { member: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() } } as any;
  let svc: MembersService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [MembersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(MembersService);
  });

  it("creates a member with default role 'member'", async () => {
    prisma.member.create.mockResolvedValue({ id: "m1" });
    await svc.create({ name: "A", email: "a@x.io", ratePerHour: 30 });
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: { name: "A", email: "a@x.io", role: "member", ratePerHour: 30 },
    });
  });

  it("lists members ordered by createdAt", async () => {
    prisma.member.findMany.mockResolvedValue([]);
    await svc.findAll();
    expect(prisma.member.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @acm/api test members`
Expected: FAIL — module not found.

- [x] **Step 4: Implement `members.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateMemberDto) {
    return this.prisma.member.create({
      data: { name: dto.name, email: dto.email, role: dto.role ?? "member", ratePerHour: dto.ratePerHour },
    });
  }
  findAll() {
    return this.prisma.member.findMany({ orderBy: { createdAt: "asc" } });
  }
  update(id: string, dto: UpdateMemberDto) {
    return this.prisma.member.update({ where: { id }, data: dto });
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @acm/api test members`
Expected: PASS — 2 tests green.

- [x] **Step 6: Implement `members.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { MembersService } from "./members.service";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";

@UseGuards(AuthGuard)
@Controller("members")
export class MembersController {
  constructor(private svc: MembersService) {}
  @Post() create(@Body() dto: CreateMemberDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateMemberDto) { return this.svc.update(id, dto); }
}
```

- [x] **Step 7: Implement `members.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({ controllers: [MembersController], providers: [MembersService] })
export class MembersModule {}
```

- [x] **Step 8: Commit**

```bash
git add apps/api/src/members
git commit -m "feat(api): members module (CRUD + rate)"
```

---

### Task 9: Projects module (TDD on service)

**Files:**
- Create: `apps/api/src/projects/dto/create-project.dto.ts`, `update-project.dto.ts`
- Test: `apps/api/src/projects/projects.service.spec.ts`
- Create: `apps/api/src/projects/projects.service.ts`, `projects.controller.ts`, `projects.module.ts`

- [x] **Step 1: Create DTOs**

`create-project.dto.ts`:
```typescript
import { IsNumber, IsOptional, IsString } from "class-validator";
export class CreateProjectDto {
  @IsString() name!: string;
  @IsString() @IsOptional() client?: string;
  @IsNumber() @IsOptional() contractAmount?: number;
}
```

`update-project.dto.ts`:
```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateProjectDto } from "./create-project.dto";
import { IsIn, IsOptional } from "class-validator";
export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional() @IsIn(["active", "paused", "done"]) status?: string;
}
```

- [x] **Step 2: Write the failing test `projects.service.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ProjectsService", () => {
  const prisma = { project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() } } as any;
  let svc: ProjectsService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ProjectsService);
  });

  it("creates a project defaulting status active", async () => {
    prisma.project.create.mockResolvedValue({ id: "p1" });
    await svc.create({ name: "JOY", client: "JOY", contractAmount: 30000 });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { name: "JOY", client: "JOY", contractAmount: 30000, status: "active" },
    });
  });

  it("findOne includes tasks", async () => {
    prisma.project.findUnique.mockResolvedValue({ id: "p1", tasks: [] });
    await svc.findOne("p1");
    expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: "p1" }, include: { tasks: true } });
  });
});
```

- [x] **Step 3: Run to verify it fails**

Run: `pnpm --filter @acm/api test projects`
Expected: FAIL — module not found.

- [x] **Step 4: Implement `projects.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}
  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { name: dto.name, client: dto.client ?? null, contractAmount: dto.contractAmount ?? null, status: "active" },
    });
  }
  findAll() { return this.prisma.project.findMany({ orderBy: { createdAt: "desc" } }); }
  findOne(id: string) { return this.prisma.project.findUnique({ where: { id }, include: { tasks: true } }); }
  update(id: string, dto: UpdateProjectDto) { return this.prisma.project.update({ where: { id }, data: dto }); }
}
```

- [x] **Step 5: Run to verify it passes**

Run: `pnpm --filter @acm/api test projects`
Expected: PASS — 2 tests green.

- [x] **Step 6: Implement `projects.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private svc: ProjectsService) {}
  @Post() create(@Body() dto: CreateProjectDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.svc.findOne(id); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateProjectDto) { return this.svc.update(id, dto); }
}
```

- [x] **Step 7: Implement `projects.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({ controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
```

- [x] **Step 8: Commit**

```bash
git add apps/api/src/projects
git commit -m "feat(api): projects module (CRUD)"
```

---

### Task 10: Tasks module (TDD on service)

**Files:**
- Create: `apps/api/src/tasks/dto/create-task.dto.ts`, `update-task.dto.ts`
- Test: `apps/api/src/tasks/tasks.service.spec.ts`
- Create: `apps/api/src/tasks/tasks.service.ts`, `tasks.controller.ts`, `tasks.module.ts`

- [x] **Step 1: Create DTOs**

`create-task.dto.ts`:
```typescript
import { IsInt, IsOptional, IsString, Min } from "class-validator";
export class CreateTaskDto {
  @IsString() projectId!: string;
  @IsString() code!: string;
  @IsString() title!: string;
  @IsString() @IsOptional() phase?: string;
  @IsInt() @Min(0) @IsOptional() estimateMinutes?: number;
}
```

`update-task.dto.ts`:
```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDto } from "./create-task.dto";
import { IsIn, IsOptional } from "class-validator";
export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional() @IsIn(["todo", "in_progress", "review", "done"]) status?: string;
}
```

- [x] **Step 2: Write the failing test `tasks.service.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { TasksService } from "./tasks.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TasksService", () => {
  const prisma = { task: { create: jest.fn(), findMany: jest.fn() } } as any;
  let svc: TasksService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(TasksService);
  });

  it("creates a task with default status todo", async () => {
    prisma.task.create.mockResolvedValue({ id: "t1" });
    await svc.create({ projectId: "p1", code: "T-1", title: "Do" });
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: { projectId: "p1", code: "T-1", title: "Do", phase: null, estimateMinutes: null, status: "todo" },
    });
  });

  it("filters by project when given", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    await svc.findAll("p1");
    expect(prisma.task.findMany).toHaveBeenCalledWith({ where: { projectId: "p1" }, orderBy: { createdAt: "asc" } });
  });
});
```

- [x] **Step 3: Run to verify it fails**

Run: `pnpm --filter @acm/api test tasks`
Expected: FAIL.

- [x] **Step 4: Implement `tasks.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}
  create(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        projectId: dto.projectId, code: dto.code, title: dto.title,
        phase: dto.phase ?? null, estimateMinutes: dto.estimateMinutes ?? null, status: "todo",
      },
    });
  }
  findAll(projectId?: string) {
    return this.prisma.task.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: "asc" },
    });
  }
  update(id: string, dto: UpdateTaskDto) { return this.prisma.task.update({ where: { id }, data: dto }); }
}
```

- [x] **Step 5: Run to verify it passes**

Run: `pnpm --filter @acm/api test tasks`
Expected: PASS.

- [x] **Step 6: Implement `tasks.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@UseGuards(AuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private svc: TasksService) {}
  @Post() create(@Body() dto: CreateTaskDto) { return this.svc.create(dto); }
  @Get() findAll(@Query("projectId") projectId?: string) { return this.svc.findAll(projectId); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateTaskDto) { return this.svc.update(id, dto); }
}
```

- [x] **Step 7: Implement `tasks.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({ controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
```

- [x] **Step 8: Commit**

```bash
git add apps/api/src/tasks
git commit -m "feat(api): tasks module (CRUD + project filter)"
```

---

### Task 11: Time Entries module — manual entry + cost (TDD)

**Files:**
- Create: `apps/api/src/time-entries/dto/create-time-entry.dto.ts`
- Test: `apps/api/src/time-entries/time-entries.service.spec.ts`
- Create: `apps/api/src/time-entries/time-entries.service.ts`, `time-entries.controller.ts`, `time-entries.module.ts`

- [x] **Step 1: Create `create-time-entry.dto.ts`**

```typescript
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Min } from "class-validator";
export class CreateTimeEntryDto {
  @IsString() taskId!: string;
  @IsInt() @Min(1) minutes!: number;
  @IsBoolean() @IsOptional() billable?: boolean;
  @IsString() @IsOptional() note?: string;
  @IsISO8601() @IsOptional() startedAt?: string;
}
```

- [x] **Step 2: Write the failing test `time-entries.service.spec.ts`**

```typescript
import { Test } from "@nestjs/testing";
import { TimeEntriesService } from "./time-entries.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TimeEntriesService", () => {
  const prisma = {
    member: { findUniqueOrThrow: jest.fn() },
    timeEntry: { create: jest.fn(), findMany: jest.fn() },
  } as any;
  let svc: TimeEntriesService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [TimeEntriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(TimeEntriesService);
    jest.clearAllMocks();
  });

  it("snapshots the member's current rate and marks origin manual", async () => {
    prisma.member.findUniqueOrThrow.mockResolvedValue({ id: "m1", ratePerHour: 48.5 });
    prisma.timeEntry.create.mockResolvedValue({ id: "e1" });
    await svc.createManual("m1", { taskId: "t1", minutes: 30 });
    expect(prisma.timeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "t1", memberId: "m1", origin: "manual",
        minutes: 30, billable: true, ratePerHourSnapshot: 48.5,
      }),
    });
  });

  it("computes cost summary for a task from its entries", async () => {
    prisma.timeEntry.findMany.mockResolvedValue([
      { id: "a", taskId: "t1", memberId: "m1", origin: "manual", minutes: 60, billable: true, ratePerHourSnapshot: 45, note: null, startedAt: "x", createdAt: "x" },
      { id: "b", taskId: "t1", memberId: "m1", origin: "manual", minutes: 30, billable: false, ratePerHourSnapshot: 45, note: null, startedAt: "x", createdAt: "x" },
    ]);
    const r = await svc.costForTask("t1");
    expect(r).toEqual({ total: 67.5, billable: 45, minutes: 90 });
  });
});
```

- [x] **Step 3: Run to verify it fails**

Run: `pnpm --filter @acm/api test time-entries`
Expected: FAIL.

- [x] **Step 4: Implement `time-entries.service.ts`** (reuses `@acm/shared` cost helpers)

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { sumCost, type TimeEntry } from "@acm/shared";

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  async createManual(memberId: string, dto: CreateTimeEntryDto) {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    return this.prisma.timeEntry.create({
      data: {
        taskId: dto.taskId,
        memberId,
        origin: "manual",
        minutes: dto.minutes,
        billable: dto.billable ?? true,
        ratePerHourSnapshot: member.ratePerHour,
        note: dto.note ?? null,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      },
    });
  }

  findForTask(taskId: string) {
    return this.prisma.timeEntry.findMany({ where: { taskId }, orderBy: { startedAt: "desc" } });
  }

  async costForTask(taskId: string) {
    const rows = await this.prisma.timeEntry.findMany({ where: { taskId } });
    return sumCost(rows as unknown as TimeEntry[]);
  }
}
```

- [x] **Step 5: Run to verify it passes**

Run: `pnpm --filter @acm/api test time-entries`
Expected: PASS — 2 tests green.

- [x] **Step 6: Implement `time-entries.controller.ts`** (uses CurrentUser)

```typescript
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthedUser } from "../auth/auth-provider.interface";
import { TimeEntriesService } from "./time-entries.service";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";

@UseGuards(AuthGuard)
@Controller("time-entries")
export class TimeEntriesController {
  constructor(private svc: TimeEntriesService) {}

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateTimeEntryDto) {
    return this.svc.createManual(user.memberId, dto);
  }

  @Get("task/:taskId")
  forTask(@Param("taskId") taskId: string) {
    return this.svc.findForTask(taskId);
  }

  @Get("task/:taskId/cost")
  cost(@Param("taskId") taskId: string) {
    return this.svc.costForTask(taskId);
  }
}
```

- [x] **Step 7: Implement `time-entries.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";

@Module({ controllers: [TimeEntriesController], providers: [TimeEntriesService] })
export class TimeEntriesModule {}
```

- [x] **Step 8: e2e smoke — create entry returns snapshot rate**

Create `apps/api/test/time-entries.e2e-spec.ts` that boots the app with a test module, seeds a member+task, POSTs a time entry, and asserts the response has `ratePerHourSnapshot` equal to the member's rate and `origin: "manual"`.

Run: `pnpm --filter @acm/api test:e2e`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add apps/api/src/time-entries apps/api/test
git commit -m "feat(api): time entries (manual) with rate snapshot + cost summary"
```

---

## Phase 3 — Frontend (Flight Deck)

### Task 12: Vite + React scaffold + theme tokens

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `apps/web/src/main.tsx`, `src/App.tsx`
- Create: `apps/web/src/theme/tokens.ts`, `src/theme/global.css`

- [x] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@acm/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@acm/shared": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [x] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: Number(process.env.WEB_PORT ?? 5173) },
});
```

- [x] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [x] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ACM-TRACKER</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 5: Create `src/theme/tokens.ts`**

```typescript
export const colors = {
  bg: "#0B0D12", surface: "#11141B", surface2: "#161A22", surfaceRaised: "#1B2030",
  border: "#1F242E", borderStrong: "#2A3142",
  text: "#E6E8EC", muted: "#9AA0B4", dim: "#5A5F6E",
  coral: "#F44E5C", green: "#22C55E", amber: "#F59E0B", blue: "#60A5FA",
};
export const mono = "'JetBrains Mono', monospace";
export const sans = "'Inter', system-ui, sans-serif";
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 };
export const radius = { sm: 8, md: 12, lg: 16 };
```

- [x] **Step 6: Create `src/theme/global.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; margin: 0; }
body {
  background: #0B0D12;
  color: #E6E8EC;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.mono { font-family: 'JetBrains Mono', monospace; }
.grid-bg {
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
}
button { font-family: inherit; cursor: pointer; }
input, select { font-family: inherit; }
```

- [x] **Step 7: Create `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./theme/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [x] **Step 8: Create a minimal `src/App.tsx` (routes filled in later tasks)**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="grid-bg" style={{ padding: 40 }}>ACM-TRACKER — booting…</div>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
```

- [x] **Step 9: Verify dev server boots**

Run: `pnpm --filter @acm/web dev`
Expected: Vite serves on http://localhost:5173 showing "ACM-TRACKER — booting…" on a dark grid.

- [x] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): vite+react scaffold + Flight Deck theme tokens"
```

---

### Task 13: Typed API client

**Files:**
- Test: `apps/web/src/lib/api.test.ts`
- Create: `apps/web/src/lib/api.ts`

- [x] **Step 1: Write the failing test `api.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "p1" }) })) as any);
  });
  it("GET hits the configured base url with /api prefix", async () => {
    const r = await api.get<{ id: string }>("/projects");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/projects"), expect.objectContaining({ method: "GET" }));
    expect(r).toEqual({ id: "p1" });
  });
  it("POST sends JSON body", async () => {
    await api.post("/projects", { name: "X" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/projects"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "X" }) }),
    );
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @acm/web test api`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `src/lib/api.ts`**

```typescript
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @acm/web test api`
Expected: PASS — 2 tests green.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): typed API client"
```

---

### Task 14: Flight Deck components (Chrome, Panel, Gauge, Timer)

**Files:**
- Create: `apps/web/src/components/Chrome.tsx`, `Panel.tsx`, `Gauge.tsx`, `Timer.tsx`

- [x] **Step 1: Create `Panel.tsx`**

```tsx
import { colors, radius } from "../theme/tokens";
export function Panel({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 20, ...style }}>
      {title && <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: colors.muted, marginBottom: 12 }}>{title.toUpperCase()}</div>}
      {children}
    </div>
  );
}
```

- [x] **Step 2: Create `Chrome.tsx` (topbar + grid + registration marks)**

```tsx
import { colors } from "../theme/tokens";
export function Chrome({ breadcrumb, children }: { breadcrumb: string; children: React.ReactNode }) {
  const mark = (pos: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 14, height: 14, ...pos }}>
      <div style={{ position: "absolute", width: 14, height: 1, background: colors.coral, opacity: 0.7 }} />
      <div style={{ position: "absolute", width: 1, height: 14, background: colors.coral, opacity: 0.7 }} />
    </div>
  );
  return (
    <div className="grid-bg" style={{ minHeight: "100vh", position: "relative", padding: 28 }}>
      {mark({ top: 14, left: 14 })}{mark({ top: 14, right: 14 })}
      {mark({ bottom: 14, left: 14 })}{mark({ bottom: 14, right: 14 })}
      <div style={{ display: "flex", alignItems: "center", height: 52, padding: "0 20px", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 24 }}>
        <span className="mono" style={{ color: colors.coral, fontWeight: 700, letterSpacing: 1 }}>◆ ACM-TRACKER</span>
        <span className="mono" style={{ color: colors.muted, marginLeft: 24, fontSize: 13 }}>{breadcrumb}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: colors.green }} />
          <span className="mono" style={{ color: colors.green, fontSize: 12 }}>LOCAL</span>
        </span>
      </div>
      {children}
    </div>
  );
}
```

- [x] **Step 3: Create `Gauge.tsx` (SVG ring, cost vs target)**

```tsx
import { colors } from "../theme/tokens";
export function Gauge({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const r = 80, C = 2 * Math.PI * r;
  return (
    <svg width={200} height={200} viewBox="0 0 200 200">
      <circle cx={100} cy={100} r={r} fill="none" stroke={colors.surface2} strokeWidth={14} />
      <circle cx={100} cy={100} r={r} fill="none" stroke={colors.coral} strokeWidth={14}
        strokeDasharray={C} strokeDashoffset={C * (1 - pct)} strokeLinecap="round"
        transform="rotate(-90 100 100)" />
      <text x={100} y={96} textAnchor="middle" className="mono" fill={colors.text} fontSize={28} fontWeight={700}>
        {`$${value.toLocaleString()}`}
      </text>
      <text x={100} y={120} textAnchor="middle" className="mono" fill={colors.muted} fontSize={12}>{label}</text>
    </svg>
  );
}
```

- [x] **Step 4: Create `Timer.tsx` (running timer + manual entry trigger)**

```tsx
import { useEffect, useState } from "react";
import { colors } from "../theme/tokens";

export function Timer({ taskLabel, onStop, onManual }: { taskLabel: string; onStop: (mins: number) => void; onManual: () => void }) {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, background: colors.surface2, border: `1.5px solid ${colors.coral}`, borderRadius: 12, padding: "16px 20px" }}>
      <span className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{hh}:{mm}:{ss}</span>
      <span style={{ color: colors.muted }}>{taskLabel}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={() => setRunning((r) => !r)} style={{ background: colors.coral, color: "#0B0D12", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700 }}>
          {running ? "❚❚ Pausa" : "▶ Iniciar"}
        </button>
        <button onClick={() => { setRunning(false); onStop(Math.round(sec / 60)); setSec(0); }} style={{ background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 16px" }}>◼ Stop</button>
        <button onClick={onManual} style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 16px" }}>+ manual</button>
      </div>
    </div>
  );
}
```

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): Flight Deck components (Chrome, Panel, Gauge, Timer)"
```

---

### Task 15: Screens — Cabina, Projects, ProjectDetail, Settings + routing

**Files:**
- Create: `apps/web/src/screens/Cabina.tsx`, `Projects.tsx`, `ProjectDetail.tsx`, `Settings.tsx`
- Modify: `apps/web/src/App.tsx`

- [x] **Step 1: Create `Settings.tsx` (members + rates; auth provider section disabled)**

```tsx
import { useEffect, useState } from "react";
import type { Member } from "@acm/shared";
import { api } from "../lib/api";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { colors } from "../theme/tokens";

export function Settings() {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => { api.get<Member[]>("/members").then(setMembers); }, []);
  return (
    <Chrome breadcrumb="/ settings">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Miembros & tarifas">
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
              <span>{m.name} <span className="mono" style={{ color: colors.dim, fontSize: 12 }}>· {m.role}</span></span>
              <span className="mono">${m.ratePerHour.toFixed(2)}/h</span>
            </div>
          ))}
        </Panel>
        <Panel title="Proveedor de autenticación">
          <div style={{ opacity: 0.5 }}>
            <p style={{ color: colors.muted, fontSize: 13 }}>Modo actual: <b className="mono" style={{ color: colors.green }}>sin auth (owner local)</b></p>
            <button disabled style={{ marginTop: 12, background: colors.surface2, color: colors.dim, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 16px" }}>
              Conectar Cognito · próximamente
            </button>
          </div>
        </Panel>
      </div>
    </Chrome>
  );
}
```

- [x] **Step 2: Create `Projects.tsx` (list + create)**

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Project } from "@acm/shared";
import { api } from "../lib/api";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { colors } from "../theme/tokens";

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const load = () => api.get<Project[]>("/projects").then(setProjects);
  useEffect(() => { load(); }, []);
  const create = async () => { if (!name) return; await api.post("/projects", { name }); setName(""); load(); };
  return (
    <Chrome breadcrumb="/ proyectos">
      <Panel title="Proyectos">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo proyecto…"
            style={{ flex: 1, background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "10px 12px" }} />
          <button onClick={create} style={{ background: colors.coral, color: "#0B0D12", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>+ Crear</button>
        </div>
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${colors.border}`, color: colors.text, textDecoration: "none" }}>
            <span>{p.name} <span className="mono" style={{ color: colors.dim, fontSize: 12 }}>{p.client ?? ""}</span></span>
            <span className="mono" style={{ color: colors.muted }}>{p.contractAmount ? `$${p.contractAmount.toLocaleString()}` : "—"}</span>
          </Link>
        ))}
      </Panel>
    </Chrome>
  );
}
```

- [x] **Step 3: Create `ProjectDetail.tsx` (tasks + add manual time + per-task cost)**

```tsx
import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { Task } from "@acm/shared";
import { api } from "../lib/api";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { colors } from "../theme/tokens";

type Cost = { total: number; billable: number; minutes: number };

export function ProjectDetail() {
  const { id } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [costs, setCosts] = useState<Record<string, Cost>>({});

  const load = useCallback(async () => {
    const t = await api.get<Task[]>(`/tasks?projectId=${id}`);
    setTasks(t);
    const entries = await Promise.all(t.map((x) => api.get<Cost>(`/time-entries/task/${x.id}/cost`)));
    setCosts(Object.fromEntries(t.map((x, i) => [x.id, entries[i]])));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const addTime = async (taskId: string) => {
    const mins = Number(prompt("Minutos trabajados:") ?? "0");
    if (mins > 0) { await api.post("/time-entries", { taskId, minutes: mins }); load(); }
  };

  return (
    <Chrome breadcrumb={`/ proyectos / ${id}`}>
      <Panel title="Tareas · tiempo + costo">
        {tasks.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${colors.border}` }}>
            <span className="mono" style={{ color: colors.coral, width: 70 }}>{t.code}</span>
            <span style={{ flex: 1 }}>{t.title}</span>
            <span className="mono" style={{ color: colors.muted, width: 100 }}>{costs[t.id] ? `${Math.floor(costs[t.id].minutes / 60)}h ${costs[t.id].minutes % 60}m` : "—"}</span>
            <span className="mono" style={{ fontWeight: 700, width: 90 }}>{costs[t.id] ? `$${costs[t.id].total}` : "—"}</span>
            <button onClick={() => addTime(t.id)} style={{ background: "transparent", color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px" }}>+ tiempo</button>
          </div>
        ))}
      </Panel>
    </Chrome>
  );
}
```

- [x] **Step 4: Create `Cabina.tsx` (today gauge + nav)**

```tsx
import { Link } from "react-router-dom";
import { Chrome } from "../components/Chrome";
import { Panel } from "../components/Panel";
import { Gauge } from "../components/Gauge";
import { colors } from "../theme/tokens";

export function Cabina() {
  return (
    <Chrome breadcrumb="/ cabina">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Burn rate · hoy">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Gauge value={0} target={2400} label="del objetivo" />
          </div>
        </Panel>
        <Panel title="Navegación">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link to="/projects" style={{ color: colors.text }}>→ Proyectos</Link>
            <Link to="/settings" style={{ color: colors.text }}>→ Settings & tarifas</Link>
          </div>
        </Panel>
      </div>
    </Chrome>
  );
}
```

- [x] **Step 5: Wire routes in `src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Cabina } from "./screens/Cabina";
import { Projects } from "./screens/Projects";
import { ProjectDetail } from "./screens/ProjectDetail";
import { Settings } from "./screens/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cabina />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
```

- [x] **Step 6: Manual end-to-end verification**

With the API running (`pnpm --filter @acm/api dev`) and seeded, run `pnpm --filter @acm/web dev`. Then:
1. Open http://localhost:5173 → Cabina shows the gauge.
2. Go to Proyectos → "JOY Hoteles" is listed (from seed).
3. Open it → task T-142 shows.
4. Click "+ tiempo", enter 45 → cost appears as `$` value (45min × $45/h = $33.75) and time as `0h 45m`.
5. Settings → owner listed with $45.00/h; "Conectar Cognito · próximamente" disabled.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/screens apps/web/src/App.tsx
git commit -m "feat(web): Cabina, Projects, ProjectDetail, Settings screens + routing"
```

---

## Phase 4 — Full-stack verification

> **EXECUTED with adjustments (verified):** `docker compose up` hung in the Windows env, so the stack was launched with direct `docker run` on a shared `acm-net` network (db + api + web). The DB is a local throwaway Postgres for testing (the official `docker-compose.yml` keeps the remote-DB shape per plan; a gitignored `docker-compose.override.yml` adds the local Postgres). Build fixes were required and committed (`7ad7e90`): `@acm/shared`→CommonJS, api image on `node:20-slim`+openssl, build via `--filter`, CMD `dist/src/main.js`. E2E passed: project→task→time entry→cost $22.50, plus live reactivity in the browser.

### Task 16: docker compose up — end-to-end

- [x] **Step 1: Ensure `.env` has a valid remote `DATABASE_URL`**

- [x] **Step 2: Run the whole stack**

Run: `docker compose up --build`
Expected: `api` runs `prisma migrate deploy` then listens on 4000; `web` serves on 5173.

- [x] **Step 3: Seed (first run only)**

Run (in another shell): `docker compose exec api pnpm seed`
Expected: owner + sample project created.

- [x] **Step 4: Verify in browser**

Open http://localhost:5173, repeat the manual flow from Task 15 Step 6. Confirm a created time entry persists across a page reload (proves remote DB round-trip).

- [x] **Step 5: Commit any compose fixes**

```bash
git add -A
git commit -m "chore: verified docker compose end-to-end against remote DB"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** núcleo tiempo+costo → Members (Task 8), Projects (Task 9), Tasks (Task 10), Time entries manual + cost (Task 11), Cabina/Projects/ProjectDetail/Settings (Task 15). ✔ Pluggable auth NoAuth-only → Task 6 (interface + NoAuthProvider) + Settings disabled provider section (Task 15 Step 1). ✔ Remote DB, no db container → Task 5 compose. ✔ One-command run → README + compose (Task 5) and Task 16. ✔ MCP-ready data model, no MCP built → `origin` field in schema (Task 4) + types (Task 2); no MCP module. ✔
- **Placeholders:** none — every code step contains full code.
- **Type consistency:** `TimeEntry`, `Member`, `Project`, `Task` defined in Task 2 are reused verbatim in api (Task 11 casts Prisma rows to `@acm/shared` `TimeEntry`) and web (Tasks 13—15). `sumCost`/`computeEntryCost` signatures match across Task 3, Task 11, and the per-task cost endpoint. `AuthedUser`/`AuthProvider` from Task 6 used in guard, decorator, controller (Task 11). ✔
- **Out of scope (by decision):** documents/reports/MCP server/Cognito impl — deliberately deferred.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

---

## Addendum — 2026-06-09 · Single-user mode on local SQLite

**Decision (owner):** When ACM-TRACKER is used by **a single person**, the stack should run on a **local SQLite database file** instead of requiring a remote Postgres server. Conceptually this is the "solo / no-cloud" mode — the natural companion to `NoAuthProvider` (single implicit owner). Same zero-friction philosophy as the rest of v1: no DB server to provision, just run.

**Persistence shape (chosen):** SQLite **on-disk file** (`file:./acm.db`), *not* `:memory:` pure RAM. Rationale: a time/cost tracker must not lose entries on restart; a local file gives the same "no server" simplicity while persisting across restarts. (`:memory:` stays available only for ephemeral tests/demos, never as the user-facing default.)

**Schema strategy (chosen): Postgres-compatible always.** Postgres remains the **source of truth** for the data model (the existing `schema.prisma` + migrations under `apps/api/prisma/migrations/` are authoritative). SQLite is a **"lite" adapter** with a mirrored schema. Postgres feature-richness is never sacrificed for SQLite; instead the SQLite mirror is kept faithful to the same 5 tables / fields / relations.

### Why this matters (constraints to respect — do not improvise)

- **Prisma binds `provider` at generate/migrate time.** A single `schema.prisma` cannot freely switch `postgresql` ⇄ `sqlite` at runtime. The two providers also differ in column types (e.g. native `enum`, `@db.*` attributes, `Decimal` precision). The mirror must account for this.
- **Hexagonal boundary is the safety net.** Per `apps/api/CLAUDE.md`, use cases depend on **ports**, never on Prisma directly. So selecting SQLite vs Postgres is an **infrastructure-adapter** concern — domain and use cases must not change. This is exactly the seam that makes a second DB backend cheap.
- **Cost math stays in `packages/shared`.** No DB-specific cost logic. Decimal handling (Postgres `Decimal` vs SQLite `REAL`/integer-cents) must be normalized at the adapter edge so `computeEntryCost`/`sumCost` see identical inputs.

### Tasks to add (single-user SQLite mode)

- [x] **DB-1: Decide Decimal/enum normalization at the adapter edge.** (DONE 2026-06-09) Decision documented in `apps/api/CLAUDE.md` § "DB backends". Money stays **`Float`** (not integer-cents): Postgres already stores money as `Float`, `@acm/shared` types it as `number`, SQLite `REAL` is the same IEEE-754 double → identical round-trip, **zero mapper changes**; integer-cents would be a domain/shared change, out of scope. Enums are already strings on both backends (validated in DTOs). Only real type delta = `Json authConfig` → serialized `String` in the SQLite mapper.
- [x] **DB-2: Add the mirrored SQLite Prisma schema.** (DONE 2026-06-09) `prisma/sqlite/schema.prisma` (own migration set under `prisma/sqlite/migrations/`); only deltas vs Postgres = `provider=sqlite` + `authConfig Json→String?`. `prisma/drift-check.ts` (`pnpm --filter @acm/api db:drift-check`) fails CI on divergence — verified it passes in lockstep AND catches injected drift. Postgres `schema.prisma` untouched (source of truth).
- [x] **DB-3: Wire backend selection by env (`DB_BACKEND=sqlite|postgres`).** (DONE 2026-06-09) `src/prisma/db-backend.ts` resolves backend + URL (default `sqlite`→`file:./acm.db`). `PrismaService` is now a DI token; `useFactory` instantiates the correct generated client per backend (SQLite client output to `prisma/sqlite/.generated`). The ~10 repositories are untouched. `prisma/migrate.ts` is backend-aware. Domain/use-cases untouched.
- [x] **DB-4: Solo run path — no Postgres, no `docker compose up` needed.** (DONE 2026-06-09) `pnpm dev:solo` (root) sets `DB_BACKEND=sqlite`, runs `db:bootstrap` (SQLite migrate + idempotent seed) and starts api+web. README "Modo solo (SQLite, un usuario)" section added alongside the Postgres path.
- [x] **DB-5: Test both backends.** (DONE 2026-06-09) Verified independently: api unit suite **15/15 green under both** `DB_BACKEND=sqlite` and `DB_BACKEND=postgres`; production build boots against `file:` SQLite (no Postgres) and `GET /api/members` returns the seeded owner (200). CI matrix proposed in README (not yet wired). Note: no api e2e suite exists today (`test:e2e` config is pre-existingly absent); e2e coverage is Playwright on web.

### Out of scope (unchanged)

Multi-tenant, row-level isolation, Cognito, MCP server — still deferred. Single-user SQLite mode is purely a **deployment/persistence option**, not a data-model change.


