import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import { TIMER_SESSION, TimerSessionPort } from "../../domain/ports/timer-session.port";
import {
  TIME_ENTRY_REPOSITORY,
  TimeEntryRepositoryPort,
} from "../../../time-entries/domain/ports/time-entry.repository.port";

@Injectable()
export class StopTimerUseCase {
  constructor(
    @Inject(TIMER_SESSION) private readonly sessions: TimerSessionPort,
    @Inject(TIME_ENTRY_REPOSITORY) private readonly entries: TimeEntryRepositoryPort,
  ) {}

  async execute(memberId: string): Promise<TimeEntry> {
    const active = await this.sessions.findActive(memberId);
    if (!active) throw new NotFoundException("No active timer");
    const cleared = await this.sessions.clear(memberId);
    if (cleared === 0) throw new NotFoundException("No active timer");
    const startedAt = new Date(active.startedAt);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60_000));
    return this.entries.create({
      taskId: active.taskId,
      memberId,
      origin: "timer",
      minutes,
      billable: true,
      ratePerHourSnapshot: active.ratePerHour,
      note: null,
      startedAt,
    });
  }
}
