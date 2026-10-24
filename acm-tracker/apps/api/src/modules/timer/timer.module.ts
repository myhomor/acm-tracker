import { Module } from "@nestjs/common";
import { TIMER_SESSION } from "./domain/ports/timer-session.port";
import { TIME_ENTRY_REPOSITORY } from "../time-entries/domain/ports/time-entry.repository.port";
import { PrismaTimeEntryRepository } from "../time-entries/infrastructure/persistence/prisma-time-entry.repository";
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
  ],
})
export class TimerModule {}
