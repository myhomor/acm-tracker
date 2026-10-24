import { Module } from "@nestjs/common";
import { TIME_ENTRY_REPOSITORY } from "./domain/ports/time-entry.repository.port";
import { MEMBER_RATE_READER } from "./domain/ports/member-rate.port";
import { CreateManualEntryUseCase } from "./application/use-cases/create-manual-entry.use-case";
import { ListTaskEntriesUseCase } from "./application/use-cases/list-task-entries.use-case";
import { ListProjectEntriesUseCase } from "./application/use-cases/list-project-entries.use-case";
import { ListTodayEntriesUseCase } from "./application/use-cases/list-today-entries.use-case";
import { TaskCostUseCase } from "./application/use-cases/task-cost.use-case";
import { PrismaTimeEntryRepository } from "./infrastructure/persistence/prisma-time-entry.repository";
import { PrismaMemberRateReader } from "./infrastructure/persistence/prisma-member-rate.reader";
import { TimeEntriesController } from "./interfaces/http/time-entries.controller";

@Module({
  controllers: [TimeEntriesController],
  providers: [
    CreateManualEntryUseCase,
    ListTaskEntriesUseCase,
    ListProjectEntriesUseCase,
    ListTodayEntriesUseCase,
    TaskCostUseCase,
    { provide: TIME_ENTRY_REPOSITORY, useClass: PrismaTimeEntryRepository },
    { provide: MEMBER_RATE_READER, useClass: PrismaMemberRateReader },
  ],
})
export class TimeEntriesModule {}
