---
name: add-backend-feature
description: Canonical recipe for adding or extending a NestJS feature in apps/api following hexagonal architecture (ports & adapters), SOLID, RESTful. Use whenever creating a new resource/module or a new use case/endpoint in the backend so structure is never improvised.
---

# Add a backend feature (hexagonal)

Follow these steps in order. Reuse before creating at every step.

## 0. Reuse check
Grep for an existing entity, port, use case, mapper, or DTO that covers the need. If one exists, extend it and stop here. Only proceed to create when nothing fits.

## 1. Domain (pure)
`src/modules/<feature>/domain/<entity>.entity.ts` — a plain class/type holding fields + invariants. No Nest decorators, no Prisma. May import `@acm/shared`.

`src/modules/<feature>/domain/ports/<feature>.repository.port.ts`:
```typescript
export const <FEATURE>_REPOSITORY = Symbol("<FEATURE>_REPOSITORY");
export interface <Feature>RepositoryPort {
  create(e: <Entity>): Promise<<Entity>>;
  findById(id: string): Promise<<Entity> | null>;
  findAll(filter?: <Filter>): Promise<<Entity>[]>;
}
```

## 2. Application (use cases)
One class per action under `application/use-cases/`, single `execute()`, depends on the port:
```typescript
@Injectable()
export class Create<Feature>UseCase {
  constructor(@Inject(<FEATURE>_REPOSITORY) private readonly repo: <Feature>RepositoryPort) {}
  execute(input: Create<Feature>Input): Promise<<Entity>> { /* one job, <40 lines */ }
}
```

## 3. Infrastructure (adapter)
`infrastructure/persistence/prisma-<feature>.repository.ts` implements the port using `PrismaService`. `infrastructure/persistence/<feature>.mapper.ts` converts Prisma row ↔ domain entity. Prisma appears ONLY here.

## 4. Interfaces (HTTP)
`interfaces/http/dto/*.dto.ts` — class-validator on every field.
`interfaces/http/<feature>.controller.ts` — thin handlers:
```typescript
@UseGuards(AuthGuard)
@Controller("<features>")
export class <Feature>Controller {
  constructor(private readonly create: Create<Feature>UseCase, private readonly list: List<Feature>UseCase) {}
  @Post() createOne(@Body() dto: Create<Feature>Dto) { return this.create.execute(dto); }
  @Get() findAll() { return this.list.execute(); }
}
```
Routes: plural noun, ≤2-level nesting, correct verb + status.

## 5. Module wiring
```typescript
@Module({
  controllers: [<Feature>Controller],
  providers: [
    Create<Feature>UseCase, List<Feature>UseCase,
    { provide: <FEATURE>_REPOSITORY, useClass: Prisma<Feature>Repository },
  ],
})
export class <Feature>Module {}
```
Register it in `app.module.ts`.

## 6. Tests (TDD)
Unit-test each use case with an in-memory fake implementing the port. Add an e2e for the controller. Failing test first, then code.

## 7. Review
Hand the diff to the **code-reviewer** agent. Fix every VIOLATION before commit.
