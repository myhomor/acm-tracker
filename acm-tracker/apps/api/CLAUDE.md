# apps/api — Backend (NestJS, Hexagonal)

Ports & adapters. The domain knows nothing about Nest or Prisma.

## Layers (per feature module)

```
src/modules/<feature>/
├── domain/
│   ├── <entity>.entity.ts          # pure class/type, business invariants, no decorators
│   └── ports/
│       ├── <feature>.repository.port.ts   # interface (e.g. ProjectRepositoryPort)
│       └── <other>.port.ts                # other outbound ports if needed
├── application/
│   └── use-cases/
│       ├── create-<feature>.use-case.ts   # one class, one execute() method
│       ├── list-<feature>.use-case.ts
│       └── ...                             # one file per use case
├── infrastructure/
│   └── persistence/
│       ├── prisma-<feature>.repository.ts  # implements the port, uses PrismaService
│       └── <feature>.mapper.ts             # Prisma row <-> domain entity
└── interfaces/
    └── http/
        ├── <feature>.controller.ts         # thin; injects use cases
        └── dto/
            ├── create-<feature>.dto.ts
            └── update-<feature>.dto.ts
```

`<feature>.module.ts` wires it: binds each port token to its adapter, registers use cases + controller.

## Dependency rules (enforced)

- `domain/` imports nothing from `application`, `infrastructure`, `interfaces`, Nest, or Prisma. Pure TS + `@acm/shared`.
- `application/` imports only `domain/` (entities + ports). Use cases receive ports via constructor injection (interface, not concrete).
- `infrastructure/` implements ports. The ONLY place `@prisma/client` / `PrismaService` appears.
- `interfaces/` (controllers) call use cases. No business logic, no Prisma.

## Port binding pattern

```typescript
// domain/ports/project.repository.port.ts
export const PROJECT_REPOSITORY = Symbol("PROJECT_REPOSITORY");
export interface ProjectRepositoryPort {
  create(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
}

// application/use-cases/create-project.use-case.ts
@Injectable()
export class CreateProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepositoryPort) {}
  execute(input: CreateProjectInput): Promise<Project> { /* one job */ }
}

// <feature>.module.ts
{ provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository }
```

## Rules

- One use case = one class with a single `execute()`. No "service god-objects".
- Mappers isolate Prisma shape from the domain entity. Domain entities never carry Prisma types.
- Controllers: validate DTO → `useCase.execute()` → return. Max ~5 lines per handler.
- REST + status codes + 2-level nesting per root `CLAUDE.md`.
- Auth via the pluggable `AuthProvider` port (see auth module). v1 = NoAuth adapter.
- Tests: use cases unit-tested with in-memory fake adapters implementing the port; controllers covered by e2e.

## DB backends (Postgres source-of-truth, SQLite mirror)

Two Prisma datasources back the same hexagonal domain. **Postgres is the source of truth** (`prisma/schema.prisma`, `provider = "postgresql"`, migrations under `prisma/migrations/`). **SQLite is a lite mirror** (`prisma/sqlite/schema.prisma`, `provider = "sqlite"`, migrations under `prisma/sqlite/migrations/`) for the single-user / no-server distribution (`DATABASE_URL="file:./acm.db"`). The mirror lives in its own `prisma/sqlite/` directory so Prisma resolves its migration set separately from the Postgres one. The mirror is kept in lockstep with the source; a drift check fails CI if entities/fields diverge.

### Commands

- **Drift check:** `pnpm --filter @acm/api db:drift-check` (runs `prisma/drift-check.ts`). Exits non-zero on any model/field divergence; the only tolerated delta is `WorkspaceSettings.authConfig` (`Json` ↔ `String`). Run it in CI and after any edit to either schema.
- **Local SQLite migrate (throwaway):** `DATABASE_URL="file:./tmp/acm.db" pnpm --filter @acm/api prisma:sqlite:migrate` applies the mirror migrations to a local file. Use `prisma:sqlite:migrate:dev` to author a new mirror migration. Never point these at a remote URL.
- **Regenerating the mirror migration:** author against a local `file:` tmp DB only, then delete the tmp DB. Editing applied migration SQL is forbidden (guardian rule).

### Known Prisma quirk

`WorkspaceSettings.id` (`Int @id @default(1)`) renders in SQLite DDL as `INTEGER PRIMARY KEY AUTOINCREMENT DEFAULT 1`. This is a Prisma SQLite artifact for integer primary keys; it is harmless because the row is a singleton always written via `upsert({ where: { id: 1 } })`. Left as Prisma-generated to keep the migration faithful and unedited.

Normalization happens at the **adapter edge only** (`infrastructure/persistence/*.mapper.ts`). Domain entities, use cases, and `@acm/shared` never change for the DB backend — they already speak a backend-neutral shape, so today the mappers need **zero** backend-specific branching. The per-field decisions below are the contract that keeps it that way.

### Per-field decisions

| Schema concern | Postgres (truth) | SQLite (mirror) | Adapter rule |
| --- | --- | --- | --- |
| **Money** (`ratePerHour`, `contractAmount`, `costUsd`, `inputPer1M`, `outputPer1M`, `ratePerHourSnapshot`) | `Float` | `Float` (REAL) | **Keep `Float`. Do NOT migrate to integer-cents.** No mapper change. |
| **`Json`** (`WorkspaceSettings.authConfig`) | `Json?` | `String?` (serialized) | Mirror declares `String?`. The `WorkspaceSettings` mapper `JSON.parse`/`JSON.stringify` at the edge so the domain sees a structured object on both backends. |
| **`cuid()` ids** | `@default(cuid())` | `@default(cuid())` | Prisma-Client-side default; identical on both. No change. |
| **`DateTime`** | `timestamp` | `DATETIME` (stored as ISO/Julian) | Prisma returns a JS `Date` on both; mappers already call `.toISOString()`. No change. |
| **`Int` ids** (`WorkspaceSettings.id @default(1)`) | `Int @id @default(1)` | same | Literal default `1` (singleton row), no autoincrement involved. No change. |
| **Indexes / `@@unique`** (`Member.email`, `Task [projectId, code]`, `ModelPrice [provider, model]`, `@@index` on FKs) | as declared | **mirror byte-for-byte** | The drift check asserts these match. |
| **`onDelete: Cascade`** (`Task→Project`, `TimeEntry→Task`, `AiRun→TimeEntry`) | as declared | same | SQLite enforces FKs only with `PRAGMA foreign_keys=ON` (Prisma sets it per-connection). Mirror keeps the same `onDelete`. |
| **`String`-as-enum** (`origin`, `status`, `role`, `kind`, `authProvider`, …) | `String @default(...)` | same | Already strings on both; values validated in DTOs/use cases, not the DB. No change. |

### Money: integer-cents vs Float — decision

**Decision: keep `Float`.** Rationale and trade-offs:

- The domain contract (`@acm/shared` `types.ts`) types every money field as `number` (float-dollars), and the cost math (`computeEntryCost`, `sumCost`, `aiCostFromUsage`) computes in float-dollars with a `round2` helper. Postgres **already** stores these as `Float`, not `Decimal`. SQLite `REAL` is the same IEEE-754 double as Postgres `double precision` and JS `number`, so values **round-trip identically** across both backends with no conversion.
- Switching to integer-cents would be a **domain-and-shared change**, not an adapter change: it would force new `* 100` / `/ 100` conversions in every money mapper, a rewrite of the cost functions in `packages/shared`, and updated tests — directly violating "domain/use-cases must not change" for this task. It would buy exact-decimal arithmetic the product does not currently need (rates/costs are already `round2`-rounded display values, not summed-millions ledgers).
- Trade-off accepted: floats carry the usual binary-fraction imprecision. This is bounded by the existing `round2` at every cost boundary and is **identical on both backends** (same IEEE-754), so it introduces no Postgres-vs-SQLite divergence. If exact decimal money is ever required, that is a deliberate future migration on the Postgres source-of-truth first (Float→Decimal + integer-cents in shared), then mirrored — out of scope here.

### Json (`authConfig`) — decision

SQLite has no native `Json` Prisma type. The mirror declares `authConfig String?` holding a serialized JSON document. Normalization is confined to the **`WorkspaceSettings` mapper**: `JSON.parse(row.authConfig)` on read, `JSON.stringify(value)` on write, with `null` passthrough. The domain entity carries a structured object identically on both backends; no use case observes the serialization. (No code reads/writes `authConfig` yet, so this is the forward contract for when auth config lands.)

### Postgres-only features

None are in use. The schema uses no `@db.*` native-type attributes, no native `enum`, no array/`Json[]`/`citext`/`tsvector`/partial indexes. The only Postgres-vs-SQLite type gap is `Json` (handled above). If a Postgres-only feature is ever added to the source-of-truth, it must come with its SQLite mirror representation + adapter normalization in the same change, or the drift check will fail.
