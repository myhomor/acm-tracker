import { Inject, Injectable } from "@nestjs/common";
import { ActiveTimerView, TIMER_SESSION, TimerSessionPort } from "../../domain/ports/timer-session.port";

@Injectable()
export class GetActiveTimerUseCase {
  constructor(@Inject(TIMER_SESSION) private readonly sessions: TimerSessionPort) {}

  execute(memberId: string): Promise<ActiveTimerView | null> {
    return this.sessions.findActive(memberId);
  }
}
