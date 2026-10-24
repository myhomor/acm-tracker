import { Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
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
    if (!created) throw new InternalServerErrorException("Timer session not created");
    return created;
  }
}
