# ACM-TRACKER — Engineering Contract

These rules are **non-negotiable**. They override defaults. Any code that violates them is rejected in review.

## Golden rules

1. **Reuse before you create.** Before writing a component, hook, service, use case, or util — search for an existing one and use/extend it. Never re-implement what exists. Shared UI lives in `apps/web/src/components`; shared logic in `packages/shared` and per-feature `lib/`.
2. **One responsibility per unit.** Each file, class, function, and component does one thing. If you can't name it in 3 words, split it.
3. **Small functions.** A function fits on one screen (~40 lines max). A method with branching that grows past that gets extracted. No giant methods.
4. **No dead weight.** No commented-out code, no `console.log` left behind, no unused imports/vars, no "just in case" abstractions (YAGNI). Delete, don't comment.
5. **Zero-comment policy.** Code explains itself through names. Comments only for non-obvious *why* (a workaround, a business rule with a ticket). Never comment *what* the code does. No JSDoc walls, no banner comments.
6. **No improvisation.** Follow the architecture below exactly. New patterns require updating this file first, then the code.

## Architecture (must follow)

- **Backend = Hexagonal (ports & adapters).** See `apps/api/CLAUDE.md`. Domain is pure (no Prisma, no Nest decorators). Use cases depend on **ports** (interfaces); infrastructure provides **adapters**. Dependency inversion is mandatory (SOLID-D).
- **Frontend = reactive + decoupled.** See `apps/web/CLAUDE.md`. Server state via **TanStack Query**; UI state via **Zustand**. Reusable presentational components in `components/` are decoupled from data — they receive props, never fetch.
- **Shared contract** = `packages/shared` (types + pure functions, zero framework deps). Cost math lives here once; both sides import it.

## REST conventions (backend)

- Resource nouns, plural: `/projects`, `/members`, `/tasks`, `/time-entries`.
- Nesting **max 2 levels**: `/projects/:id/tasks` ✓ — `/projects/:id/tasks/:tid/entries` ✗ (flatten to `/tasks/:id/entries`).
- HTTP verbs carry intent: `GET` (read), `POST` (create), `PATCH` (partial update), `PUT` (replace), `DELETE`. Never `/getX`, `/createX` in paths.
- Status codes: 200/201/204 success, 400 validation, 401/403 auth, 404 missing, 409 conflict.
- DTOs validate every input (`class-validator`). Controllers are thin: validate → call use case → map to response. No logic in controllers.

## SOLID checklist (every change)

- **S** one reason to change per unit · **O** extend via new adapters/strategies, not by editing stable code · **L** subtypes honor their interface · **I** small focused ports, not fat interfaces · **D** depend on ports, never on concretes.

## Testing

- TDD: failing test → minimal code → green → commit. Domain/use cases unit-tested with mocked ports. No test = not done.

## Commits

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). One logical change per commit. Commit frequently.

## When working in this repo

- For backend work, delegate to the **backend-architect** agent. For frontend, **frontend-architect**. For Prisma/migrations, **db-schema-guardian**. Before merging, run **code-reviewer**.
- Use the project skills (`.claude/skills`) for the canonical way to add a backend feature or a frontend feature — do not hand-roll structure.
