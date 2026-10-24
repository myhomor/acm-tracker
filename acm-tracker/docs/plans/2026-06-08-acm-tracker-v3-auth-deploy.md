# ACM-TRACKER v3 — Real Auth (Cognito + Invitations) & Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plug the existing pluggable `AuthProvider` port into AWS Cognito (a new `CognitoAuthProvider` adapter + JWT verification + a real guard, selected at runtime via `WorkspaceSettings.authProvider`), add workspace **invitations** (model + RESTful create/list/accept + email send via a notification port), wire real Cognito login + invite/accept UI on the frontend — all while keeping `NoAuth` the untouched default for local dev — and then ship a **repeatable production deploy**: multi-stage Docker images for api & web, a `docker-compose.prod`, secrets/env config against a managed Postgres + Cognito, `prisma migrate deploy` on release, and a CI/CD deploy workflow with a pre-flight checklist and rollback note.

**Architecture:** Same as v1/v2. Backend = hexagonal (ports & adapters, SOLID) in `apps/api`; auth stays behind the existing `AUTH_PROVIDER` port — Cognito is a **new adapter**, selected by a factory over `WorkspaceSettings.authProvider` (`none` | `cognito`), so stable code (`NoAuthProvider`, `AuthGuard`) is extended via open/closed, never edited. A new `invitations` feature module owns the invite lifecycle; email send goes through a small outbound notification **port** with a console adapter for dev and an SES/SMTP adapter for prod. Frontend = reactive (TanStack Query + Zustand); the login screen branches on provider mode, invite UI lives in Settings, accept-invite is its own screen. Deploy is infra: production multi-stage Dockerfiles, a prod compose, and a GitHub Actions deploy job that runs **after** the existing unit + e2e gates pass.

**Tech Stack:** TypeScript, NestJS 10, Prisma 5/Postgres, AWS Cognito, React 18 + Vite, Docker, GitHub Actions, Jest, Vitest.

**Authority:** `CLAUDE.md` (root), `apps/api/CLAUDE.md` (hexagonal — note the pluggable `AuthProvider` port, "v1 = NoAuth adapter"), `apps/web/CLAUDE.md` (reactive). Use project skills `add-backend-feature` / `add-frontend-feature`; delegate Prisma/migrations to `db-schema-guardian`; audit with `code-reviewer` before merge. This plan is immutable once written — update only checkbox state during execution.

**Sequencing:** EPIC F (auth + invitations) ships **before** EPIC I (production deploy) — a multi-user production must not be exposed before real identity enforcement exists.

---

## Scope (explicit)

IN (EPIC F): (1) `CognitoAuthProvider` adapter implementing the existing `AuthProvider` interface — Cognito JWT verification (JWKS), token→`Member` mapping via `Member.authProviderUserId`; (2) a runtime **provider selection** factory bound to `AUTH_PROVIDER`, driven by `WorkspaceSettings.authProvider` (`none`|`cognito`) — `none` keeps `NoAuthProvider` as default; (3) the `AuthGuard` honoring `enforces` (reject when a Cognito token is missing/invalid); (4) an `Invitation` model + RESTful create/list/accept endpoints; (5) an outbound notification **port** + console (dev) and email (prod) adapters, used to send the invite; (6) frontend: real Cognito login in `Auth.tsx` behind provider mode, an invite UI in Settings, an accept-invite screen; (7) unit tests for guard behavior and provider selection with fakes.

IN (EPIC I): (8) production multi-stage Dockerfiles for `api` (build → slim runtime, `migrate deploy` on start) and `web` (build → static served by nginx); (9) `docker-compose.prod.yml`; (10) environment/secrets template (`DATABASE_URL` → managed Postgres, Cognito config, owner seed); (11) `prisma migrate deploy` on release; (12) web build served behind a static host/nginx with the API reachable; (13) a domain + TLS note; (14) a CI/CD **deploy** workflow extending `.github/workflows` that builds & pushes images and deploys on push to `main` / tag, gated by the existing unit + e2e jobs; (15) a pre-flight checklist + rollback note; (16) explicit MANUAL vs AUTOMATED step callouts (provision managed DB, DNS, secrets are manual).

OUT (do NOT build here): social/OAuth providers beyond Cognito, password reset UI (delegated to Cognito Hosted UI), multi-workspace tenancy, Terraform/IaC for AWS resource provisioning (manual one-time setup, documented as a checklist), Kubernetes, autoscaling, observability stack.

`NoAuth` local dev is unaffected end-to-end: with `authProvider = "none"` the system behaves exactly as today.

---

## File Structure

```
apps/api/src/
├── auth/                                  # EXISTING port — extend, do not edit stable files
│   ├── auth-provider.interface.ts         # (unchanged) AuthProvider port + AUTH_PROVIDER token
│   ├── no-auth.provider.ts                # (unchanged) default local adapter
│   ├── auth.guard.ts                      # MODIFY: honor `enforces` (reject when unauthenticated)
│   ├── auth.module.ts                     # MODIFY: bind AUTH_PROVIDER via selection factory
│   ├── cognito/
│   │   ├── cognito.provider.ts            # CognitoAuthProvider implements AuthProvider
│   │   ├── cognito-token.verifier.ts      # JWKS fetch + JWT verify (issuer/aud/exp)
│   │   ├── cognito.config.ts              # reads WorkspaceSettings.authConfig (region, userPoolId, clientId)
│   │   └── cognito.provider.spec.ts       # token→Member mapping, invalid token rejects
│   └── auth-provider.factory.ts           # selects NoAuth|Cognito from WorkspaceSettings.authProvider
│       └── auth-provider.factory.spec.ts  # selection + guard-enforcement unit tests (fakes)
└── modules/
    └── invitations/                       # new feature (hexagonal)
        ├── domain/ports/
        │   ├── invitation.repository.port.ts      # INVITATION_REPOSITORY token + port
        │   └── notification.port.ts               # NOTIFICATION_SENDER token + send() port
        ├── application/use-cases/
        │   ├── create-invitation.use-case.ts      # generate token, persist, send email
        │   ├── list-invitations.use-case.ts
        │   └── accept-invitation.use-case.ts      # validate token/expiry, create/link Member
        ├── infrastructure/
        │   ├── persistence/
        │   │   ├── invitation.mapper.ts
        │   │   └── prisma-invitation.repository.ts
        │   └── notification/
        │       ├── console-notification.adapter.ts   # dev: logs the invite link
        │       └── email-notification.adapter.ts     # prod: SES/SMTP send
        ├── interfaces/http/
        │   ├── invitations.controller.ts          # REST /invitations
        │   └── dto/{create-invitation,accept-invitation}.dto.ts
        └── invitations.module.ts

packages/shared/src/
└── types.ts            # ADD: Invitation, InvitationStatus, AuthProviderMode

apps/web/src/
├── features/
│   ├── auth/api/use-auth.ts                # ADD: useAuthMode(), useCognitoLogin()
│   └── invitations/api/use-invitations.ts  # list + create + accept hooks
├── lib/
│   ├── api-client.ts                       # MODIFY: attach bearer token when present
│   └── cognito-client.ts                   # amazon-cognito-identity-js login wrapper
├── screens/
│   ├── Auth.tsx                            # MODIFY: branch on auth mode (none vs cognito)
│   ├── Settings.tsx                        # MODIFY: invitations panel (create + list)
│   └── AcceptInvite.tsx                    # accept-invite flow screen
└── App.tsx                                 # ADD: /accept-invite route

apps/api/Dockerfile                         # MODIFY: multi-stage build→runtime
apps/web/Dockerfile                         # MODIFY: multi-stage build→nginx static
apps/web/nginx.conf                         # SPA fallback + API proxy
docker-compose.prod.yml                     # api + web + (external managed db)
.env.prod.example                           # secrets/env template
.github/workflows/deploy.yml                # build+push images, deploy on main/tag
docs/deploy/PRODUCTION.md                   # manual setup + pre-flight + rollback
```

**Responsibility boundaries:** `auth/cognito/` is a single new adapter; `auth-provider.factory.ts` is the only new wiring; `NoAuthProvider` and `auth-provider.interface.ts` stay byte-for-byte unchanged (open/closed). `invitations` owns the invite lifecycle only; email delivery is behind `notification.port.ts` so the use case never imports SES/SMTP. Frontend cognito logic lives in `lib/cognito-client.ts` and `features/auth`; screens stay presentational-ish (consume hooks). Deploy artifacts are infra files, no app logic.

---

## Prisma schema change

A new `Invitation` model is required. `WorkspaceSettings.authProvider` / `authConfig` and `Member.authProviderUserId` already exist (no change). Delegate to **db-schema-guardian**. Additive only (new table) — safe.

```prisma
model Invitation {
  id        String   @id @default(cuid())
  email     String
  role      String   @default("member")
  token     String   @unique
  status    String   @default("pending") // pending | accepted | expired | revoked
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([email])
}
```

---

## Phase F1 — Shared contract (auth + invitation types)

### Task 1: Shared types for auth mode + invitations (additive)

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Append the new types to `packages/shared/src/types.ts`**

```typescript
export type AuthProviderMode = "none" | "cognito";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}
```

- [ ] **Step 2: Build shared to confirm it compiles**

Run: `pnpm --filter @acm/shared build`
Expected: tsc completes, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): auth-mode + invitation domain types"
```

---

## Phase F2 — Cognito adapter + pluggable provider selection (open/closed)

### Task 2: Cognito config + token verifier

**Files:**
- Create: `apps/api/src/auth/cognito/cognito.config.ts`
- Create: `apps/api/src/auth/cognito/cognito-token.verifier.ts`

- [ ] **Step 1: Add the JWT verify dependency**

Run: `pnpm --filter @acm/api add aws-jwt-verify`
Expected: `aws-jwt-verify` in `apps/api/package.json` dependencies (Cognito-native JWKS + issuer/aud/exp verification — no hand-rolled crypto).

- [ ] **Step 2: Create `cognito.config.ts`** (reads `WorkspaceSettings.authConfig`, falls back to env)

```typescript
export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

export function cognitoConfigFrom(authConfig: unknown): CognitoConfig {
  const cfg = (authConfig ?? {}) as Partial<CognitoConfig>;
  const region = cfg.region ?? process.env.COGNITO_REGION ?? "";
  const userPoolId = cfg.userPoolId ?? process.env.COGNITO_USER_POOL_ID ?? "";
  const clientId = cfg.clientId ?? process.env.COGNITO_CLIENT_ID ?? "";
  if (!region || !userPoolId || !clientId) {
    throw new Error("Cognito config incomplete (region/userPoolId/clientId)");
  }
  return { region, userPoolId, clientId };
}
```

- [ ] **Step 3: Create `cognito-token.verifier.ts`** (wraps `aws-jwt-verify`)

```typescript
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { CognitoConfig } from "./cognito.config";

export interface VerifiedClaims {
  sub: string;
  email: string;
  name: string;
}

export class CognitoTokenVerifier {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(config: CognitoConfig) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      clientId: config.clientId,
      tokenUse: "id",
    });
  }

  async verify(token: string): Promise<VerifiedClaims> {
    const payload = await this.verifier.verify(token);
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? payload.email ?? ""),
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/cognito/cognito.config.ts apps/api/src/auth/cognito/cognito-token.verifier.ts apps/api/package.json
git commit -m "feat(api): Cognito config + JWT verifier (aws-jwt-verify)"
```

---

### Task 3: CognitoAuthProvider adapter (token → Member) — TDD

**Files:**
- Test: `apps/api/src/auth/cognito/cognito.provider.spec.ts`
- Create: `apps/api/src/auth/cognito/cognito.provider.ts`

- [ ] **Step 1: Write the failing test** (fake verifier + fake prisma; maps `sub` → `Member` via `authProviderUserId`)

```typescript
import { CognitoAuthProvider } from "./cognito.provider";

const claims = { sub: "cog-1", email: "u@acm.io", name: "U" };
const verifier = { verify: jest.fn().mockResolvedValue(claims) } as any;

function reqWith(token?: string) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as any;
}

describe("CognitoAuthProvider", () => {
  it("enforces identity", () => {
    const prisma = { member: { findUnique: jest.fn() } } as any;
    expect(new CognitoAuthProvider(verifier, prisma).enforces).toBe(true);
  });

  it("maps a verified token to the linked Member", async () => {
    const prisma = { member: { findUnique: jest.fn().mockResolvedValue({ id: "m1", email: "u@acm.io", name: "U" }) } } as any;
    const provider = new CognitoAuthProvider(verifier, prisma);
    const user = await provider.getCurrentUser(reqWith("jwt"));
    expect(prisma.member.findUnique).toHaveBeenCalledWith({ where: { authProviderUserId: "cog-1" } });
    expect(user).toEqual({ memberId: "m1", email: "u@acm.io", name: "U" });
  });

  it("rejects a request with no bearer token", async () => {
    const prisma = { member: { findUnique: jest.fn() } } as any;
    await expect(new CognitoAuthProvider(verifier, prisma).getCurrentUser(reqWith())).rejects.toThrow();
  });

  it("rejects when the verified user is not a linked Member", async () => {
    const prisma = { member: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(new CognitoAuthProvider(verifier, prisma).getCurrentUser(reqWith("jwt"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test cognito.provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `cognito.provider.ts`** (implements the existing `AuthProvider` port)

```typescript
import { UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthProvider, AuthedUser } from "../auth-provider.interface";
import { CognitoTokenVerifier } from "./cognito-token.verifier";

export class CognitoAuthProvider implements AuthProvider {
  readonly enforces = true;

  constructor(
    private readonly verifier: CognitoTokenVerifier,
    private readonly prisma: PrismaService,
  ) {}

  async getCurrentUser(req: unknown): Promise<AuthedUser> {
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException("Missing bearer token");
    const claims = await this.verifier.verify(token).catch(() => null);
    if (!claims) throw new UnauthorizedException("Invalid token");
    const member = await this.prisma.member.findUnique({
      where: { authProviderUserId: claims.sub },
    });
    if (!member) throw new UnauthorizedException("No linked member for this identity");
    return { memberId: member.id, email: member.email, name: member.name };
  }
}

function bearerToken(req: unknown): string | null {
  const header = (req as { headers?: Record<string, string> })?.headers?.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @acm/api test cognito.provider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/cognito/cognito.provider.ts apps/api/src/auth/cognito/cognito.provider.spec.ts
git commit -m "feat(api): CognitoAuthProvider adapter (token->Member) with tests"
```

---

### Task 4: Provider selection factory + guard enforcement — TDD

**Files:**
- Test: `apps/api/src/auth/auth-provider.factory.spec.ts`
- Create: `apps/api/src/auth/auth-provider.factory.ts`
- Modify: `apps/api/src/auth/auth.guard.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Write the failing test** (factory picks adapter by `WorkspaceSettings.authProvider`; guard rejects when provider enforces and lookup throws)

```typescript
import { resolveAuthProvider } from "./auth-provider.factory";
import { NoAuthProvider } from "./no-auth.provider";
import { CognitoAuthProvider } from "./cognito/cognito.provider";

describe("resolveAuthProvider", () => {
  const noAuth = { enforces: false } as NoAuthProvider;
  const build = (mode: string, authConfig: unknown = {}) => {
    const prisma = { workspaceSettings: { findUnique: jest.fn().mockResolvedValue({ authProvider: mode, authConfig }) } } as any;
    return resolveAuthProvider(prisma, noAuth, () => ({}) as CognitoAuthProvider);
  };

  it("returns NoAuth when authProvider is 'none'", async () => {
    expect(await build("none")).toBe(noAuth);
  });

  it("returns a Cognito adapter when authProvider is 'cognito'", async () => {
    const provider = await build("cognito", { region: "us-east-1", userPoolId: "p", clientId: "c" });
    expect(provider).not.toBe(noAuth);
  });

  it("defaults to NoAuth when no settings row exists", async () => {
    const prisma = { workspaceSettings: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    expect(await resolveAuthProvider(prisma, noAuth, () => ({}) as CognitoAuthProvider)).toBe(noAuth);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @acm/api test auth-provider.factory`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `auth-provider.factory.ts`**

```typescript
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthProvider } from "./auth-provider.interface";
import type { NoAuthProvider } from "./no-auth.provider";
import type { CognitoAuthProvider } from "./cognito/cognito.provider";

export async function resolveAuthProvider(
  prisma: PrismaService,
  noAuth: NoAuthProvider,
  makeCognito: (authConfig: unknown) => CognitoAuthProvider,
): Promise<AuthProvider> {
  const settings = await prisma.workspaceSettings.findUnique({ where: { id: 1 } });
  if (settings?.authProvider === "cognito") return makeCognito(settings.authConfig);
  return noAuth;
}
```

- [ ] **Step 4: Modify `auth.guard.ts` to honor `enforces`**

The guard currently always returns `true`. Wrap the lookup so an enforcing provider rejects (401) when identity resolution fails; a non-enforcing provider keeps today's behavior.

```typescript
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_PROVIDER, AuthProvider } from "./auth-provider.interface";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PROVIDER) private auth: AuthProvider) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    try {
      req.user = await this.auth.getCurrentUser(req);
    } catch (err) {
      if (this.auth.enforces) throw new UnauthorizedException();
      throw err;
    }
    return true;
  }
}
```

- [ ] **Step 5: Modify `auth.module.ts` to bind `AUTH_PROVIDER` via the factory**

Replace the static `useExisting: NoAuthProvider` binding with a `useFactory` that calls `resolveAuthProvider`, injecting `PrismaService`, `NoAuthProvider`, and a `CognitoAuthProvider` builder (which constructs `CognitoTokenVerifier` from `cognitoConfigFrom(authConfig)`). Keep `NoAuthProvider`, `AuthGuard`, and the controller registered. `NoAuthProvider` stays the default.

```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_PROVIDER } from "./auth-provider.interface";
import { NoAuthProvider } from "./no-auth.provider";
import { AuthGuard } from "./auth.guard";
import { AuthController } from "./auth.controller";
import { resolveAuthProvider } from "./auth-provider.factory";
import { CognitoAuthProvider } from "./cognito/cognito.provider";
import { CognitoTokenVerifier } from "./cognito/cognito-token.verifier";
import { cognitoConfigFrom } from "./cognito/cognito.config";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    NoAuthProvider,
    AuthGuard,
    {
      provide: AUTH_PROVIDER,
      inject: [PrismaService, NoAuthProvider],
      useFactory: (prisma: PrismaService, noAuth: NoAuthProvider) =>
        resolveAuthProvider(prisma, noAuth, (authConfig) =>
          new CognitoAuthProvider(new CognitoTokenVerifier(cognitoConfigFrom(authConfig)), prisma),
        ),
    },
  ],
  exports: [AUTH_PROVIDER, AuthGuard],
})
export class AuthModule {}
```

> The async `useFactory` resolves the provider once at module init from `WorkspaceSettings`. Switching modes is an admin operation requiring a restart — acceptable for v3; document it in `docs/deploy/PRODUCTION.md`.

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @acm/api test auth && pnpm --filter @acm/api build`
Expected: factory + provider + existing `no-auth.provider` specs green; build clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/auth-provider.factory.ts apps/api/src/auth/auth-provider.factory.spec.ts apps/api/src/auth/auth.guard.ts apps/api/src/auth/auth.module.ts
git commit -m "feat(api): pluggable AuthProvider selection (none|cognito) + enforcing guard"
```

---

## Phase F3 — Invitations backend (hexagonal)

### Task 5: Invitation schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Append the `Invitation` model to `apps/api/prisma/schema.prisma`** (see "Prisma schema change" above).

- [ ] **Step 2: Create the migration against a throwaway local Postgres**

Run (temporary DB, then tear down — do NOT touch remote, do NOT add to compose):
```bash
docker run -d --name acm-pg-tmp -e POSTGRES_PASSWORD=temp -e POSTGRES_DB=acm_tracker -p 55433:5432 postgres:16-alpine
cd apps/api && printf 'DATABASE_URL="postgresql://postgres:temp@localhost:55433/acm_tracker?schema=public"\n' > .env
pnpm exec prisma migrate dev --name add_invitation
docker exec acm-pg-tmp psql -U postgres -d acm_tracker -c "\dt" | grep Invitation
rm -f .env && docker rm -f acm-pg-tmp
```
Expected: migration `*_add_invitation` created; `Invitation` table listed; temp DB + .env removed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): Invitation schema + migration"
```

---

### Task 6: Invitation port + notification port + DTOs

**Files:**
- Create: `apps/api/src/modules/invitations/domain/ports/invitation.repository.port.ts`
- Create: `apps/api/src/modules/invitations/domain/ports/notification.port.ts`
- Create: `apps/api/src/modules/invitations/interfaces/http/dto/create-invitation.dto.ts`
- Create: `apps/api/src/modules/invitations/interfaces/http/dto/accept-invitation.dto.ts`

- [ ] **Step 1: Create `invitation.repository.port.ts`**

```typescript
import type { Invitation } from "@acm/shared";

export const INVITATION_REPOSITORY = Symbol("INVITATION_REPOSITORY");

export interface CreateInvitationData {
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export interface InvitationRepositoryPort {
  create(data: CreateInvitationData): Promise<Invitation>;
  findAll(): Promise<Invitation[]>;
  findByToken(token: string): Promise<Invitation | null>;
  markAccepted(id: string): Promise<Invitation>;
}
```

- [ ] **Step 2: Create `notification.port.ts`** (outbound — keeps email tech out of the use case)

```typescript
export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");

export interface InvitationEmail {
  to: string;
  inviteUrl: string;
}

export interface NotificationSenderPort {
  sendInvitation(email: InvitationEmail): Promise<void>;
}
```

- [ ] **Step 3: Create `create-invitation.dto.ts`**

```typescript
import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class CreateInvitationDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() @IsIn(["owner", "admin", "member"]) role?: string;
}
```

- [ ] **Step 4: Create `accept-invitation.dto.ts`**

```typescript
import { IsString } from "class-validator";

export class AcceptInvitationDto {
  @IsString() token!: string;
  @IsString() authProviderUserId!: string;
  @IsString() name!: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/invitations/domain apps/api/src/modules/invitations/interfaces/http/dto
git commit -m "feat(api): invitation + notification ports + DTOs"
```

---

### Task 7: Invitation use cases — TDD

**Files:**
- Test: `apps/api/src/modules/invitations/application/use-cases/create-invitation.use-case.spec.ts`
- Test: `apps/api/src/modules/invitations/application/use-cases/accept-invitation.use-case.spec.ts`
- Create: `apps/api/src/modules/invitations/application/use-cases/create-invitation.use-case.ts`
- Create: `apps/api/src/modules/invitations/application/use-cases/list-invitations.use-case.ts`
- Create: `apps/api/src/modules/invitations/application/use-cases/accept-invitation.use-case.ts`

- [ ] **Step 1: Write the failing tests**

`create-invitation.use-case.spec.ts` (persists with a token + future expiry, then sends the email):
```typescript
import { CreateInvitationUseCase } from "./create-invitation.use-case";
import type { Invitation } from "@acm/shared";
import { CreateInvitationData, InvitationRepositoryPort } from "../../domain/ports/invitation.repository.port";
import { InvitationEmail, NotificationSenderPort } from "../../domain/ports/notification.port";

class FakeRepo implements InvitationRepositoryPort {
  public last?: CreateInvitationData;
  async create(data: CreateInvitationData): Promise<Invitation> {
    this.last = data;
    return { id: "i1", email: data.email, role: data.role, status: "pending", expiresAt: data.expiresAt.toISOString(), createdAt: "now" };
  }
  async findAll() { return []; }
  async findByToken() { return null; }
  async markAccepted(): Promise<Invitation> { throw new Error("unused"); }
}
class FakeSender implements NotificationSenderPort {
  public sent?: InvitationEmail;
  async sendInvitation(email: InvitationEmail) { this.sent = email; }
}

describe("CreateInvitationUseCase", () => {
  it("persists an invitation and emails the invite link", async () => {
    const repo = new FakeRepo();
    const sender = new FakeSender();
    const useCase = new CreateInvitationUseCase(repo, sender, "https://app.acm.io");
    await useCase.execute({ email: "new@acm.io", role: "member" });
    expect(repo.last?.email).toBe("new@acm.io");
    expect(repo.last?.token).toHaveLength(64);
    expect(repo.last?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(sender.sent?.to).toBe("new@acm.io");
    expect(sender.sent?.inviteUrl).toContain("https://app.acm.io/accept-invite?token=");
  });
});
```

`accept-invitation.use-case.spec.ts` (valid token → create/link Member + mark accepted; expired/used → reject):
```typescript
import { AcceptInvitationUseCase } from "./accept-invitation.use-case";
import type { Invitation } from "@acm/shared";

const pending = (over: Partial<Invitation> = {}): Invitation => ({
  id: "i1", email: "new@acm.io", role: "member", status: "pending",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: "now", ...over,
});

function build(invitation: Invitation | null) {
  const repo = {
    findByToken: jest.fn().mockResolvedValue(invitation),
    markAccepted: jest.fn().mockResolvedValue({ ...(invitation ?? pending()), status: "accepted" }),
  } as any;
  const members = { upsertFromInvitation: jest.fn().mockResolvedValue({ id: "m1" }) } as any;
  return { repo, members, useCase: new AcceptInvitationUseCase(repo, members) };
}

describe("AcceptInvitationUseCase", () => {
  it("links a Member and marks the invitation accepted", async () => {
    const { repo, members, useCase } = build(pending());
    await useCase.execute({ token: "t", authProviderUserId: "cog-9", name: "New" });
    expect(members.upsertFromInvitation).toHaveBeenCalled();
    expect(repo.markAccepted).toHaveBeenCalledWith("i1");
  });

  it("rejects an unknown token", async () => {
    const { useCase } = build(null);
    await expect(useCase.execute({ token: "x", authProviderUserId: "c", name: "n" })).rejects.toThrow();
  });

  it("rejects an expired invitation", async () => {
    const expired = pending({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const { useCase } = build(expired);
    await expect(useCase.execute({ token: "t", authProviderUserId: "c", name: "n" })).rejects.toThrow();
  });

  it("rejects an already-accepted invitation", async () => {
    const { useCase } = build(pending({ status: "accepted" }));
    await expect(useCase.execute({ token: "t", authProviderUserId: "c", name: "n" })).rejects.toThrow();
  });
});
```

> `accept-invitation` links a `Member`: depend on a small member-link port (`upsertFromInvitation(email, role, authProviderUserId, name)`). Reuse the members feature's repository port if it already exposes a create/link by email + `authProviderUserId`; otherwise add a focused port method there (do not fatten an interface). Confirm during implementation and wire in the module.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @acm/api test invitation`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create the three use cases**

`create-invitation.use-case.ts` (token via `crypto.randomBytes`, 7-day expiry, then send):
```typescript
import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import type { Invitation } from "@acm/shared";
import { INVITATION_REPOSITORY, InvitationRepositoryPort } from "../../domain/ports/invitation.repository.port";
import { NOTIFICATION_SENDER, NotificationSenderPort } from "../../domain/ports/notification.port";
import { CreateInvitationDto } from "../../interfaces/http/dto/create-invitation.dto";

const SEVEN_DAYS_MS = 7 * 86_400_000;

@Injectable()
export class CreateInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly repo: InvitationRepositoryPort,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSenderPort,
    @Inject("APP_URL") private readonly appUrl: string,
  ) {}

  async execute(dto: CreateInvitationDto): Promise<Invitation> {
    const token = randomBytes(32).toString("hex");
    const invitation = await this.repo.create({
      email: dto.email,
      role: dto.role ?? "member",
      token,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    });
    await this.sender.sendInvitation({ to: dto.email, inviteUrl: `${this.appUrl}/accept-invite?token=${token}` });
    return invitation;
  }
}
```

`list-invitations.use-case.ts`:
```typescript
import { Inject, Injectable } from "@nestjs/common";
import type { Invitation } from "@acm/shared";
import { INVITATION_REPOSITORY, InvitationRepositoryPort } from "../../domain/ports/invitation.repository.port";

@Injectable()
export class ListInvitationsUseCase {
  constructor(@Inject(INVITATION_REPOSITORY) private readonly repo: InvitationRepositoryPort) {}
  execute(): Promise<Invitation[]> {
    return this.repo.findAll();
  }
}
```

`accept-invitation.use-case.ts`:
```typescript
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { INVITATION_REPOSITORY, InvitationRepositoryPort } from "../../domain/ports/invitation.repository.port";
import { MEMBER_LINK, MemberLinkPort } from "../../domain/ports/member-link.port";
import { AcceptInvitationDto } from "../../interfaces/http/dto/accept-invitation.dto";

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly repo: InvitationRepositoryPort,
    @Inject(MEMBER_LINK) private readonly members: MemberLinkPort,
  ) {}

  async execute(dto: AcceptInvitationDto): Promise<{ memberId: string }> {
    const invitation = await this.repo.findByToken(dto.token);
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status !== "pending") throw new BadRequestException("Invitation is not pending");
    if (new Date(invitation.expiresAt).getTime() < Date.now()) throw new BadRequestException("Invitation expired");
    const member = await this.members.upsertFromInvitation({
      email: invitation.email,
      role: invitation.role,
      authProviderUserId: dto.authProviderUserId,
      name: dto.name,
    });
    await this.repo.markAccepted(invitation.id);
    return { memberId: member.id };
  }
}
```

> Add `member-link.port.ts` (`MEMBER_LINK` token + `MemberLinkPort.upsertFromInvitation(...)`) under `invitations/domain/ports/` and implement it in the invitations module by delegating to the members repository (or a thin adapter). Keep the port focused (one method).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @acm/api test invitation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/invitations/application apps/api/src/modules/invitations/domain
git commit -m "feat(api): invitation use cases (create/list/accept) + member-link port with tests"
```

---

### Task 8: Invitation adapters + controller + module

**Files:**
- Create: `apps/api/src/modules/invitations/infrastructure/persistence/invitation.mapper.ts`
- Create: `apps/api/src/modules/invitations/infrastructure/persistence/prisma-invitation.repository.ts`
- Create: `apps/api/src/modules/invitations/infrastructure/notification/console-notification.adapter.ts`
- Create: `apps/api/src/modules/invitations/infrastructure/notification/email-notification.adapter.ts`
- Create: `apps/api/src/modules/invitations/interfaces/http/invitations.controller.ts`
- Create: `apps/api/src/modules/invitations/invitations.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the mapper**

```typescript
import type { Invitation as PrismaInvitation } from "@prisma/client";
import type { Invitation, InvitationStatus } from "@acm/shared";

export function toDomainInvitation(row: PrismaInvitation): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status as InvitationStatus,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 2: Create the Prisma adapter**

```typescript
import { Injectable } from "@nestjs/common";
import type { Invitation } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateInvitationData, InvitationRepositoryPort } from "../../domain/ports/invitation.repository.port";
import { toDomainInvitation } from "./invitation.mapper";

@Injectable()
export class PrismaInvitationRepository implements InvitationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInvitationData): Promise<Invitation> {
    const row = await this.prisma.invitation.create({ data });
    return toDomainInvitation(row);
  }
  async findAll(): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toDomainInvitation);
  }
  async findByToken(token: string): Promise<Invitation | null> {
    const row = await this.prisma.invitation.findUnique({ where: { token } });
    return row ? toDomainInvitation(row) : null;
  }
  async markAccepted(id: string): Promise<Invitation> {
    const row = await this.prisma.invitation.update({ where: { id }, data: { status: "accepted" } });
    return toDomainInvitation(row);
  }
}
```

- [ ] **Step 3: Create the console adapter (dev default)**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { InvitationEmail, NotificationSenderPort } from "../../domain/ports/notification.port";

@Injectable()
export class ConsoleNotificationAdapter implements NotificationSenderPort {
  private readonly logger = new Logger("Invitations");
  async sendInvitation(email: InvitationEmail): Promise<void> {
    this.logger.log(`Invite ${email.to}: ${email.inviteUrl}`);
  }
}
```

- [ ] **Step 4: Create the email adapter (prod)** — SES via `@aws-sdk/client-ses`, selected by env

```typescript
import { Injectable } from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { InvitationEmail, NotificationSenderPort } from "../../domain/ports/notification.port";

@Injectable()
export class EmailNotificationAdapter implements NotificationSenderPort {
  private readonly ses = new SESClient({ region: process.env.AWS_REGION });

  async sendInvitation(email: InvitationEmail): Promise<void> {
    await this.ses.send(new SendEmailCommand({
      Source: process.env.INVITE_FROM_EMAIL!,
      Destination: { ToAddresses: [email.to] },
      Message: {
        Subject: { Data: "Te invitaron a ACM-TRACKER" },
        Body: { Text: { Data: `Acepta tu invitación: ${email.inviteUrl}` } },
      },
    }));
  }
}
```

> Add `@aws-sdk/client-ses` to `apps/api` deps: `pnpm --filter @acm/api add @aws-sdk/client-ses`.

- [ ] **Step 5: Create the controller (RESTful)**

```typescript
import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateInvitationUseCase } from "../../application/use-cases/create-invitation.use-case";
import { ListInvitationsUseCase } from "../../application/use-cases/list-invitations.use-case";
import { AcceptInvitationUseCase } from "../../application/use-cases/accept-invitation.use-case";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";

@Controller("invitations")
export class InvitationsController {
  constructor(
    private readonly createInvite: CreateInvitationUseCase,
    private readonly listInvites: ListInvitationsUseCase,
    private readonly acceptInvite: AcceptInvitationUseCase,
  ) {}

  @UseGuards(AuthGuard)
  @Post() create(@Body() dto: CreateInvitationDto) {
    return this.createInvite.execute(dto);
  }
  @UseGuards(AuthGuard)
  @Get() findAll() {
    return this.listInvites.execute();
  }
  @Post("accept") @HttpCode(200) accept(@Body() dto: AcceptInvitationDto) {
    return this.acceptInvite.execute(dto);
  }
}
```

> `POST /invitations/accept` is intentionally **un-guarded** — the invitee has no Member yet; the random token is the credential.

- [ ] **Step 6: Create the module** (bind both notification adapters via env-based factory; default console)

```typescript
import { Module } from "@nestjs/common";
import { INVITATION_REPOSITORY } from "./domain/ports/invitation.repository.port";
import { NOTIFICATION_SENDER } from "./domain/ports/notification.port";
import { MEMBER_LINK } from "./domain/ports/member-link.port";
import { CreateInvitationUseCase } from "./application/use-cases/create-invitation.use-case";
import { ListInvitationsUseCase } from "./application/use-cases/list-invitations.use-case";
import { AcceptInvitationUseCase } from "./application/use-cases/accept-invitation.use-case";
import { PrismaInvitationRepository } from "./infrastructure/persistence/prisma-invitation.repository";
import { PrismaMemberLinkAdapter } from "./infrastructure/persistence/prisma-member-link.adapter";
import { ConsoleNotificationAdapter } from "./infrastructure/notification/console-notification.adapter";
import { EmailNotificationAdapter } from "./infrastructure/notification/email-notification.adapter";
import { InvitationsController } from "./interfaces/http/invitations.controller";

@Module({
  controllers: [InvitationsController],
  providers: [
    CreateInvitationUseCase,
    ListInvitationsUseCase,
    AcceptInvitationUseCase,
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: MEMBER_LINK, useClass: PrismaMemberLinkAdapter },
    { provide: "APP_URL", useValue: process.env.APP_URL ?? "http://localhost:5173" },
    {
      provide: NOTIFICATION_SENDER,
      useClass: process.env.INVITE_EMAIL === "ses" ? EmailNotificationAdapter : ConsoleNotificationAdapter,
    },
  ],
})
export class InvitationsModule {}
```

> Create `prisma-member-link.adapter.ts` implementing `MemberLinkPort` via `PrismaService` (`member.upsert` by `email`, setting `role` + `authProviderUserId` + `name`). Keep it in `infrastructure/persistence/`.

- [ ] **Step 7: Register `InvitationsModule` in `app.module.ts`** (add import + include in `imports`).

- [ ] **Step 8: Build + test**

Run: `pnpm --filter @acm/api build && pnpm --filter @acm/api test`
Expected: build clean; all tests green.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/invitations apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat(api): invitation adapters + RESTful controller + module (console/SES email)"
```

---

## Phase F4 — Frontend (Cognito login + invitations UI)

### Task 9: Cognito client + auth-mode + token attach

**Files:**
- Create: `apps/web/src/lib/cognito-client.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/features/auth/api/use-auth.ts`

- [ ] **Step 1: Add the Cognito browser SDK**

Run: `pnpm --filter @acm/web add amazon-cognito-identity-js`
Expected: dependency added.

- [ ] **Step 2: Create `cognito-client.ts`** (login → returns the id token; reads pool/client from Vite env)

```typescript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? "",
});

export function cognitoLogin(email: string, password: string): Promise<string> {
  const user = new CognitoUser({ Username: email, Pool: pool });
  const auth = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: reject,
    });
  });
}
```

- [ ] **Step 3: Modify `api-client.ts` to attach a bearer token when present**

Read the token from a small accessor (e.g. `localStorage.getItem("acm.idToken")`) and add `Authorization: Bearer <token>` to headers when set. Keep behavior identical when no token (NoAuth dev unaffected).

```typescript
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("acm.idToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

> Keep the exported `apiClient` object unchanged in shape (`get/post/patch/del`).

- [ ] **Step 4: Extend `use-auth.ts`** with auth-mode detection + a Cognito login hook (keep `useLogin` for NoAuth)

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AuthProviderMode } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";
import { cognitoLogin } from "../../../lib/cognito-client";

export function useAuthMode() {
  return useQuery({
    queryKey: ["auth-mode"],
    queryFn: () => apiClient.get<{ mode: AuthProviderMode }>("/auth/mode"),
  });
}

export function useCognitoLogin() {
  return useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const token = await cognitoLogin(creds.email, creds.password);
      localStorage.setItem("acm.idToken", token);
      return apiClient.post<{ memberId: string; name: string; email: string; role: string }>("/auth/me", {});
    },
  });
}
```

> Add a tiny `GET /auth/mode` handler to `AuthController` returning `{ mode }` from `WorkspaceSettings.authProvider` (read-only; no guard) so the frontend can branch. This is the only `auth.controller.ts` change.

- [ ] **Step 5: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/cognito-client.ts apps/web/src/lib/api-client.ts apps/web/src/features/auth apps/api/src/auth/auth.controller.ts
git commit -m "feat(web): Cognito client + bearer-token attach + auth-mode hook; GET /auth/mode"
```

---

### Task 10: Invitations data hooks

**Files:**
- Create: `apps/web/src/features/invitations/api/use-invitations.ts`

- [ ] **Step 1: Create `use-invitations.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Invitation } from "@acm/shared";
import { apiClient } from "../../../lib/api-client";

export function useInvitations() {
  return useQuery({ queryKey: ["invitations"], queryFn: () => apiClient.get<Invitation[]>("/invitations") });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { email: string; role?: string }) => apiClient.post<Invitation>("/invitations", dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (dto: { token: string; authProviderUserId: string; name: string }) =>
      apiClient.post<{ memberId: string }>("/invitations/accept", dto),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/invitations
git commit -m "feat(web): invitations data hooks (list/create/accept)"
```

---

### Task 11: Auth screen branch + Settings invite panel + AcceptInvite screen + route

**Files:**
- Modify: `apps/web/src/screens/Auth.tsx`
- Modify: `apps/web/src/screens/Settings.tsx`
- Create: `apps/web/src/screens/AcceptInvite.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Branch `Auth.tsx` on auth mode**

Read `useAuthMode()`. When `mode === "none"`, keep today's email-only NoAuth form. When `mode === "cognito"`, render email + password fields wired to `useCognitoLogin()` (on success `navigate("/")`). Reuse the existing `inputStyle` and layout; add a password `<input type="password" aria-label="Contraseña">`. No layout rewrite — only the right-hand form branches.

- [ ] **Step 2: Add an invitations panel to `Settings.tsx`**

Add a Panel "Invitaciones" using `useInvitations()` + `useCreateInvitation()`: an email input + role select + "Invitar" button (mutate, then the list invalidates), and a list of invitations showing `email · role · status`. Reuse existing input styles in the file; keep the existing panels.

```tsx
import { useInvitations, useCreateInvitation } from "../features/invitations/api/use-invitations";
```

- [ ] **Step 3: Create `AcceptInvite.tsx`**

Reads `?token=` from the URL. For `cognito` mode: collect name + (delegate password/signup to Cognito Hosted UI or a minimal sign-up, out of scope here — capture the `authProviderUserId` after Cognito sign-up) then call `useAcceptInvitation()`. For `none` mode: capture name, generate a local `authProviderUserId` placeholder equal to the email, call accept, then navigate to `/auth`. Show success/error states. Keep it a single focused screen.

```tsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAcceptInvitation } from "../features/invitations/api/use-invitations";
```

- [ ] **Step 4: Wire the `/accept-invite` route in `App.tsx`**

```tsx
import { AcceptInvite } from "./screens/AcceptInvite";
// <Route path="/accept-invite" element={<AcceptInvite />} />
```

- [ ] **Step 5: Build**

Run: `pnpm --filter @acm/web build`
Expected: clean (tsc + vite).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens apps/web/src/App.tsx
git commit -m "feat(web): Cognito login branch, Settings invite panel, accept-invite screen + route"
```

---

## Phase F5 — Auth verification

### Task 12: Verify NoAuth unaffected + Cognito path (fakes/manual)

- [ ] **Step 1: NoAuth regression — full unit suite green**

Run: `pnpm --filter @acm/shared test && pnpm --filter @acm/api test`
Expected: all green; `no-auth.provider.spec.ts`, `cognito.provider.spec.ts`, `auth-provider.factory.spec.ts`, invitation specs pass.

- [ ] **Step 2: NoAuth E2E unchanged** — with `authProvider="none"`, bring the stack up and confirm existing screens load and `GET /auth/mode` returns `{ mode: "none" }`.

```bash
B=http://localhost:4000/api
curl -s $B/auth/mode
curl -s -X POST $B/invitations -H "Content-Type: application/json" -d '{"email":"new@acm.io","role":"member"}'
curl -s $B/invitations
```
Expected: mode `none`; invitation created (console adapter logs the invite link); list returns it.

- [ ] **Step 3: Accept-invite round-trip (NoAuth)**

```bash
TOKEN=$(curl -s $B/invitations | node -e 'process.stdin.on("data",d=>{const a=JSON.parse(d);console.log(a[0].token||"")})')
curl -s -X POST $B/invitations/accept -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\",\"authProviderUserId\":\"new@acm.io\",\"name\":\"New\"}"
curl -s $B/invitations
```
Expected: accept returns `{memberId}`; the invitation now shows `status: "accepted"`; a new `Member` exists.

> Cognito live verification (real user pool) is a MANUAL step done during Phase I staging — documented in `docs/deploy/PRODUCTION.md`. Unit tests with fakes are the gate for merge.

- [ ] **Step 4: Run `code-reviewer` over EPIC F, then commit any fixes**

```bash
git add -A
git commit -m "test: verify NoAuth regression + invitation round-trip; review fixes"
```

---

## Phase I1 — Production images

### Task 13: Production multi-stage API image

**Files:**
- Modify: `apps/api/Dockerfile`

- [ ] **Step 1: Rewrite `apps/api/Dockerfile` as multi-stage** (builder installs + builds; runtime is slim, prod deps only, runs `migrate deploy` then `node`)

```dockerfile
FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @acm/shared build \
  && pnpm --filter @acm/api exec prisma generate \
  && pnpm --filter @acm/api build \
  && pnpm --filter @acm/api deploy --prod /app

FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app .
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main.js"]
```

> Validate `pnpm deploy --prod` output layout during implementation; if the workspace layout differs, fall back to copying `node_modules` + `dist` + `prisma` + generated client explicitly. The contract is: runtime image has prod deps, the built `dist`, the Prisma schema/migrations, and runs `migrate deploy` before boot.

- [ ] **Step 2: Build the image locally**

Run: `docker build -f apps/api/Dockerfile -t acm-api:local .`
Expected: image builds; size meaningfully smaller than the single-stage image.

- [ ] **Step 3: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "build(api): multi-stage production image (slim runtime + migrate deploy)"
```

---

### Task 14: Production web image (static via nginx)

**Files:**
- Modify: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`

- [ ] **Step 1: Create `apps/web/nginx.conf`** (SPA fallback + `/api` proxy to the api service)

```nginx
server {
  listen 5173;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:4000;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Rewrite `apps/web/Dockerfile` as multi-stage** (build the Vite bundle, serve with nginx — replaces the current `pnpm dev`)

```dockerfile
FROM node:20-alpine AS builder
RUN npm i -g pnpm@9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
ARG VITE_API_URL=/api
ARG VITE_COGNITO_USER_POOL_ID=""
ARG VITE_COGNITO_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID
RUN pnpm --filter @acm/shared build && pnpm --filter @acm/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
```

> Vite env is baked at build time. The prod web image proxies `/api` to the api service, so `VITE_API_URL` defaults to `/api`. Cognito pool/client are public values — safe to bake.

- [ ] **Step 3: Build the image locally**

Run: `docker build -f apps/web/Dockerfile -t acm-web:local .`
Expected: nginx image builds with the static bundle.

- [ ] **Step 4: Commit**

```bash
git add apps/web/Dockerfile apps/web/nginx.conf
git commit -m "build(web): multi-stage production image (Vite build served by nginx + /api proxy)"
```

---

## Phase I2 — Compose, secrets, and prod runtime

### Task 15: Production compose + env template

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.prod.example`

- [ ] **Step 1: Create `docker-compose.prod.yml`** (api + web; DB is external/managed — referenced by `DATABASE_URL`, not run here)

```yaml
services:
  api:
    image: ${API_IMAGE:-acm-api:latest}
    restart: unless-stopped
    env_file: .env.prod
    ports:
      - "4000:4000"

  web:
    image: ${WEB_IMAGE:-acm-web:latest}
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "80:5173"
```

> The managed Postgres is provisioned out-of-band (MANUAL — see PRODUCTION.md). `docker-compose.prod.yml` does NOT run a db container; it connects to `DATABASE_URL`. For a single-box deploy you may optionally add a `db` service, but production uses managed Postgres.

- [ ] **Step 2: Create `.env.prod.example`** (the secrets/config contract — copied to `.env.prod`, never committed)

```bash
# Managed Postgres
DATABASE_URL="postgresql://USER:PASSWORD@db-host:5432/acm_tracker?schema=public"

# App
APP_URL="https://app.example.com"
API_PORT=4000

# Owner seed (first boot)
OWNER_NAME="Harry G."
OWNER_EMAIL="owner@example.com"
OWNER_RATE_PER_HOUR=45

# Auth provider: none | cognito  (also stored in WorkspaceSettings)
AUTH_PROVIDER=cognito
COGNITO_REGION="us-east-1"
COGNITO_USER_POOL_ID="us-east-1_xxxx"
COGNITO_CLIENT_ID="xxxxxxxx"

# Invitation email: console | ses
INVITE_EMAIL=ses
INVITE_FROM_EMAIL="no-reply@example.com"
AWS_REGION="us-east-1"
```

- [ ] **Step 3: Ensure `.env.prod` is git-ignored**

Confirm `.gitignore` covers `.env*` (or add `.env.prod`). Only the `.example` is committed.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml .env.prod.example .gitignore
git commit -m "build: production compose + env/secrets template (managed Postgres, Cognito, SES)"
```

---

### Task 16: Owner seed + WorkspaceSettings auth mode on release

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Make the seed set `authProvider` from env + persist `authConfig`**

Extend the existing `workspaceSettings.upsert` so `authProvider` is `process.env.AUTH_PROVIDER ?? "none"` and, when `cognito`, `authConfig` holds `{ region, userPoolId, clientId }` from env. Keep the owner upsert. Idempotent (safe to re-run on every release).

```typescript
const authProvider = process.env.AUTH_PROVIDER ?? "none";
const authConfig = authProvider === "cognito"
  ? { region: process.env.COGNITO_REGION, userPoolId: process.env.COGNITO_USER_POOL_ID, clientId: process.env.COGNITO_CLIENT_ID }
  : undefined;

await prisma.workspaceSettings.upsert({
  where: { id: 1 },
  update: { authProvider, authConfig },
  create: { id: 1, authProvider, authConfig },
});
```

- [ ] **Step 2: Link the owner to Cognito when configured**

If `OWNER_AUTH_PROVIDER_USER_ID` is set, include it in the owner upsert (`authProviderUserId`) so the seeded owner can log in via Cognito. Otherwise leave it null (NoAuth owner).

- [ ] **Step 3: Build + run the seed against the throwaway DB to confirm idempotency**

Run (temp DB): create as in Task 5, then `AUTH_PROVIDER=cognito COGNITO_REGION=... pnpm --filter @acm/api exec ts-node prisma/seed.ts` twice; confirm no error and one settings row.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(api): seed sets WorkspaceSettings auth mode + optional owner Cognito link"
```

---

## Phase I3 — CI/CD deploy

### Task 17: Build + push images + deploy workflow (gated by unit + e2e)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `deploy.yml`** that runs ONLY after the existing CI job passes, builds + pushes both images to GHCR, then deploys

```yaml
name: Deploy

on:
  push:
    branches: [main]
    tags: ["v*"]

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  images:
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build + push API
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/api:${{ github.sha }}
      - name: Build + push web
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/web:${{ github.sha }}
          build-args: |
            VITE_API_URL=/api
            VITE_COGNITO_USER_POOL_ID=${{ secrets.VITE_COGNITO_USER_POOL_ID }}
            VITE_COGNITO_CLIENT_ID=${{ secrets.VITE_COGNITO_CLIENT_ID }}

  deploy:
    needs: images
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/acm-tracker
            export API_IMAGE=ghcr.io/${{ github.repository }}/api:${{ github.sha }}
            export WEB_IMAGE=ghcr.io/${{ github.repository }}/web:${{ github.sha }}
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml run --rm api node node_modules/prisma/build/index.js migrate deploy
```

> The `ci` reusable-workflow call reuses the existing unit + e2e gate (`ci.yml`). If `ci.yml` is not yet a reusable workflow (`workflow_call`), add `on: workflow_call:` to it as a minimal, additive change. Deploy runs ONLY if `ci` and `images` succeed — this is the automated pre-flight.

- [ ] **Step 2: (MANUAL) Configure GitHub secrets/environment**

Document required repo/environment secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`. `GITHUB_TOKEN` is automatic. These are set by a human in repo settings — list them in PRODUCTION.md.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/ci.yml
git commit -m "ci: deploy workflow (build+push GHCR images, SSH compose deploy) gated by CI"
```

---

## Phase I4 — Production runbook (manual setup, pre-flight, rollback)

### Task 18: PRODUCTION.md — domain/TLS, manual setup, checklist, rollback

**Files:**
- Create: `docs/deploy/PRODUCTION.md`

- [ ] **Step 1: Write the MANUAL one-time setup section**

Document, as ordered manual steps: (a) provision **managed Postgres** (e.g. RDS/Neon/Supabase) → capture `DATABASE_URL`; (b) create an **AWS Cognito** user pool + app client (no secret, SRP enabled) → capture region/poolId/clientId; create the owner user and capture its `sub` for `OWNER_AUTH_PROVIDER_USER_ID`; (c) verify an **SES** sender identity for `INVITE_FROM_EMAIL`; (d) point a **domain + TLS** at the box — terminate TLS with a reverse proxy (Caddy/Traefik/nginx) or a managed LB in front of the `web` container on :80; (e) set GitHub secrets (Task 17 Step 2); (f) on the box: `git clone` to `/opt/acm-tracker`, copy `.env.prod.example` → `.env.prod`, fill secrets, `docker login ghcr.io`.

- [ ] **Step 2: Write the AUTOMATED-on-release section** — what `deploy.yml` does: builds/pushes images, pulls + `up -d`, runs `prisma migrate deploy`. Owner/settings seed runs on first boot (or as a one-off `docker compose run --rm api pnpm seed`).

- [ ] **Step 3: Write the pre-flight checklist**

A literal checklist to verify before promoting a deploy: unit + e2e green in CI (already gating); `DATABASE_URL` reachable; Cognito pool/client correct; `WorkspaceSettings.authProvider` matches intent; SES sender verified; a smoke `GET /api/auth/mode` returns the expected mode; web loads over TLS.

- [ ] **Step 4: Write the rollback note**

Images are tagged by `${{ github.sha }}`. To roll back: SSH to the box, set `API_IMAGE`/`WEB_IMAGE` to the previous good SHA, `docker compose -f docker-compose.prod.yml up -d`. DB migrations are forward-only; if a migration must be reverted, restore from the managed-Postgres point-in-time/backup before redeploying the prior image. Note that switching `authProvider` requires re-seed + API restart.

- [ ] **Step 5: Commit**

```bash
git add docs/deploy/PRODUCTION.md
git commit -m "docs(deploy): production runbook — manual setup, pre-flight, rollback"
```

---

## Self-Review (completed by plan author)

- **Scope coverage (EPIC F):** Cognito adapter implementing the existing `AuthProvider` port (Task 3) ✔; JWT verification via `aws-jwt-verify` (Task 2) ✔; provider selection from `WorkspaceSettings.authProvider` via factory, NoAuth stays default — open/closed, stable files untouched (Task 4) ✔; enforcing guard (Task 4) ✔; `Invitation` model + migration (Task 5) ✔; create/list/accept RESTful endpoints (Tasks 7-8) ✔; email via notification port (console dev / SES prod) (Tasks 6, 8) ✔; Cognito login + invite UI + accept-invite (Tasks 9-11) ✔; guard/selection unit tests with fakes (Tasks 3-4, 7) ✔. **(EPIC I):** multi-stage api + web images (Tasks 13-14) ✔; `docker-compose.prod` (Task 15) ✔; env/secrets + managed Postgres + Cognito + owner seed (Tasks 15-16) ✔; `migrate deploy` on release (Tasks 13, 17) ✔; web served by nginx behind `/api` (Task 14) ✔; domain + TLS note (Task 18) ✔; CI/CD deploy workflow gated by unit+e2e (Task 17) ✔; pre-flight + rollback (Task 18) ✔; MANUAL vs AUTOMATED callouts (Tasks 15-18) ✔. OUT-of-scope items deliberately excluded.
- **Sequencing:** EPIC F (Phases F1–F5) precedes EPIC I (Phases I1–I4) — auth exists before multi-user prod is exposed.
- **Placeholders:** none — every code step has full code or a precise, bounded instruction.
- **Type consistency:** `Invitation`, `InvitationStatus`, `AuthProviderMode` (Task 1) reused verbatim in api (Tasks 6-8) and web (Tasks 9-11). Port tokens (`AUTH_PROVIDER` existing; `INVITATION_REPOSITORY`, `NOTIFICATION_SENDER`, `MEMBER_LINK`) consistent across port, use case, and module. REST routes obey ≤2-level nesting (`/invitations`, `/invitations/accept`, `/auth/mode`).
- **Architecture:** auth extended via a new adapter + factory only — `auth-provider.interface.ts` and `no-auth.provider.ts` unchanged (open/closed, SOLID-D). `invitations` follows domain/application/infrastructure/interfaces; use cases depend on ports; Prisma only in adapters; email behind a port; controllers thin. Frontend: server state via TanStack Query with invalidation; bearer token attached centrally; screens consume hooks. Deploy artifacts carry no app logic.

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task (use backend-architect / frontend-architect / db-schema-guardian), review between tasks with code-reviewer. Do EPIC F fully (Phases F1–F5) before EPIC I.
2. **Inline Execution** — execute tasks in this session with checkpoints.
