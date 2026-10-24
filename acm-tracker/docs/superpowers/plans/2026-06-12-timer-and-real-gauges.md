# Timer real + datos reales en gauges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Timer/cronómetro real persistido en backend con dock global fijo, y todos los gauges con "—"/datos falsos de Cabina y Tracker alimentados con datos reales.

**Architecture:** Dos PRs. PR-1: módulo hexagonal `timer` (entidad `TimerSession`, 1 por miembro, auto-stop-y-registra) + TimerDock global fijo en App + labels en sidebar. PR-2: módulo `workspace-settings` (`dailyCostTarget`), `reports/today` extendido (`aiCost`, `weekMinutes`), `reports/margin-summary` nuevo, y cableado de Cabina/Tracker/Settings.

**Tech Stack:** NestJS 10 hexagonal (ports & adapters, Symbol DI), Prisma 5 (Postgres + espejo SQLite en lockstep), React + TanStack Query + Zustand, Playwright E2E, jest unit.

**Spec:** `docs/superpowers/specs/2026-06-12-timer-and-real-gauges-design.md`

**Reglas del repo que aplican a TODAS las tareas:**
- Código en inglés, textos UI via i18n (es.json + en.json, paridad exacta).
- Componentes en `apps/web/src/components/` NO fetchean; hooks de datos en `features/<f>/api`.
- Toda migración se hace en AMBOS schemas (`apps/api/prisma/schema.prisma` y `apps/api/prisma/sqlite/schema.prisma`) y `pnpm --filter @acm/api db:drift-check` debe pasar.
- Cero comentarios en código nuevo. Sin código muerto.
- Postgres local para `migrate dev`: contenedor `acm-db` (`docker start acm-db` si está parado), URL `postgresql://acm:acm@localhost:5432/acm_tracker?schema=public`.

---

# PR-1 · Timer real (rama `feat/timer-and-real-gauges`, ya existe con el spec)

### Task 1: Schema `TimerSession` en ambos backends + migraciones

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/sqlite/schema.prisma`

- [ ] **Step 1: Añadir el modelo a `apps/api/prisma/schema.prisma`**

Añadir al final del archivo:

```prisma
model TimerSession {
  id        String   @id @default(cuid())
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String   @unique
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId    String
  startedAt DateTime @default(now())
}
```

Y las back-relations: en `model Member` añadir la línea `timerSession TimerSession?`; en `model Task` añadir `timerSessions TimerSession[]`.

- [ ] **Step 2: Replicar EXACTAMENTE lo mismo en `apps/api/prisma/sqlite/schema.prisma`**

(Mismo bloque `model TimerSession` + mismas back-relations. El drift-check compara modelos.)

- [ ] **Step 3: Generar migración Postgres**

```powershell
cd apps\api
$env:DB_BACKEND="postgres"; $env:DATABASE_URL="postgresql://acm:acm@localhost:5432/acm_tracker?schema=public"
pnpm exec prisma migrate dev --schema prisma/schema.prisma --name add_timer_session
```

Expected: nueva carpeta `apps/api/prisma/migrations/<ts>_add_timer_session/`.

- [ ] **Step 4: Generar migración SQLite**

```powershell
$env:DB_BACKEND="sqlite"; $env:DATABASE_URL="file:./acm.db"
pnpm exec prisma migrate dev --schema prisma/sqlite/schema.prisma --name add_timer_session
```

- [ ] **Step 5: Verificar drift y tests existentes**

```powershell
cd ..\..
pnpm --filter @acm/api db:drift-check
pnpm --filter @acm/api test
```

Expected: drift OK, tests verdes (20/20).

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): TimerSession model in postgres + sqlite schemas"
```

---

### Task 2: `origin` configurable en la creación de TimeEntry

Hoy `PrismaTimeEntryRepository.create` hardcodea `origin: "manual"`. El timer necesita `origin: "timer"` sin duplicar el repositorio.

**Files:**
- Modify: `apps/api/src/modules/time-entries/domain/ports/time-entry.repository.port.ts`
- Modify: `apps/api/src/modules/time-entries/infrastructure/persistence/prisma-time-entry.repository.ts`

- [ ] **Step 1: Añadir `origin` opcional a `CreateTimeEntryData`** (en el port):

```ts
export interface CreateTimeEntryData {
  taskId: string;
  memberId: string;
  origin?: "manual" | "timer";
  minutes: number;
  billable: boolean;
  ratePerHourSnapshot: number;
  note: string | null;
  startedAt: Date;
}
```

- [ ] **Step 2: Respetarlo en el adaptador** — en `prisma-time-entry.repository.ts` cambiar la línea del create a:

```ts
const row = await this.prisma.timeEntry.create({ data: { ...data, origin: data.origin ?? "manual" } });
```

- [ ] **Step 3: Correr tests y commit**

```powershell
pnpm --filter @acm/api test
```

```bash
git add apps/api/src/modules/time-entries
git commit -m "feat(api): optional origin on time entry creation"
```

---

### Task 3: Puerto `TimerSessionPort` + adaptador Prisma

**Files:**
- Create: `apps/api/src/modules/timer/domain/ports/timer-session.port.ts`
- Create: `apps/api/src/modules/timer/infrastructure/persistence/prisma-timer-session.repository.ts`

- [ ] **Step 1: Crear el puerto**

```ts
export const TIMER_SESSION = Symbol("TIMER_SESSION");

export interface ActiveTimerView {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectName: string;
  ratePerHour: number;
  startedAt: string;
}

export interface TimerSessionPort {
  findActive(memberId: string): Promise<ActiveTimerView | null>;
  create(memberId: string, taskId: string): Promise<void>;
  clear(memberId: string): Promise<void>;
  taskExists(taskId: string): Promise<boolean>;
}
```

- [ ] **Step 2: Crear el adaptador Prisma**

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { ActiveTimerView, TimerSessionPort } from "../../domain/ports/timer-session.port";

@Injectable()
export class PrismaTimerSessionRepository implements TimerSessionPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(memberId: string): Promise<ActiveTimerView | null> {
    const row = await this.prisma.timerSession.findUnique({
      where: { memberId },
      include: { task: { include: { project: true } }, member: true },
    });
    if (!row) return null;
    return {
      taskId: row.taskId,
      taskCode: row.task.code,
      taskTitle: row.task.title,
      projectName: row.task.project.name,
      ratePerHour: row.member.ratePerHour,
      startedAt: row.startedAt.toISOString(),
    };
  }

  async create(memberId: string, taskId: string): Promise<void> {
    await this.prisma.timerSession.create({ data: { memberId, taskId } });
  }

  async clear(memberId: string): Promise<void> {
    await this.prisma.timerSession.deleteMany({ where: { memberId } });
  }

  async taskExists(taskId: string): Promise<boolean> {
    const row = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    return Boolean(row);
  }
}
```

- [ ] **Step 3: Build y commit**

```powershell
pnpm --filter @acm/api build
```

```bash
git add apps/api/src/modules/timer
git commit -m "feat(api): timer session port + prisma adapter"
```

---

### Task 4: Use cases del timer (TDD)

**Files:**
- Create: `apps/api/src/modules/timer/application/use-cases/stop-timer.use-case.ts`
- Create: `apps/api/src/modules/timer/application/use-cases/stop-timer.use-case.spec.ts`
- Create: `apps/api/src/modules/timer/application/use-cases/start-timer.use-case.ts`
- Create: `apps/api/src/modules/timer/application/use-cases/start-timer.use-case.spec.ts`
- Create: `apps/api/src/modules/timer/application/use-cases/get-active-timer.use-case.ts`

- [ ] **Step 1: Escribir el spec de StopTimer (falla primero)**

`stop-timer.use-case.spec.ts`:

```ts
import { NotFoundException } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import { StopTimerUseCase } from "./stop-timer.use-case";
import { ActiveTimerView, TimerSessionPort } from "../../domain/ports/timer-session.port";
import {
  CreateTimeEntryData,
  TimeEntryRepositoryPort,
} from "../../../time-entries/domain/ports/time-entry.repository.port";
import { MemberRateReaderPort } from "../../../time-entries/domain/ports/member-rate.port";

class FakeSessions implements TimerSessionPort {
  public active: ActiveTimerView | null = null;
  public cleared = false;
  async findActive(): Promise<ActiveTimerView | null> { return this.active; }
  async create(_memberId: string, taskId: string): Promise<void> {
    this.active = { taskId, taskCode: "T-1", taskTitle: "t", projectName: "p", ratePerHour: 45, startedAt: new Date().toISOString() };
  }
  async clear(): Promise<void> { this.active = null; this.cleared = true; }
  async taskExists(): Promise<boolean> { return true; }
}

class FakeEntries implements TimeEntryRepositoryPort {
  public lastCreate?: CreateTimeEntryData;
  async create(data: CreateTimeEntryData): Promise<TimeEntry> {
    this.lastCreate = data;
    return {
      id: "e1", origin: data.origin ?? "manual", createdAt: "now",
      taskId: data.taskId, memberId: data.memberId, minutes: data.minutes,
      billable: data.billable, ratePerHourSnapshot: data.ratePerHourSnapshot,
      note: data.note, startedAt: data.startedAt.toISOString(),
    };
  }
  async findByTask() { return []; }
  async findByProject() { return []; }
  async findToday() { return []; }
}

class FakeRates implements MemberRateReaderPort {
  async getRatePerHour(): Promise<number> { return 48.5; }
}

function activeStartedAgo(ms: number): ActiveTimerView {
  return {
    taskId: "t1", taskCode: "T-1", taskTitle: "Task", projectName: "Helios",
    ratePerHour: 45, startedAt: new Date(Date.now() - ms).toISOString(),
  };
}

describe("StopTimerUseCase", () => {
  it("logs a timer entry with elapsed minutes and clears the session", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(125_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries, new FakeRates());
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(2);
    expect(entries.lastCreate?.origin).toBe("timer");
    expect(entries.lastCreate?.ratePerHourSnapshot).toBe(48.5);
    expect(entries.lastCreate?.billable).toBe(true);
    expect(sessions.cleared).toBe(true);
  });

  it("logs at least 1 minute on an immediate stop", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(2_000);
    const entries = new FakeEntries();
    const useCase = new StopTimerUseCase(sessions, entries, new FakeRates());
    await useCase.execute("m1");
    expect(entries.lastCreate?.minutes).toBe(1);
  });

  it("throws NotFound when no timer is running", async () => {
    const useCase = new StopTimerUseCase(new FakeSessions(), new FakeEntries(), new FakeRates());
    await expect(useCase.execute("m1")).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```powershell
pnpm --filter @acm/api test -- stop-timer
```

Expected: FAIL ("Cannot find module './stop-timer.use-case'").

- [ ] **Step 3: Implementar `StopTimerUseCase`**

```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import { TIMER_SESSION, TimerSessionPort } from "../../domain/ports/timer-session.port";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../../time-entries/domain/ports/time-entry.repository.port";
import {
  MEMBER_RATE_READER,
  MemberRateReaderPort,
} from "../../../time-entries/domain/ports/member-rate.port";

@Injectable()
export class StopTimerUseCase {
  constructor(
    @Inject(TIMER_SESSION) private readonly sessions: TimerSessionPort,
    @Inject(TIME_ENTRY_REPOSITORY) private readonly entries: TimeEntryRepositoryPort,
    @Inject(MEMBER_RATE_READER) private readonly rates: MemberRateReaderPort,
  ) {}

  async execute(memberId: string): Promise<TimeEntry> {
    const active = await this.sessions.findActive(memberId);
    if (!active) throw new NotFoundException("No active timer");
    const startedAt = new Date(active.startedAt);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60_000));
    const ratePerHourSnapshot = await this.rates.getRatePerHour(memberId);
    const entry = await this.entries.create({
      taskId: active.taskId,
      memberId,
      origin: "timer",
      minutes,
      billable: true,
      ratePerHourSnapshot,
      note: null,
      startedAt,
    });
    await this.sessions.clear(memberId);
    return entry;
  }
}
```

- [ ] **Step 4: Verificar que pasa**

```powershell
pnpm --filter @acm/api test -- stop-timer
```

Expected: PASS (3 tests).

- [ ] **Step 5: Spec de StartTimer (falla primero)**

`start-timer.use-case.spec.ts` (reusa los fakes copiándolos — los specs del repo definen sus fakes en el propio archivo):

```ts
import { NotFoundException } from "@nestjs/common";
import { StartTimerUseCase } from "./start-timer.use-case";
import { StopTimerUseCase } from "./stop-timer.use-case";
// ... (mismos FakeSessions/FakeEntries/FakeRates/activeStartedAgo del spec de stop)

describe("StartTimerUseCase", () => {
  it("creates a session when none is active", async () => {
    const sessions = new FakeSessions();
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries, new FakeRates()));
    const view = await useCase.execute("m1", "task-9");
    expect(view.taskId).toBe("task-9");
    expect(entries.lastCreate).toBeUndefined();
  });

  it("auto-stops and logs the previous timer before starting a new one", async () => {
    const sessions = new FakeSessions();
    sessions.active = activeStartedAgo(300_000);
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries, new FakeRates()));
    const view = await useCase.execute("m1", "task-9");
    expect(entries.lastCreate?.taskId).toBe("t1");
    expect(entries.lastCreate?.origin).toBe("timer");
    expect(view.taskId).toBe("task-9");
  });

  it("throws NotFound for an unknown task", async () => {
    const sessions = new FakeSessions();
    sessions.taskKnown = false;
    const entries = new FakeEntries();
    const useCase = new StartTimerUseCase(sessions, new StopTimerUseCase(sessions, entries, new FakeRates()));
    await expect(useCase.execute("m1", "nope")).rejects.toThrow(NotFoundException);
  });
});
```

(Para el tercer test, `FakeSessions` gana el campo `public taskKnown = true;` y `taskExists()` devuelve `this.taskKnown`.)

- [ ] **Step 6: Correr y verificar que falla; implementar `StartTimerUseCase`**

```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ActiveTimerView, TIMER_SESSION, TimerSessionPort } from "../../domain/ports/timer-session.port";
import { StopTimerUseCase } from "./stop-timer.use-case";

@Injectable()
export class StartTimerUseCase {
  constructor(
    @Inject(TIMER_SESSION) private readonly sessions: TimerSessionPort,
    private readonly stopTimer: StopTimerUseCase,
  ) {}

  async execute(memberId: string, taskId: string): Promise<ActiveTimerView> {
    if (!(await this.sessions.taskExists(taskId))) throw new NotFoundException("Task not found");
    const active = await this.sessions.findActive(memberId);
    if (active) await this.stopTimer.execute(memberId);
    await this.sessions.create(memberId, taskId);
    const created = await this.sessions.findActive(memberId);
    if (!created) throw new NotFoundException("Timer session not created");
    return created;
  }
}
```

- [ ] **Step 7: Implementar `GetActiveTimerUseCase`** (sin spec propio — passthrough):

```ts
import { Inject, Injectable } from "@nestjs/common";
import { ActiveTimerView, TIMER_SESSION, TimerSessionPort } from "../../domain/ports/timer-session.port";

@Injectable()
export class GetActiveTimerUseCase {
  constructor(@Inject(TIMER_SESSION) private readonly sessions: TimerSessionPort) {}

  execute(memberId: string): Promise<ActiveTimerView | null> {
    return this.sessions.findActive(memberId);
  }
}
```

- [ ] **Step 8: Suite completa verde + commit**

```powershell
pnpm --filter @acm/api test
```

```bash
git add apps/api/src/modules/timer apps/api/src/modules/time-entries
git commit -m "feat(api): timer start/stop/active use cases with auto-stop"
```

---

### Task 5: Controller + módulo + registro en app

**Files:**
- Create: `apps/api/src/modules/timer/interfaces/http/dto/start-timer.dto.ts`
- Create: `apps/api/src/modules/timer/interfaces/http/timer.controller.ts`
- Create: `apps/api/src/modules/timer/timer.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTO**

```ts
import { IsString } from "class-validator";

export class StartTimerDto {
  @IsString() taskId!: string;
}
```

- [ ] **Step 2: Controller**

```ts
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CurrentUser } from "../../../../auth/current-user.decorator";
import type { AuthedUser } from "../../../../auth/auth-provider.interface";
import { StartTimerUseCase } from "../../application/use-cases/start-timer.use-case";
import { StopTimerUseCase } from "../../application/use-cases/stop-timer.use-case";
import { GetActiveTimerUseCase } from "../../application/use-cases/get-active-timer.use-case";
import { StartTimerDto } from "./dto/start-timer.dto";

@UseGuards(AuthGuard)
@Controller("timer")
export class TimerController {
  constructor(
    private readonly startTimer: StartTimerUseCase,
    private readonly stopTimer: StopTimerUseCase,
    private readonly getActive: GetActiveTimerUseCase,
  ) {}

  @Post("start") start(@CurrentUser() user: AuthedUser, @Body() dto: StartTimerDto) {
    return this.startTimer.execute(user.memberId, dto.taskId);
  }

  @Post("stop") stop(@CurrentUser() user: AuthedUser) {
    return this.stopTimer.execute(user.memberId);
  }

  @Get("active") active(@CurrentUser() user: AuthedUser) {
    return this.getActive.execute(user.memberId);
  }
}
```

- [ ] **Step 3: Módulo** (bindea también los puertos de time-entries que reusa):

```ts
import { Module } from "@nestjs/common";
import { TIMER_SESSION } from "./domain/ports/timer-session.port";
import { TIME_ENTRY_REPOSITORY } from "../time-entries/domain/ports/time-entry.repository.port";
import { MEMBER_RATE_READER } from "../time-entries/domain/ports/member-rate.port";
import { PrismaTimeEntryRepository } from "../time-entries/infrastructure/persistence/prisma-time-entry.repository";
import { PrismaMemberRateReader } from "../time-entries/infrastructure/persistence/prisma-member-rate.reader";
import { StartTimerUseCase } from "./application/use-cases/start-timer.use-case";
import { StopTimerUseCase } from "./application/use-cases/stop-timer.use-case";
import { GetActiveTimerUseCase } from "./application/use-cases/get-active-timer.use-case";
import { PrismaTimerSessionRepository } from "./infrastructure/persistence/prisma-timer-session.repository";
import { TimerController } from "./interfaces/http/timer.controller";

@Module({
  controllers: [TimerController],
  providers: [
    StartTimerUseCase,
    StopTimerUseCase,
    GetActiveTimerUseCase,
    { provide: TIMER_SESSION, useClass: PrismaTimerSessionRepository },
    { provide: TIME_ENTRY_REPOSITORY, useClass: PrismaTimeEntryRepository },
    { provide: MEMBER_RATE_READER, useClass: PrismaMemberRateReader },
  ],
})
export class TimerModule {}
```

- [ ] **Step 4: Registrar `TimerModule` en `app.module.ts`** (import + lista de imports, junto a los demás módulos).

- [ ] **Step 5: Smoke HTTP** — levantar la api dev (PowerShell, no Bash tool) y verificar:

```powershell
# con la api corriendo (pnpm dev:solo o stack docker):
Invoke-RestMethod http://localhost:4000/api/timer/active   # -> null (o vacío)
```

(Si el stack corre en :5188 desktop, usar ese puerto. Crear una tarea y probar start/stop end-to-end aquí.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): REST timer endpoints (start/stop/active)"
```

---

### Task 6: Frontend — hooks del timer + cronómetro

**Files:**
- Create: `apps/web/src/features/timer/api/use-timer.ts`
- Create: `apps/web/src/features/timer/use-elapsed.ts`
- Create: `apps/web/src/features/timer/use-timer-picker.ts`

- [ ] **Step 1: Hooks de datos** (`use-timer.ts`):

```ts
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface ActiveTimer {
  taskId: string;
  taskCode: string;
  taskTitle: string;
  projectName: string;
  ratePerHour: number;
  startedAt: string;
}

function invalidateTimerQueries(qc: QueryClient) {
  for (const key of ["active-timer", "today-summary", "team-today", "today-entries", "cost-by-person", "weekly-cost", "project-cost", "project-entries", "project-team", "task-cost"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useActiveTimer() {
  return useQuery({
    queryKey: ["active-timer"],
    queryFn: () => apiClient.get<ActiveTimer | null>("/timer/active"),
    refetchInterval: 30_000,
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.post<ActiveTimer>("/timer/start", { taskId }),
    onSuccess: () => invalidateTimerQueries(qc),
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<unknown>("/timer/stop", {}),
    onSuccess: () => invalidateTimerQueries(qc),
  });
}
```

- [ ] **Step 2: Hook del cronómetro** (`use-elapsed.ts`):

```ts
import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export function useElapsed(startedAt: string | null | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "00:00:00";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
```

- [ ] **Step 3: Store del picker** (`use-timer-picker.ts`, mismo patrón que `use-time-entry-modal.ts`):

```ts
import { create } from "zustand";

interface TimerPickerState {
  open: boolean;
  openPicker: () => void;
  close: () => void;
}

export const useTimerPicker = create<TimerPickerState>((set) => ({
  open: false,
  openPicker: () => set({ open: true }),
  close: () => set({ open: false }),
}));
```

- [ ] **Step 4: Build + commit**

```powershell
pnpm --filter @acm/web build
```

```bash
git add apps/web/src/features/timer
git commit -m "feat(web): timer data hooks, elapsed ticker, picker store"
```

---

### Task 7: Frontend — dock global, picker, ▶ en tareas, sidebar con labels

**Files:**
- Modify: `apps/web/src/components/TimerDock/TimerDock.tsx`
- Create: `apps/web/src/features/timer/components/TimerStartModal.tsx`
- Create: `apps/web/src/features/timer/components/GlobalTimerDock.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Chrome/Chrome.tsx`
- Modify: `apps/web/src/screens/Cabina.tsx` (quitar dock propio)
- Modify: `apps/web/src/screens/Tracker.tsx` (quitar dock propio)
- Modify: `apps/web/src/features/tasks/components/TaskRow.tsx`
- Modify: `apps/web/src/i18n/locales/es.json` + `apps/web/src/i18n/locales/en.json`

- [ ] **Step 1: Rework presentacional de `TimerDock`** (sin strings hardcodeados, estados reposo/corriendo, testids):

```tsx
import { colors } from "../../theme/tokens";

export interface TimerDockLabels {
  running: string;
  idle: string;
  stop: string;
  start: string;
  manual: string;
}

interface TimerDockProps {
  running: boolean;
  elapsed: string;
  taskTitle: string;
  meta: string;
  labels: TimerDockLabels;
  onStop: () => void;
  onStart: () => void;
  onManual: () => void;
}

const btn = { border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer" } as const;

export function TimerDock({ running, elapsed, taskTitle, meta, labels, onStop, onStart, onManual }: TimerDockProps) {
  return (
    <div data-testid="timer-dock" style={{ display: "flex", alignItems: "center", gap: 20, background: colors.surface2, border: `1.5px solid ${colors.coral}`, borderRadius: 12, padding: "14px 24px" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: colors.coral, letterSpacing: 1.5 }}>
          {running ? `● ${labels.running}` : `○ ${labels.idle}`}
        </div>
        <div data-testid="timer-elapsed" className="mono" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{elapsed}</div>
      </div>
      <div style={{ marginLeft: 12 }}>
        <div style={{ fontWeight: 600 }}>{taskTitle}</div>
        <div className="mono" style={{ fontSize: 12, color: colors.muted }}>{meta}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        {running ? (
          <button data-testid="timer-stop" onClick={onStop} style={{ ...btn, background: colors.coral, color: colors.bg }}>◼ {labels.stop}</button>
        ) : (
          <button data-testid="timer-start" onClick={onStart} style={{ ...btn, background: colors.coral, color: colors.bg }}>▶ {labels.start}</button>
        )}
        <button onClick={onManual} style={{ ...btn, background: "transparent", color: colors.text, border: `1px solid ${colors.border}` }}>{labels.manual}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `TimerStartModal`** — copia estructural de `TimeEntryModal` SIN minutos/facturable; el botón guarda con `useStartTimer`:

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjects } from "../../projects/api/use-projects";
import { useTasks } from "../../tasks/api/use-tasks";
import { useStartTimer } from "../api/use-timer";
import { useTimerPicker } from "../use-timer-picker";
import { colors } from "../../../theme/tokens";

const field = { width: "100%", background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "10px 12px", marginTop: 6 } as const;
const labelStyle = { fontSize: 11, letterSpacing: 1, color: colors.muted } as const;

export function TimerStartModal() {
  const { t } = useTranslation();
  const { open, close } = useTimerPicker();
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const { data: tasks = [] } = useTasks(projectId);
  const [taskId, setTaskId] = useState("");
  const startTimer = useStartTimer();

  useEffect(() => {
    if (!open) return;
    setProjectId(projects[0]?.id ?? "");
    setTaskId("");
  }, [open, projects]);

  useEffect(() => {
    if (tasks.length > 0 && !tasks.some((tk) => tk.id === taskId)) setTaskId(tasks[0].id);
  }, [tasks, taskId]);

  if (!open) return null;

  const canStart = Boolean(taskId) && !startTimer.isPending;
  const start = () => {
    if (!canStart) return;
    startTimer.mutate(taskId, { onSuccess: () => close() });
  };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 140, zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("timer.pickerAriaLabel")} style={{ width: 480, background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("timer.pickerTitle")}</h3>
        <p className="mono" style={{ fontSize: 11, color: colors.muted, marginBottom: 20 }}>{t("timer.pickerSubtitle")}</p>
        <label style={labelStyle}>{t("tracker.modalProjectLabel")}</label>
        <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }} aria-label={t("tracker.modalProjectAriaLabel")} style={field}>
          {projects.length === 0 && <option value="">{t("tracker.modalNoProjects")}</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>{t("tracker.modalTaskLabel")}</label>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label={t("tracker.modalTaskAriaLabel")} style={field}>
            {tasks.length === 0 && <option value="">{t("tracker.modalNoTasks")}</option>}
            {tasks.map((tk) => <option key={tk.id} value={tk.id}>{tk.code} · {tk.title}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={close} style={{ background: "transparent", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 18px" }}>{t("common.cancel")}</button>
          <button data-testid="timer-picker-start" onClick={start} disabled={!canStart} style={{ background: canStart ? colors.coral : colors.surface2, color: canStart ? colors.bg : colors.dim, border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}>
            ▶ {t("timer.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `GlobalTimerDock`** (smart, fijo abajo, oculto en /auth):

```tsx
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TimerDock } from "../../../components/TimerDock";
import { useActiveTimer, useStopTimer } from "../api/use-timer";
import { useElapsed } from "../use-elapsed";
import { useTimerPicker } from "../use-timer-picker";
import { useTimeEntryModal } from "../../time-entries/use-time-entry-modal";

export function GlobalTimerDock() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { data: active } = useActiveTimer();
  const stopTimer = useStopTimer();
  const openPicker = useTimerPicker((s) => s.openPicker);
  const openManual = useTimeEntryModal((s) => s.openModal);
  const elapsed = useElapsed(active?.startedAt);

  if (pathname === "/auth") return null;

  return (
    <div style={{ position: "fixed", left: 106, right: 28, bottom: 12, zIndex: 50 }}>
      <TimerDock
        running={Boolean(active)}
        elapsed={elapsed}
        taskTitle={active ? `${active.taskCode} · ${active.taskTitle}` : t("cabina.noActiveTask")}
        meta={active ? `${active.projectName} · $${active.ratePerHour.toFixed(2)}/h` : t("cabina.pickProject")}
        labels={{
          running: t("timer.running"),
          idle: t("timer.idle"),
          stop: t("timer.stop"),
          start: t("timer.start"),
          manual: t("cabina.manualEntry"),
        }}
        onStop={() => stopTimer.mutate()}
        onStart={openPicker}
        onManual={() => openManual()}
      />
    </div>
  );
}
```

- [ ] **Step 4: Montarlo en `App.tsx`** junto a los overlays globales existentes:

```tsx
<GlobalCommandPalette />
<TimeEntryModal />
<TimerStartModal />
<Routes>...</Routes>
<GlobalTimerDock />
```

- [ ] **Step 5: `Chrome.tsx`** — (a) `paddingBottom: 110` en el contenedor raíz para que el dock fijo no tape contenido; (b) labels en sidebar: rail a `width: 78`, `paddingLeft` del contenedor `92 → 106`, `Mark` left `78 → 92`, y cada `Link` del NAV pasa a columna ícono+label:

```tsx
<Link key={n.to} to={n.to} title={label} aria-label={label}
  style={{ width: 64, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 10, textDecoration: "none", fontSize: 16, color: active ? colors.coral : colors.muted, background: active ? colors.surface2 : "transparent", borderLeft: active ? `2px solid ${colors.coral}` : "2px solid transparent", padding: "4px 0" }}>
  <span>{n.icon}</span>
  <span className="mono" style={{ fontSize: 8, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
</Link>
```

- [ ] **Step 6: Quitar `<TimerDock …/>` (y su import) de `Cabina.tsx` y `Tracker.tsx`.**

- [ ] **Step 7: ▶ en `TaskRow.tsx`** — añadir junto al botón "+ tiempo":

```tsx
const startTimer = useStartTimer();
// en el JSX, antes del botón addTime:
<button
  data-testid={`start-timer-${task.code}`}
  onClick={() => startTimer.mutate(task.id)}
  disabled={startTimer.isPending}
  title={t("timer.startForTask")}
  aria-label={t("timer.startForTask")}
  style={{ background: "transparent", color: colors.coral, border: `1px solid ${colors.coral}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
>▶</button>
```

(`TaskRow` necesita `useTranslation()` — añadirlo. Import: `useStartTimer` desde `../../timer/api/use-timer`.)

- [ ] **Step 8: i18n** — añadir en `es.json` y `en.json` (namespace `timer` nuevo):

```json
"timer": {
  "running": "EN CURSO",      // en: "RUNNING"
  "idle": "SIN TIMER",        // en: "NO TIMER"
  "stop": "STOP",             // en: "STOP"
  "start": "Iniciar timer",   // en: "Start timer"
  "startForTask": "Iniciar timer para esta tarea",  // en: "Start timer for this task"
  "pickerTitle": "Iniciar timer",                   // en: "Start timer"
  "pickerSubtitle": "elige proyecto y tarea — el tiempo corre hasta que hagas stop",  // en: "pick a project and task — time runs until you stop"
  "pickerAriaLabel": "Iniciar timer"                // en: "Start timer"
}
```

- [ ] **Step 9: Build + verificación visual + commit**

```powershell
pnpm --filter @acm/web build
```

Levantar dev y verificar a ojo (dock visible en /, /tracker, /costs; picker abre; sidebar con labels).

```bash
git add apps/web/src
git commit -m "feat(web): global fixed timer dock, start picker, task play button, sidebar labels"
```

---

### Task 8: E2E del timer + README + PR-1

**Files:**
- Create: `apps/web/e2e/timer.spec.ts`
- Modify: `README.md` (Roadmap → Next: marcar "Real live timer" como ✅)
- Posibles ajustes: specs E2E existentes que cuenten docks o asserten layout del sidebar.

- [ ] **Step 1: Escribir `timer.spec.ts`** (asserts en INGLÉS — default lang). Seguir el idioma de los specs existentes (`projects-time-cost.spec.ts` como referencia de cómo crean datos):

```ts
import { test, expect } from "@playwright/test";

async function createProjectWithTask(page, name: string, code: string) {
  const project = await (await page.request.post("/api/projects", { data: { name } })).json();
  const task = await (await page.request.post("/api/tasks", { data: { projectId: project.id, code, title: `${code} work` } })).json();
  return { project, task };
}

test("timer dock is visible on every screen", async ({ page }) => {
  await page.goto("/costs");
  await expect(page.getByTestId("timer-dock")).toBeVisible();
  await expect(page.getByTestId("timer-dock")).toContainText("NO TIMER");
});

test("start from dock picker, dock runs, stop logs a timer entry", async ({ page }) => {
  await createProjectWithTask(page, "TimerProj", "TM-01");
  await page.goto("/");
  await page.getByTestId("timer-start").click();
  await page.getByRole("dialog").getByLabel(/project/i).selectOption({ label: "TimerProj" });
  await page.getByTestId("timer-picker-start").click();
  await expect(page.getByTestId("timer-dock")).toContainText("RUNNING");
  await expect(page.getByTestId("timer-dock")).toContainText("TM-01");
  await page.getByTestId("timer-stop").click();
  await expect(page.getByTestId("timer-dock")).toContainText("NO TIMER");
  await page.goto("/tracker");
  await expect(page.getByText("TM-01", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("timer", { exact: true }).first()).toBeVisible();
});

test("starting another task auto-stops and logs the previous one", async ({ page }) => {
  const a = await createProjectWithTask(page, "AutoStopProj", "AS-01");
  await page.request.post("/api/tasks", { data: { projectId: a.project.id, code: "AS-02", title: "AS-02 work" } });
  await page.goto(`/projects/${a.project.id}`);
  await page.getByTestId("start-timer-AS-01").click();
  await expect(page.getByTestId("timer-dock")).toContainText("AS-01");
  await page.getByTestId("start-timer-AS-02").click();
  await expect(page.getByTestId("timer-dock")).toContainText("AS-02");
  await page.goto("/tracker");
  await expect(page.getByText("AS-01", { exact: false }).first()).toBeVisible();
  await page.getByTestId("timer-stop").click();
});
```

(Ajustar los selectores del picker a los `aria-label` reales de los selects; los POST de creación deben coincidir con los DTOs reales del repo — verificar contra `projects-time-cost.spec.ts` antes de inventar campos.)

- [ ] **Step 2: Correr la suite E2E completa** con el stack corriendo (api :4000 + `vite preview`/dev :5173):

```powershell
pnpm --filter @acm/web e2e
```

Expected: todos verdes, incluidos los 21 existentes (el dock global y el sidebar nuevo pueden romper asserts viejos — arreglar los specs afectados, no el producto).

- [ ] **Step 3: README** — en Roadmap → Next, cambiar la línea del timer a:

```markdown
- ✅ **Real live timer** — backend `TimerSession` (one per member, auto-stop & log on task switch), global fixed dock on every screen, play button per task.
```

- [ ] **Step 4: Commit + push + PR + CI + merge**

```bash
git add apps/web/e2e README.md
git commit -m "test(e2e): timer flow specs; docs: roadmap"
git push -u origin feat/timer-and-real-gauges
gh pr create --title "feat: real live timer (backend session + global dock)" --body "Implements PR-1 of docs/superpowers/specs/2026-06-12-timer-and-real-gauges-design.md"
gh pr checks --watch
gh pr merge --squash
```

---

# PR-2 · Datos reales en gauges (rama nueva `feat/real-gauges` desde main actualizado)

### Task 9: Rama + schema `dailyCostTarget`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/sqlite/schema.prisma`

- [ ] **Step 1: Rama desde main fresco**

```bash
git checkout main && git pull && git checkout -b feat/real-gauges
```

- [ ] **Step 2: Añadir el campo en AMBOS schemas** — `model WorkspaceSettings` queda:

```prisma
model WorkspaceSettings {
  id              Int     @id @default(1)
  authProvider    String  @default("none")
  authConfig      Json?
  dailyCostTarget Float   @default(2400)
}
```

(En el espejo SQLite `authConfig` es `String?` — mantenerlo así, solo añadir `dailyCostTarget`.)

- [ ] **Step 3: Migraciones en ambos backends + drift** (mismos comandos que Task 1, `--name add_daily_cost_target`), luego:

```powershell
pnpm --filter @acm/api db:drift-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): dailyCostTarget on workspace settings (both schemas)"
```

---

### Task 10: Módulo `workspace-settings` (TDD)

**Files:**
- Create: `apps/api/src/modules/workspace-settings/domain/ports/workspace-settings.port.ts`
- Create: `apps/api/src/modules/workspace-settings/application/use-cases/get-workspace-settings.use-case.ts`
- Create: `apps/api/src/modules/workspace-settings/application/use-cases/update-workspace-settings.use-case.ts`
- Create: `apps/api/src/modules/workspace-settings/application/use-cases/update-workspace-settings.use-case.spec.ts`
- Create: `apps/api/src/modules/workspace-settings/infrastructure/persistence/prisma-workspace-settings.repository.ts`
- Create: `apps/api/src/modules/workspace-settings/interfaces/http/dto/update-workspace-settings.dto.ts`
- Create: `apps/api/src/modules/workspace-settings/interfaces/http/workspace-settings.controller.ts`
- Create: `apps/api/src/modules/workspace-settings/workspace-settings.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Puerto**

```ts
export const WORKSPACE_SETTINGS = Symbol("WORKSPACE_SETTINGS");

export interface WorkspaceSettingsView {
  dailyCostTarget: number;
}

export interface WorkspaceSettingsPort {
  get(): Promise<WorkspaceSettingsView>;
  update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView>;
}
```

- [ ] **Step 2: Spec del update (falla primero)**

```ts
import { UpdateWorkspaceSettingsUseCase } from "./update-workspace-settings.use-case";
import { WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

class FakeSettings implements WorkspaceSettingsPort {
  public value: WorkspaceSettingsView = { dailyCostTarget: 2400 };
  async get(): Promise<WorkspaceSettingsView> { return this.value; }
  async update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    this.value = { dailyCostTarget: patch.dailyCostTarget ?? this.value.dailyCostTarget };
    return this.value;
  }
}

describe("UpdateWorkspaceSettingsUseCase", () => {
  it("updates the daily cost target", async () => {
    const port = new FakeSettings();
    const useCase = new UpdateWorkspaceSettingsUseCase(port);
    const result = await useCase.execute({ dailyCostTarget: 3000 });
    expect(result.dailyCostTarget).toBe(3000);
  });
});
```

Run: `pnpm --filter @acm/api test -- update-workspace-settings` → FAIL.

- [ ] **Step 3: Use cases**

```ts
// get-workspace-settings.use-case.ts
import { Inject, Injectable } from "@nestjs/common";
import { WORKSPACE_SETTINGS, WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class GetWorkspaceSettingsUseCase {
  constructor(@Inject(WORKSPACE_SETTINGS) private readonly settings: WorkspaceSettingsPort) {}
  execute(): Promise<WorkspaceSettingsView> {
    return this.settings.get();
  }
}

// update-workspace-settings.use-case.ts
import { Inject, Injectable } from "@nestjs/common";
import { WORKSPACE_SETTINGS, WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class UpdateWorkspaceSettingsUseCase {
  constructor(@Inject(WORKSPACE_SETTINGS) private readonly settings: WorkspaceSettingsPort) {}
  execute(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    return this.settings.update(patch);
  }
}
```

Run de nuevo → PASS.

- [ ] **Step 4: Adaptador Prisma (upsert fila id=1)**

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { WorkspaceSettingsPort, WorkspaceSettingsView } from "../../domain/ports/workspace-settings.port";

@Injectable()
export class PrismaWorkspaceSettingsRepository implements WorkspaceSettingsPort {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<WorkspaceSettingsView> {
    const row = await this.prisma.workspaceSettings.findUnique({ where: { id: 1 } });
    return { dailyCostTarget: row?.dailyCostTarget ?? 2400 };
  }

  async update(patch: { dailyCostTarget?: number }): Promise<WorkspaceSettingsView> {
    const data = patch.dailyCostTarget !== undefined ? { dailyCostTarget: patch.dailyCostTarget } : {};
    const row = await this.prisma.workspaceSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    return { dailyCostTarget: row.dailyCostTarget };
  }
}
```

- [ ] **Step 5: DTO + controller + módulo + registro en `app.module.ts`**

```ts
// dto
import { IsNumber, IsOptional, Min } from "class-validator";
export class UpdateWorkspaceSettingsDto {
  @IsNumber() @Min(0) @IsOptional() dailyCostTarget?: number;
}

// controller
import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { GetWorkspaceSettingsUseCase } from "../../application/use-cases/get-workspace-settings.use-case";
import { UpdateWorkspaceSettingsUseCase } from "../../application/use-cases/update-workspace-settings.use-case";
import { UpdateWorkspaceSettingsDto } from "./dto/update-workspace-settings.dto";

@UseGuards(AuthGuard)
@Controller("workspace-settings")
export class WorkspaceSettingsController {
  constructor(
    private readonly getSettings: GetWorkspaceSettingsUseCase,
    private readonly updateSettings: UpdateWorkspaceSettingsUseCase,
  ) {}

  @Get() get() {
    return this.getSettings.execute();
  }

  @Patch() update(@Body() dto: UpdateWorkspaceSettingsDto) {
    return this.updateSettings.execute(dto);
  }
}

// module: providers = 2 use cases + { provide: WORKSPACE_SETTINGS, useClass: PrismaWorkspaceSettingsRepository }, controller; registrar en app.module.ts
```

- [ ] **Step 6: Tests + commit**

```powershell
pnpm --filter @acm/api test
```

```bash
git add apps/api/src
git commit -m "feat(api): workspace-settings module with editable dailyCostTarget"
```

---

### Task 11: Reporting — today extendido + margin-summary (TDD)

**Files:**
- Modify: `apps/api/src/modules/reporting/domain/ports/cost-aggregation.port.ts`
- Modify: `apps/api/src/modules/reporting/infrastructure/persistence/prisma-cost-aggregation.repository.ts`
- Modify: `apps/api/src/modules/reporting/application/use-cases/today-summary.use-case.ts` (+ su spec)
- Create: `apps/api/src/modules/reporting/application/use-cases/margin-summary.use-case.ts`
- Create: `apps/api/src/modules/reporting/application/use-cases/margin-summary.use-case.spec.ts`
- Modify: `apps/api/src/modules/reporting/interfaces/http/reporting.controller.ts`
- Modify: `apps/api/src/modules/reporting/reporting.module.ts`

- [ ] **Step 1: Extender el puerto**

En `cost-aggregation.port.ts`:

```ts
export interface TodaySummary {
  trackedMinutes: number;
  billableMinutes: number;
  cost: number;
  aiCost: number;
  weekMinutes: number;
}

export interface MarginSummary {
  revenue: number;
  cost: number;
  margin: number;
  projectCount: number;
}
```

y en `CostAggregationPort`:

```ts
todaySummary(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary>;
marginSummary(): Promise<MarginSummary>;
```

- [ ] **Step 2: Spec de MarginSummary (falla primero)** — `margin-summary.use-case.spec.ts` con fake del puerto que devuelve `{revenue: 800, cost: 450, margin: 350, projectCount: 1}` y asevera passthrough. Actualizar también `today-summary.use-case.spec.ts` al nuevo shape/firma (el fake devuelve `aiCost`/`weekMinutes` y `execute` recibe `weekFrom`).

- [ ] **Step 3: Use cases**

```ts
// margin-summary.use-case.ts
import { Inject, Injectable } from "@nestjs/common";
import { COST_AGGREGATION, CostAggregationPort, MarginSummary } from "../../domain/ports/cost-aggregation.port";

@Injectable()
export class MarginSummaryUseCase {
  constructor(@Inject(COST_AGGREGATION) private readonly agg: CostAggregationPort) {}
  execute(): Promise<MarginSummary> {
    return this.agg.marginSummary();
  }
}

// today-summary.use-case.ts — execute pasa weekFrom:
execute(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary> {
  return this.agg.todaySummary(from, to, weekFrom);
}
```

- [ ] **Step 4: Implementar en el adaptador Prisma**

`todaySummary` reemplaza la versión actual:

```ts
async todaySummary(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary> {
  const rows = await this.prisma.timeEntry.findMany({
    where: { startedAt: { gte: from, lt: to } },
    include: { aiRuns: true },
  });
  let cost = 0;
  let tracked = 0;
  let billable = 0;
  let aiCost = 0;
  for (const r of rows) {
    cost += computeEntryCost(r as unknown as TimeEntry);
    tracked += r.minutes;
    if (r.billable) billable += r.minutes;
    aiCost += r.aiRuns.reduce((s, a) => s + a.costUsd, 0);
  }
  const week = await this.prisma.timeEntry.aggregate({
    _sum: { minutes: true },
    where: { startedAt: { gte: weekFrom, lt: to } },
  });
  return {
    trackedMinutes: tracked,
    billableMinutes: billable,
    cost: round2(cost),
    aiCost: round2(aiCost),
    weekMinutes: week._sum.minutes ?? 0,
  };
}

async marginSummary(): Promise<MarginSummary> {
  const projects = await this.prisma.project.findMany({ where: { ratePerHour: { not: null } } });
  let revenue = 0;
  let cost = 0;
  for (const p of projects) {
    const rows = await this.prisma.timeEntry.findMany({ where: { task: { projectId: p.id } } });
    let minutes = 0;
    for (const r of rows) {
      minutes += r.minutes;
      cost += computeEntryCost(r as unknown as TimeEntry);
    }
    revenue += (minutes / 60) * (p.ratePerHour as number);
  }
  return { revenue: round2(revenue), cost: round2(cost), margin: round2(revenue - cost), projectCount: projects.length };
}
```

- [ ] **Step 5: Controller + módulo**

En `reporting.controller.ts` añadir el cálculo del lunes y las rutas:

```ts
function weekStart(): Date {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
}

@Get("reports/today") today() {
  const { from, to } = dayBounds();
  return this.todaySummary.execute(from, to, weekStart());
}

@Get("reports/margin-summary") marginSummaryRoute() {
  return this.marginSummary.execute();
}
```

(inyectar `MarginSummaryUseCase` en el constructor y registrarlo en `reporting.module.ts`.)

- [ ] **Step 6: Tests + commit**

```powershell
pnpm --filter @acm/api test
```

```bash
git add apps/api/src
git commit -m "feat(api): today summary with aiCost/weekMinutes + global margin summary"
```

---

### Task 12: Web — cablear Cabina, Tracker y Settings

**Files:**
- Modify: `apps/web/src/features/reporting/api/use-today.ts`
- Create: `apps/web/src/features/workspace-settings/api/use-workspace-settings.ts`
- Modify: `apps/web/src/screens/Cabina.tsx`
- Modify: `apps/web/src/screens/Tracker.tsx`
- Modify: `apps/web/src/screens/Settings.tsx`
- Modify: `apps/web/src/features/time-entries/api/use-time-entries.ts` y `apps/web/src/features/timer/api/use-timer.ts` (añadir `"margin-summary"` a las invalidaciones)
- Modify: `apps/web/src/i18n/locales/es.json` + `en.json`

- [ ] **Step 1: Tipos y hooks nuevos**

`use-today.ts` — `TodaySummary` gana `aiCost: number; weekMinutes: number;` y añadir:

```ts
export interface MarginSummary {
  revenue: number;
  cost: number;
  margin: number;
  projectCount: number;
}

export function useMarginSummary() {
  return useQuery({
    queryKey: ["margin-summary"],
    queryFn: () => apiClient.get<MarginSummary>("/reports/margin-summary"),
  });
}
```

`use-workspace-settings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";

export interface WorkspaceSettings {
  dailyCostTarget: number;
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ["workspace-settings"],
    queryFn: () => apiClient.get<WorkspaceSettings>("/workspace-settings"),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<WorkspaceSettings>) => apiClient.patch<WorkspaceSettings>("/workspace-settings", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-settings"] }),
  });
}
```

(Si `apiClient` no tiene `.patch`, añadirlo en `lib/api-client.ts` igual que hizo PR #19 para members — verificar primero, probablemente ya existe.)

- [ ] **Step 2: Cabina real** — reemplazar los valores fijos:

```tsx
const { data: settings } = useWorkspaceSettings();
const { data: marginSummary } = useMarginSummary();
const { data: reports = [] } = useMcpReports();
const humanCost = today?.cost ?? 0;
const aiCost = today?.aiCost ?? 0;
const totalBurn = Math.round((humanCost + aiCost) * 100) / 100;
const target = settings?.dailyCostTarget ?? 2400;
const aiFraction = totalBurn > 0 ? aiCost / totalBurn : 0;
```

- RingGauge: `<RingGauge total={totalBurn} target={target} aiFraction={aiFraction} … />`.
- Caption del panel: `t("cabina.dailyTarget", { target: target.toLocaleString("en-US") })` y los catálogos pasan a `"vs objetivo diario ${{target}}"` / `"vs daily target ${{target}}"`.
- Leyenda IA: `t("cabina.aiMcp", { aiCost })` → `"IA ${{aiCost}} · vía MCP"` / `"AI ${{aiCost}} · via MCP"`.
- Tile Semana: `{ label: t("cabina.week"), value: today ? hm(today.weekMinutes) : "—", sub: t("cabina.ofForty") }`.
- Tile Margen: `{ label: t("cabina.margin"), value: marginSummary ? `$${marginSummary.margin.toLocaleString("en-US")}` : "—", sub: marginSummary ? t("cabina.marginProjects", { count: marginSummary.projectCount }) : "", accent: marginSummary && marginSummary.margin < 0 ? colors.coral : colors.green }`.
- Panel MCP: mapear como `screens/Mcp.tsx` (slice 0..6):

```tsx
<McpStream rows={reports.slice(0, 6).map((r) => ({
  time: r.time,
  who: r.person.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
  task: r.task,
  hours: hm(r.minutes),
  cost: `$${r.cost}`,
  ai: r.aiSummary,
}))} emptyLabel={t("cabina.noReports")} />
```

- [ ] **Step 3: Tracker tile IA real** — `{ label: t("tracker.tileIaLabel"), value: today ? `$${today.aiCost}` : "—", accent: colors.blue }`.

- [ ] **Step 4: Settings → Preferencias** — debajo del toggle de idioma, nuevo Panel presupuesto:

```tsx
{section === "preferences" && (
  <>
    <Panel title={t("settings.language")}>…(existente)…</Panel>
    <Panel title={t("settings.budget")}>
      <EditableRate
        label={t("settings.dailyTarget")}
        value={settings?.dailyCostTarget ?? 2400}
        saving={updateSettings.isPending}
        onSave={(next) => updateSettings.mutate({ dailyCostTarget: next })}
      />
    </Panel>
  </>
)}
```

(con `useWorkspaceSettings()` + `useUpdateWorkspaceSettings()` en el screen.)

- [ ] **Step 5: Invalidaciones** — añadir `"margin-summary"` a la lista de invalidación en `useCreateTimeEntry` y en `invalidateTimerQueries` (use-timer.ts).

- [ ] **Step 6: i18n** — claves nuevas/cambiadas en ambos catálogos: `cabina.dailyTarget` (ahora con `{{target}}`), `cabina.aiMcp` (con `{{aiCost}}`), `cabina.marginProjects` ("{{count}} proyectos" / "{{count}} projects"), `settings.budget` ("Presupuesto" / "Budget"), `settings.dailyTarget` ("Objetivo diario de costo" / "Daily cost target").

- [ ] **Step 7: Build + commit**

```powershell
pnpm --filter @acm/web build
```

```bash
git add apps/web/src
git commit -m "feat(web): real burn target, AI fraction, week & margin tiles, live MCP stream, budget setting"
```

---

### Task 13: E2E gauges + README + PR-2

**Files:**
- Create: `apps/web/e2e/real-gauges.spec.ts`
- Modify: `README.md` (marcar "Margin and budget" ✅)
- Posibles ajustes: specs existentes que asertaban `$0` IA o "—".

- [ ] **Step 1: Spec** (asserts en inglés; crear datos propios vía API como los specs existentes):

```ts
import { test, expect } from "@playwright/test";

test("daily target is editable and the gauge caption reflects it", async ({ page }) => {
  await page.goto("/settings");
  await page.getByText("Preferences", { exact: false }).click();
  // editar EditableRate del objetivo: click en el valor, escribir 3000, Enter
  await page.getByLabel(/daily cost target/i).click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("3000");
  await page.keyboard.press("Enter");
  await page.goto("/");
  await expect(page.getByText(/daily target \$3,000/i)).toBeVisible();
});

test("margin tile shows aggregated margin instead of em dash", async ({ page }) => {
  const project = await (await page.request.post("/api/projects", { data: { name: "MarginProj", ratePerHour: 80 } })).json();
  const task = await (await page.request.post("/api/tasks", { data: { projectId: project.id, code: "MG-01", title: "margin work" } })).json();
  await page.request.post("/api/time-entries", { data: { taskId: task.id, minutes: 60 } });
  await page.goto("/");
  const marginTile = page.getByText("MARGIN", { exact: false }).locator("..");
  await expect(marginTile).not.toContainText("—");
  await expect(marginTile).toContainText("projects");
});

test("cabina MCP stream shows reports after report_work", async ({ page }) => {
  // mismo seed de precio + POST /api/mcp/report-work que usa mcp-report-work.spec.ts
  // luego:
  await page.goto("/");
  await expect(page.getByText("LIVE INGESTION", { exact: false })).toBeVisible();
  await expect(page.getByText(/No reports/)).toHaveCount(0);
});
```

(Selectores del EditableRate: usar el aria `Editar {label}`/`Edit {label}` real del componente — verificarlo antes. El tercer test debe reusar el helper/payload del spec `mcp-report-work.spec.ts` existente.)

- [ ] **Step 2: Suite completa**

```powershell
pnpm --filter @acm/web e2e
```

Expected: todo verde; si algún spec viejo aseveraba `$0`/"—", actualizar el spec.

- [ ] **Step 3: README** — Roadmap → Next:

```markdown
- ✅ **Margin and budget** per project and global — editable daily cost target, real AI fraction in the burn gauge, week tile, global margin tile, live MCP stream on the cockpit.
```

- [ ] **Step 4: Commit + PR-2 + CI + merge**

```bash
git add apps/web/e2e README.md
git commit -m "test(e2e): real gauges specs; docs: roadmap"
git push -u origin feat/real-gauges
gh pr create --title "feat: real data in cockpit gauges (target, AI, week, margin, MCP stream)" --body "Implements PR-2 of docs/superpowers/specs/2026-06-12-timer-and-real-gauges-design.md"
gh pr checks --watch
gh pr merge --squash
```

---

## Verificación final (tras ambos merges)

- [ ] `pnpm --filter @acm/api test` + `pnpm --filter @acm/web e2e` verdes en main.
- [ ] Verificación visual contra el frame `docs/design/08-time-tracker.png`: dock corriendo se parece al diseño (EN CURSO + HH:MM:SS + tarea + STOP).
- [ ] Los 4 "—"/datos falsos de Cabina (target, aiFraction, Semana, Margen) y el `$0` IA del Tracker muestran datos reales.
- [ ] Si el usuario quiere verlo en el ejecutable instalado: regenerar payload + bundle según el flujo validado (pnpm prepare:payload → verificar web-dist → pnpm tauri bundle → instalar → inspeccionar el artefacto INSTALADO).
