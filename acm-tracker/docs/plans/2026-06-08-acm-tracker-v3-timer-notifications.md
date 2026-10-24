# ACM-TRACKER v3 — Live Timer & Real Notification Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make two flagship features real. (A) A live running stopwatch in the TimerDock — start/pause/stop, live-updating display, surviving a page reload — that on STOP creates a real time entry via the existing `useCreateTimeEntry` hook (no new endpoint). (G) Real outbound notification dispatch — today `NotificationRule` is CRUD-only; add an outbound channel port with Slack/Webhook/Email adapters and a RESTful "test send" endpoint so a rule can be fired on demand.

**Architecture:** Same as v1/v2. Backend = hexagonal (ports & adapters, SOLID) in `apps/api`; the new `NotificationChannelPort` is an **outbound** port with one adapter per channel and a dispatch use case that depends only on ports. Frontend = reactive (TanStack Query + Zustand); the running timer is **ephemeral UI state** in a Zustand slice (persisted to localStorage), and STOP reuses the existing `useCreateTimeEntry` mutation so all time/cost queries invalidate reactively. Cost math is never reimplemented — minutes feed the existing entry-create path which already snapshots the rate.

**Tech Stack:** TypeScript, NestJS 10 (Prisma 5, Postgres), React 18 + Vite, TanStack Query, Zustand, Jest (api), Vitest (web/shared).

**Authority:** `CLAUDE.md` (root), `apps/api/CLAUDE.md` (hexagonal ports & adapters), `apps/web/CLAUDE.md` (reactive TanStack Query + Zustand). Use project skills `add-backend-feature` / `add-frontend-feature`; audit with `code-reviewer` before merge. Delegate the Prisma schema change to **db-schema-guardian**. This plan is immutable once written — update only checkbox state during execution.

**Design source:** N/A — extends existing screens (Tracker TimerDock, Notifications) with no new Figma frame. Reuse existing theme tokens and components.

---

## Scope (explicit)

IN — Epic A (Live timer): (1) a Zustand slice holding the active timer (`taskId`, `projectId`, `taskLabel`, `startedAt`, `running`, accumulated paused seconds) persisted to `localStorage` so a running timer survives reload; (2) a live-updating elapsed display wired into the existing `TimerDock`; (3) start/pause/stop controls; (4) on STOP, create a real time entry via the existing `useCreateTimeEntry` hook with rounded minutes, then clear the slice; (5) only one timer at a time (starting a new task replaces the active one); (6) reactive invalidation handled by the existing mutation's `onSuccess` (today, project-entries, project-team, task-cost).

IN — Epic G (Real dispatch): (1) outbound `NotificationChannelPort` (one method: `send(message)`); (2) three adapters — Slack incoming webhook, generic Webhook (POST JSON), Email (provider behind the port; a console/no-op adapter is the default until creds exist); (3) a channel-resolver that maps a rule's channel type to the right adapter (Open/Closed — add channels without editing the dispatch use case); (4) extend `NotificationRule` with channel target config (`channelType` enum + `destination` URL/email) — delegated to **db-schema-guardian**; (5) a `DispatchNotificationUseCase` (TDD with a fake channel port); (6) a RESTful test-send endpoint `POST /notification-rules/:id/test → 202`; (7) frontend "Probar" button on each rule.

OUT (later phases, do NOT build here): real budget-threshold / approval triggers that auto-dispatch (only the test endpoint fires dispatch now — note where the trigger will later call the same use case); real SMTP/Slack credentials wiring beyond env placeholders; delivery history/audit log; retries/queueing; per-user notification preferences; the live timer writing AI usage.

The real trigger (e.g. "budget threshold crossed") will, in a later phase, call `DispatchNotificationUseCase.execute(ruleId, message)` from the reporting/budget flow. This plan keeps the only caller the test endpoint to stay shippable.

---

## File Structure

```
apps/web/src/
├── features/time-entries/
│   ├── store/
│   │   └── use-active-timer.ts          # Zustand slice: active timer + localStorage persist
│   └── components/
│       └── ActiveTimerDock.tsx          # connects the slice to <TimerDock>, ticks live, STOP→createEntry
├── components/TimerDock/TimerDock.tsx    # (reused as-is; presentational, props in)
└── screens/Tracker.tsx                   # MODIFY: render <ActiveTimerDock/> in place of the static <TimerDock/>

apps/api/src/modules/notifications/
├── domain/ports/
│   ├── notification-channel.port.ts      # NOTIFICATION_CHANNEL token + NotificationMessage + port
│   └── notification-rule.repository.port.ts   # MODIFY: add findById + channelType/destination to data
├── application/use-cases/
│   └── dispatch-notification.use-case.ts # resolves rule → builds message → channel.send()
├── infrastructure/channels/
│   ├── notification-channel.resolver.ts  # maps channelType → adapter (Open/Closed)
│   ├── slack-webhook.channel.ts          # POST to Slack incoming webhook
│   ├── http-webhook.channel.ts           # POST JSON to an arbitrary URL
│   └── console-email.channel.ts          # default no-op Email (logs); provider slots in behind port
├── infrastructure/persistence/
│   ├── notification-rule.mapper.ts       # MODIFY: map channelType + destination
│   └── prisma-notification-rule.repository.ts  # MODIFY: findById + persist new fields
├── interfaces/http/
│   ├── notifications.controller.ts       # MODIFY: add POST :id/test → 202
│   └── dto/create-notification-rule.dto.ts     # MODIFY: channelType + destination
└── notifications.module.ts               # MODIFY: bind channels + resolver + dispatch use case

packages/shared/src/
└── types.ts            # MODIFY: NotificationRule gains channelType + destination; add NotificationChannelType

apps/web/src/features/notifications/api/
└── use-notification-rules.ts             # MODIFY: useTestNotificationRule mutation; create dto gains fields
```

**Responsibility boundaries:** the Zustand slice owns timer state only (no server data); `ActiveTimerDock` is the single place that bridges the slice to the existing presentational `TimerDock` and to `useCreateTimeEntry`. On the backend, `DispatchNotificationUseCase` depends only on the rule repo port + the channel port; adapters are the ONLY place `fetch`/SMTP/Slack lives; the resolver isolates channel selection so new channels are new adapters, never edits to the use case.

---

## Prisma schema change

`NotificationRule` gains two columns so a rule knows where to deliver. Delegate to **db-schema-guardian**. Additive only (new nullable-then-defaulted columns) — safe.

```prisma
model NotificationRule {
  id          String   @id @default(cuid())
  event       String
  condition   String
  channel     String
  channelType String   @default("console")   // slack | webhook | email | console
  destination String   @default("")           // webhook URL or email address
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

---

## Phase A — Shared contract (notification channel types)

### Task 1: Shared types for channel target (additive)

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add `NotificationChannelType` and extend `NotificationRule` in `packages/shared/src/types.ts`**

```typescript
export type NotificationChannelType = "slack" | "webhook" | "email" | "console";

export interface NotificationRule {
  id: string;
  event: string;
  condition: string;
  channel: string;
  channelType: NotificationChannelType;
  destination: string;
  enabled: boolean;
  createdAt: string;
}
```

> Replace the existing `NotificationRule` interface in place; only `channelType` and `destination` are new.

- [ ] **Step 2: Build shared to confirm it compiles**

Run: `pnpm --filter @acm/shared build`
Expected: tsc completes, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): NotificationRule channelType + destination (NotificationChannelType)"
```

---

## Phase B — Notification dispatch backend (hexagonal)

### Task 2: NotificationRule schema + migration (channelType + destination)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `channelType` + `destination` to the `NotificationRule` model** (delegate to **db-schema-guardian**)

```prisma
  channelType String   @default("console")
  destination String   @default("")
```

- [ ] **Step 2: Create the migration against a throwaway local Postgres**

Run (temporary DB, then tear down — do NOT touch remote, do NOT add to compose):
```bash
docker run -d --name acm-pg-tmp -e POSTGRES_PASSWORD=temp -e POSTGRES_DB=acm_tracker -p 55433:5432 postgres:16-alpine
cd apps/api && printf 'DATABASE_URL="postgresql://postgres:temp@localhost:55433/acm_tracker?schema=public"\n' > .env
pnpm exec prisma migrate dev --name notification_rule_channel_target
docker exec acm-pg-tmp psql -U postgres -d acm_tracker -c "\d \"NotificationRule\"" | grep channelType
rm -f .env && docker rm -f acm-pg-tmp
```
Expected: migration `*_notification_rule_channel_target` created; `channelType` column listed; temp DB + .env removed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): NotificationRule channelType + destination schema + migration"
```

---

### Task 3: Channel port + rule repository port extension + DTO

**Files:**
- Create: `apps/api/src/modules/notifications/domain/ports/notification-channel.port.ts`
- Modify: `apps/api/src/modules/notifications/domain/ports/notification-rule.repository.port.ts`
- Modify: `apps/api/src/modules/notifications/interfaces/http/dto/create-notification-rule.dto.ts`

- [ ] **Step 1: Create the outbound channel port**

```typescript
export const NOTIFICATION_CHANNEL = Symbol("NOTIFICATION_CHANNEL");

export interface NotificationMessage {
  title: string;
  body: string;
  destination: string;
}

export interface NotificationChannelPort {
  send(message: NotificationMessage): Promise<void>;
}
```

- [ ] **Step 2: Extend the rule repository port with `findById` and the new fields**

```typescript
import type { NotificationChannelType, NotificationRule } from "@acm/shared";

export const NOTIFICATION_RULE_REPOSITORY = Symbol("NOTIFICATION_RULE_REPOSITORY");

export interface CreateNotificationRuleData {
  event: string;
  condition: string;
  channel: string;
  channelType: NotificationChannelType;
  destination: string;
}

export interface NotificationRuleRepositoryPort {
  create(data: CreateNotificationRuleData): Promise<NotificationRule>;
  findAll(): Promise<NotificationRule[]>;
  findById(id: string): Promise<NotificationRule | null>;
  setEnabled(id: string, enabled: boolean): Promise<NotificationRule>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 3: Extend `create-notification-rule.dto.ts`**

```typescript
import { IsIn, IsOptional, IsString } from "class-validator";
import type { NotificationChannelType } from "@acm/shared";

export class CreateNotificationRuleDto {
  @IsString() event!: string;
  @IsString() condition!: string;
  @IsString() channel!: string;
  @IsIn(["slack", "webhook", "email", "console"]) channelType!: NotificationChannelType;
  @IsOptional() @IsString() destination?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notifications/domain apps/api/src/modules/notifications/interfaces/http/dto/create-notification-rule.dto.ts
git commit -m "feat(api): notification channel port + rule repo findById + channel DTO fields"
```

---

### Task 4: Dispatch use case (TDD)

**Files:**
- Test: `apps/api/src/modules/notifications/application/use-cases/dispatch-notification.use-case.spec.ts`
- Create: `apps/api/src/modules/notifications/application/use-cases/dispatch-notification.use-case.ts`

- [ ] **Step 1: Write the failing test (fake rule repo + fake channel port)**

```typescript
import { NotFoundException } from "@nestjs/common";
import { DispatchNotificationUseCase } from "./dispatch-notification.use-case";
import type { NotificationRule } from "@acm/shared";
import {
  CreateNotificationRuleData,
  NotificationRuleRepositoryPort,
} from "../../domain/ports/notification-rule.repository.port";
import { NotificationChannelPort, NotificationMessage } from "../../domain/ports/notification-channel.port";

const rule = (over: Partial<NotificationRule> = {}): NotificationRule => ({
  id: "r1", event: "Tope de presupuesto", condition: "> 90%", channel: "Slack",
  channelType: "webhook", destination: "https://hooks.example/x", enabled: true, createdAt: "now", ...over,
});

class FakeRepo implements NotificationRuleRepositoryPort {
  constructor(private readonly found: NotificationRule | null) {}
  async create(_d: CreateNotificationRuleData): Promise<NotificationRule> { throw new Error("unused"); }
  async findAll(): Promise<NotificationRule[]> { return []; }
  async findById(_id: string): Promise<NotificationRule | null> { return this.found; }
  async setEnabled(_id: string, _e: boolean): Promise<NotificationRule> { throw new Error("unused"); }
  async delete(_id: string): Promise<void> {}
}

class FakeChannel implements NotificationChannelPort {
  public sent?: NotificationMessage;
  async send(message: NotificationMessage): Promise<void> { this.sent = message; }
}

describe("DispatchNotificationUseCase", () => {
  it("sends a message built from the rule to the channel", async () => {
    const channel = new FakeChannel();
    const useCase = new DispatchNotificationUseCase(new FakeRepo(rule()), { resolve: () => channel } as never);
    await useCase.execute("r1");
    expect(channel.sent).toEqual({
      title: "Tope de presupuesto",
      body: "> 90%",
      destination: "https://hooks.example/x",
    });
  });

  it("throws NotFound when the rule does not exist", async () => {
    const useCase = new DispatchNotificationUseCase(new FakeRepo(null), { resolve: () => new FakeChannel() } as never);
    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test dispatch-notification`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the use case**

```typescript
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  NOTIFICATION_RULE_REPOSITORY,
  NotificationRuleRepositoryPort,
} from "../../domain/ports/notification-rule.repository.port";
import { NotificationChannelResolver } from "../../infrastructure/channels/notification-channel.resolver";

@Injectable()
export class DispatchNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_RULE_REPOSITORY) private readonly repo: NotificationRuleRepositoryPort,
    private readonly resolver: NotificationChannelResolver,
  ) {}

  async execute(ruleId: string): Promise<void> {
    const rule = await this.repo.findById(ruleId);
    if (!rule) throw new NotFoundException(`Notification rule ${ruleId} not found`);
    const channel = this.resolver.resolve(rule.channelType);
    await channel.send({ title: rule.event, body: rule.condition, destination: rule.destination });
  }
}
```

> The test injects a stub with a single `resolve()` method; the real `NotificationChannelResolver` (Task 5) honors the same shape. The use case depends on the resolver abstraction, not on any concrete channel.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/api test dispatch-notification`
Expected: PASS — both cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/application/use-cases/dispatch-notification.use-case.ts apps/api/src/modules/notifications/application/use-cases/dispatch-notification.use-case.spec.ts
git commit -m "feat(api): DispatchNotificationUseCase with fake-port test"
```

---

### Task 5: Channel adapters + resolver

**Files:**
- Create: `apps/api/src/modules/notifications/infrastructure/channels/slack-webhook.channel.ts`
- Create: `apps/api/src/modules/notifications/infrastructure/channels/http-webhook.channel.ts`
- Create: `apps/api/src/modules/notifications/infrastructure/channels/console-email.channel.ts`
- Create: `apps/api/src/modules/notifications/infrastructure/channels/notification-channel.resolver.ts`

- [ ] **Step 1: Create the Slack incoming-webhook adapter**

```typescript
import { Injectable } from "@nestjs/common";
import { NotificationChannelPort, NotificationMessage } from "../../domain/ports/notification-channel.port";

@Injectable()
export class SlackWebhookChannel implements NotificationChannelPort {
  async send(message: NotificationMessage): Promise<void> {
    await fetch(message.destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${message.title}*\n${message.body}` }),
    });
  }
}
```

- [ ] **Step 2: Create the generic HTTP-webhook adapter**

```typescript
import { Injectable } from "@nestjs/common";
import { NotificationChannelPort, NotificationMessage } from "../../domain/ports/notification-channel.port";

@Injectable()
export class HttpWebhookChannel implements NotificationChannelPort {
  async send(message: NotificationMessage): Promise<void> {
    await fetch(message.destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: message.title, body: message.body }),
    });
  }
}
```

- [ ] **Step 3: Create the default console Email adapter (provider slots in behind this port)**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannelPort, NotificationMessage } from "../../domain/ports/notification-channel.port";

@Injectable()
export class ConsoleEmailChannel implements NotificationChannelPort {
  private readonly logger = new Logger("EmailChannel");

  async send(message: NotificationMessage): Promise<void> {
    this.logger.log(`EMAIL → ${message.destination}: ${message.title} — ${message.body}`);
  }
}
```

- [ ] **Step 4: Create the resolver (Open/Closed channel selection)**

```typescript
import { Injectable } from "@nestjs/common";
import type { NotificationChannelType } from "@acm/shared";
import { NotificationChannelPort } from "../../domain/ports/notification-channel.port";
import { SlackWebhookChannel } from "./slack-webhook.channel";
import { HttpWebhookChannel } from "./http-webhook.channel";
import { ConsoleEmailChannel } from "./console-email.channel";

@Injectable()
export class NotificationChannelResolver {
  private readonly byType: Record<NotificationChannelType, NotificationChannelPort>;

  constructor(slack: SlackWebhookChannel, webhook: HttpWebhookChannel, email: ConsoleEmailChannel) {
    this.byType = { slack, webhook, email, console: email };
  }

  resolve(type: NotificationChannelType): NotificationChannelPort {
    return this.byType[type] ?? this.byType.console;
  }
}
```

> Adding a channel = a new adapter + one map entry; the dispatch use case never changes (Open/Closed). `console` reuses the email adapter as the safe no-op default until real Email creds exist.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/infrastructure/channels
git commit -m "feat(api): Slack/Webhook/Email channel adapters + resolver"
```

---

### Task 6: Adapter persistence update + controller test endpoint + module wiring

**Files:**
- Modify: `apps/api/src/modules/notifications/infrastructure/persistence/notification-rule.mapper.ts`
- Modify: `apps/api/src/modules/notifications/infrastructure/persistence/prisma-notification-rule.repository.ts`
- Modify: `apps/api/src/modules/notifications/interfaces/http/notifications.controller.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Map the new columns in `notification-rule.mapper.ts`**

```typescript
import type { NotificationRule as PrismaNotificationRule } from "@prisma/client";
import type { NotificationChannelType, NotificationRule } from "@acm/shared";

export function toDomainNotificationRule(row: PrismaNotificationRule): NotificationRule {
  return {
    id: row.id,
    event: row.event,
    condition: row.condition,
    channel: row.channel,
    channelType: row.channelType as NotificationChannelType,
    destination: row.destination,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 2: Add `findById` to the Prisma adapter** (`create` already spreads `data`, so the new fields persist via the extended DTO/port — no change needed there)

```typescript
  async findById(id: string): Promise<NotificationRule | null> {
    const row = await this.prisma.notificationRule.findUnique({ where: { id } });
    return row ? toDomainNotificationRule(row) : null;
  }
```

- [ ] **Step 3: Add the RESTful test-send endpoint to the controller**

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateNotificationRuleUseCase } from "../../application/use-cases/create-notification-rule.use-case";
import { ListNotificationRulesUseCase } from "../../application/use-cases/list-notification-rules.use-case";
import { ToggleNotificationRuleUseCase } from "../../application/use-cases/toggle-notification-rule.use-case";
import { DeleteNotificationRuleUseCase } from "../../application/use-cases/delete-notification-rule.use-case";
import { DispatchNotificationUseCase } from "../../application/use-cases/dispatch-notification.use-case";
import { CreateNotificationRuleDto } from "./dto/create-notification-rule.dto";
import { ToggleNotificationRuleDto } from "./dto/toggle-notification-rule.dto";

@UseGuards(AuthGuard)
@Controller("notification-rules")
export class NotificationsController {
  constructor(
    private readonly createRule: CreateNotificationRuleUseCase,
    private readonly listRules: ListNotificationRulesUseCase,
    private readonly toggleRule: ToggleNotificationRuleUseCase,
    private readonly deleteRule: DeleteNotificationRuleUseCase,
    private readonly dispatch: DispatchNotificationUseCase,
  ) {}

  @Post() create(@Body() dto: CreateNotificationRuleDto) {
    return this.createRule.execute(dto);
  }

  @Get() findAll() {
    return this.listRules.execute();
  }

  @Patch(":id") toggle(@Param("id") id: string, @Body() dto: ToggleNotificationRuleDto) {
    return this.toggleRule.execute(id, dto.enabled);
  }

  @Post(":id/test") @HttpCode(202) test(@Param("id") id: string) {
    return this.dispatch.execute(id);
  }

  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.deleteRule.execute(id);
  }
}
```

- [ ] **Step 4: Wire channels, resolver, and dispatch into `notifications.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { NOTIFICATION_RULE_REPOSITORY } from "./domain/ports/notification-rule.repository.port";
import { CreateNotificationRuleUseCase } from "./application/use-cases/create-notification-rule.use-case";
import { ListNotificationRulesUseCase } from "./application/use-cases/list-notification-rules.use-case";
import { ToggleNotificationRuleUseCase } from "./application/use-cases/toggle-notification-rule.use-case";
import { DeleteNotificationRuleUseCase } from "./application/use-cases/delete-notification-rule.use-case";
import { DispatchNotificationUseCase } from "./application/use-cases/dispatch-notification.use-case";
import { PrismaNotificationRuleRepository } from "./infrastructure/persistence/prisma-notification-rule.repository";
import { SlackWebhookChannel } from "./infrastructure/channels/slack-webhook.channel";
import { HttpWebhookChannel } from "./infrastructure/channels/http-webhook.channel";
import { ConsoleEmailChannel } from "./infrastructure/channels/console-email.channel";
import { NotificationChannelResolver } from "./infrastructure/channels/notification-channel.resolver";
import { NotificationsController } from "./interfaces/http/notifications.controller";

@Module({
  controllers: [NotificationsController],
  providers: [
    CreateNotificationRuleUseCase,
    ListNotificationRulesUseCase,
    ToggleNotificationRuleUseCase,
    DeleteNotificationRuleUseCase,
    DispatchNotificationUseCase,
    SlackWebhookChannel,
    HttpWebhookChannel,
    ConsoleEmailChannel,
    NotificationChannelResolver,
    { provide: NOTIFICATION_RULE_REPOSITORY, useClass: PrismaNotificationRuleRepository },
  ],
})
export class NotificationsModule {}
```

- [ ] **Step 5: Build + test**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Expected: build clean; all tests green (including `dispatch-notification`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notifications
git commit -m "feat(api): notification-rules :id/test endpoint (202) + dispatch wiring"
```

---

## Phase C — Live timer frontend (Zustand + reactive create)

### Task 7: Active-timer Zustand slice (persisted)

**Files:**
- Create: `apps/web/src/features/time-entries/store/use-active-timer.ts`

- [ ] **Step 1: Create the slice with localStorage persistence**

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveTimerState {
  taskId: string | null;
  projectId: string | null;
  taskLabel: string;
  startedAt: number | null;   // epoch ms of the current run segment
  baseSeconds: number;         // seconds accumulated before the current segment
  running: boolean;
  start: (task: { taskId: string; projectId: string; taskLabel: string }) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export const useActiveTimer = create<ActiveTimerState>()(
  persist(
    (set, get) => ({
      taskId: null,
      projectId: null,
      taskLabel: "",
      startedAt: null,
      baseSeconds: 0,
      running: false,
      start: (task) =>
        set({ ...task, startedAt: Date.now(), baseSeconds: 0, running: true }),
      pause: () => {
        const { running, startedAt, baseSeconds } = get();
        if (!running || startedAt === null) return;
        const segment = Math.floor((Date.now() - startedAt) / 1000);
        set({ running: false, startedAt: null, baseSeconds: baseSeconds + segment });
      },
      resume: () => set({ running: true, startedAt: Date.now() }),
      reset: () =>
        set({ taskId: null, projectId: null, taskLabel: "", startedAt: null, baseSeconds: 0, running: false }),
    }),
    { name: "acm-active-timer" },
  ),
);

export function elapsedSeconds(s: Pick<ActiveTimerState, "baseSeconds" | "startedAt" | "running">): number {
  if (s.running && s.startedAt !== null) {
    return s.baseSeconds + Math.floor((Date.now() - s.startedAt) / 1000);
  }
  return s.baseSeconds;
}
```

> Only one timer exists because the slice is a singleton: `start()` overwrites any prior task. Elapsed is derived from `startedAt` + `baseSeconds`, so a running timer survives reload (the persisted `startedAt` keeps counting).

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/time-entries/store/use-active-timer.ts
git commit -m "feat(web): active-timer Zustand slice with localStorage persistence"
```

---

### Task 8: ActiveTimerDock (live tick + STOP→create entry)

**Files:**
- Create: `apps/web/src/features/time-entries/components/ActiveTimerDock.tsx`

- [ ] **Step 1: Create `ActiveTimerDock.tsx`** (bridges slice → presentational `TimerDock` → `useCreateTimeEntry`)

```tsx
import { useEffect, useState } from "react";
import { TimerDock } from "../../../components/TimerDock";
import { useActiveTimer, elapsedSeconds } from "../store/use-active-timer";
import { useTimeEntryModal } from "../use-time-entry-modal";
import { useCreateTimeEntry } from "../api/use-time-entries";

function format(totalSeconds: number): string {
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ActiveTimerDock() {
  const timer = useActiveTimer();
  const openModal = useTimeEntryModal((s) => s.openModal);
  const createEntry = useCreateTimeEntry();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const seconds = elapsedSeconds(timer);

  const stop = () => {
    if (!timer.taskId) return;
    const minutes = Math.max(1, Math.round(seconds / 60));
    createEntry.mutate(
      { taskId: timer.taskId, minutes, billable: true },
      { onSuccess: () => timer.reset() },
    );
  };

  return (
    <TimerDock
      elapsed={format(seconds)}
      taskTitle={timer.taskId ? timer.taskLabel : "Sin tarea activa"}
      meta={timer.running ? "corriendo · STOP guarda la entrada" : timer.taskId ? "en pausa" : "elige una tarea para iniciar"}
      running={timer.running}
      onStop={stop}
      onManual={() => openModal()}
      manualLabel="+ registrar tiempo"
    />
  );
}
```

> Minutes are rounded with a floor of 1 so a brief run still books an entry. The existing `useCreateTimeEntry.onSuccess` already invalidates `task-cost`, `today-summary`, `team-today`, `today-entries`, `project-cost`, `project-entries`, `project-team` — so time/cost views refresh reactively with no extra wiring.

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/time-entries/components/ActiveTimerDock.tsx
git commit -m "feat(web): ActiveTimerDock — live tick, pause/resume, STOP creates a time entry"
```

---

### Task 9: Wire the live timer + a start affordance into Tracker

**Files:**
- Modify: `apps/web/src/screens/Tracker.tsx`

- [ ] **Step 1: Replace the static `<TimerDock>` with `<ActiveTimerDock/>`**

Remove the `import { TimerDock } from "../components/TimerDock";` line and the static `<TimerDock .../>` block at the bottom of the component; import and render the live dock instead:

```tsx
import { ActiveTimerDock } from "../features/time-entries/components/ActiveTimerDock";
// ...at the bottom of the returned JSX, in place of the old <TimerDock .../>:
<ActiveTimerDock />
```

- [ ] **Step 2: Add a "▶ Iniciar timer" affordance per timeline row**

In the `Línea de tiempo` panel, give each row a start button that calls `useActiveTimer().start(...)` with that entry's task. Add at the top of the component:

```tsx
import { useActiveTimer } from "../features/time-entries/store/use-active-timer";
// inside Tracker():
const startTimer = useActiveTimer((s) => s.start);
```

Add a `start` column to the `DataTable` whose cell is a button:

```tsx
start: (
  <button
    onClick={() => startTimer({ taskId: e.taskId, projectId: e.projectId, taskLabel: `${e.taskCode} · ${e.taskTitle}` })}
    aria-label={`Iniciar timer en ${e.taskCode}`}
    style={{ background: "transparent", color: colors.coral, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
  >▶</button>
),
```

> If `today-entries` rows do not expose `taskId`/`projectId`, fall back to opening the timer from the manual modal's task selection in a follow-up; the slice API is unchanged. Confirm the shape of `useTodayEntries()` rows before wiring and use whatever id fields exist.

- [ ] **Step 3: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (tsc + vite).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens/Tracker.tsx
git commit -m "feat(web): live timer in Tracker (ActiveTimerDock + per-row start)"
```

---

## Phase D — Notifications frontend (test send + channel fields)

### Task 10: Test-send hook + channel fields

**Files:**
- Modify: `apps/web/src/features/notifications/api/use-notification-rules.ts`

- [ ] **Step 1: Extend the create dto and add `useTestNotificationRule`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationChannelType, NotificationRule } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useCreateNotificationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      event: string; condition: string; channel: string;
      channelType: NotificationChannelType; destination: string;
    }) => apiClient.post<NotificationRule>("/notification-rules", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-rules"] }),
  });
}

export function useTestNotificationRule() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/notification-rules/${id}/test`, {}),
  });
}
```

> Keep the existing `useNotificationRules`, `useToggleNotificationRule`, `useDeleteNotificationRule` exports unchanged; only the create dto gains `channelType`/`destination` and the new test hook is added.

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/notifications/api/use-notification-rules.ts
git commit -m "feat(web): useTestNotificationRule hook + channelType/destination on create"
```

---

### Task 11: Notifications screen — channel inputs + "Probar" button

**Files:**
- Modify: `apps/web/src/screens/Notifications.tsx`

- [ ] **Step 1: Add `channelType` + `destination` inputs to the rule form**

Add local state and a select + input next to the existing channel select:

```tsx
import type { NotificationChannelType } from "@acm/shared";
// inside the component:
const [channelType, setChannelType] = useState<NotificationChannelType>("console");
const [destination, setDestination] = useState("");
```

Wire them into the create call:

```tsx
createRule.mutate(
  { event: event.trim(), condition: condition.trim() || "—", channel, channelType, destination: destination.trim() },
  { onSuccess: () => { setEvent(""); setCondition(""); setDestination(""); } },
);
```

Add a `channelType` select (`slack | webhook | email | console`) and a `destination` input (placeholder "URL o email") to the form row, styled with the existing `inputStyle`.

- [ ] **Step 2: Add a "Probar" action column to the rules table**

```tsx
import { useTestNotificationRule } from "../features/notifications/api/use-notification-rules";
// inside the component:
const testRule = useTestNotificationRule();
```

Add a column whose cell fires the test send:

```tsx
test: (
  <button
    onClick={() => testRule.mutate(r.id)}
    disabled={testRule.isPending}
    aria-label={`Probar regla ${r.event}`}
    style={{ background: "transparent", color: colors.coral, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
  >Probar</button>
),
```

> Show the rule's `channelType` next to the channel name so the user sees where a test will land. Keep the existing toggle and delete actions.

- [ ] **Step 3: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens/Notifications.tsx
git commit -m "feat(web): Notifications channel target inputs + per-rule Probar (test send)"
```

---

## Phase E — Verification

### Task 12: E2E of timer + dispatch

- [ ] **Step 1: Ensure the stack is running** (db + api + web).

- [ ] **Step 2: Verify the test-send endpoint over HTTP**

```bash
B=http://localhost:4000/api
RULE=$(curl -s -X POST $B/notification-rules -H "Content-Type: application/json" \
  -d '{"event":"Tope de presupuesto","condition":"> 90%","channel":"Email","channelType":"console","destination":"ops@acme.test"}')
ID=$(echo "$RULE" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/notification-rules/$ID/test
```
Expected: `202`; the api log shows `EMAIL → ops@acme.test: Tope de presupuesto — > 90%`.

- [ ] **Step 3: Webhook channel sanity check**

Create a rule with `channelType:"webhook"` and `destination` pointed at a local catcher (e.g. `https://webhook.site/...`); POST `:id/test`; confirm the catcher receives `{title, body}` JSON and the endpoint returns 202.

- [ ] **Step 4: Browser E2E — live timer**

Open http://localhost:5173/tracker → click ▶ on a timeline row; the dock shows `● EN CURSO` and the clock ticks. Reload the page → the timer is still running and the elapsed continued (localStorage). Click STOP → a new entry appears in `Línea de tiempo` and the KPI tiles (Trackeado hoy / Costo hoy) update without a manual reload (query invalidation). Confirm the dock resets to `○ SIN TIMER`.

- [ ] **Step 5: Browser E2E — notifications**

Open http://localhost:5173/settings/notificaciones (or the Notifications route) → create a rule with a channel type + destination; click "Probar"; confirm the request returns 202 (network tab) and, for `console`, the api log line appears.

- [ ] **Step 6: Commit any fixes + mark plan complete**

```bash
git add -A
git commit -m "test: verify live timer (start/pause/reload/stop→entry) + notification test dispatch"
```

---

## Self-Review (completed by plan author)

- **Scope coverage:** Epic A — active-timer Zustand slice with persistence (Task 7) ✔; live tick + pause/resume + STOP→create entry (Task 8) ✔; one-timer-at-a-time via singleton `start()` overwrite (Task 7) ✔; rounded minutes (floor 1) (Task 8) ✔; reactive invalidation via existing `useCreateTimeEntry` (Task 8, reused) ✔; no new backend endpoint (reuses POST /time-entries) ✔; wired into Tracker (Task 9) ✔. Epic G — outbound `NotificationChannelPort` (Task 3) ✔; Slack/Webhook/Email adapters + resolver (Task 5) ✔; schema `channelType`+`destination` via db-schema-guardian (Task 2) ✔; `DispatchNotificationUseCase` TDD with fake port (Task 4) ✔; RESTful `POST /notification-rules/:id/test → 202` (Task 6) ✔; frontend test send + channel inputs (Tasks 10-11) ✔; trigger limited to the test endpoint, with the future budget-trigger call-site noted (Scope) ✔. OUT-of-scope items (real triggers, real creds, audit log, retries) deliberately excluded.
- **Placeholders:** none — every code step has full code; the one conditional note (Task 9 Step 2) is a verify-then-wire instruction against existing data shape, not missing code.
- **Type consistency:** `NotificationChannelType` and the extended `NotificationRule` (Task 1) are reused verbatim in the api port/DTO/mapper (Tasks 3, 6) and the web hooks/screen (Tasks 10-11). `NotificationMessage` and `NotificationChannelPort` are identical across port (Task 3), use case (Task 4), adapters + resolver (Task 5). The dispatch use case depends on the resolver abstraction (matching the test stub shape). REST stays ≤2-level nesting (`POST /notification-rules/:id/test`).
- **Architecture:** backend follows domain/application/infrastructure/interfaces; the channel port is outbound, adapters are the only place `fetch`/SMTP/Slack live, the resolver gives Open/Closed channel selection, the controller stays thin (validate → use case), and the dispatch use case depends only on ports. Frontend: timer state is ephemeral Zustand (no server data), STOP reuses the existing mutation so all server state flows through TanStack Query with its existing invalidation; `TimerDock` stays presentational (props in).

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (use backend-architect / frontend-architect / db-schema-guardian), review between tasks with code-reviewer.
2. **Inline Execution** — execute tasks in this session with checkpoints.
