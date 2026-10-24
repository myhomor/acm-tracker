import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CurrentUser } from "../../../../auth/current-user.decorator";
import type { AuthedUser } from "../../../../auth/auth-provider.interface";
import { StartTimerUseCase } from "../../application/use-cases/start-timer.use-case";
import { StopTimerUseCase } from "../../application/use-cases/stop-timer.use-case";
import { GetActiveTimerUseCase } from "../../application/use-cases/get-active-timer.use-case";
import { StartTimerDto } from "./dto/start-timer.dto";

@UseGuards(AuthGuard)
@Controller("timer")
export class TimerController {
  constructor(
    private readonly startTimer: StartTimerUseCase,
    private readonly stopTimer: StopTimerUseCase,
    private readonly getActive: GetActiveTimerUseCase,
  ) {}

  @Post("start") start(@CurrentUser() user: AuthedUser, @Body() dto: StartTimerDto) {
    return this.startTimer.execute(user.memberId, dto.taskId);
  }

  @Post("stop") stop(@CurrentUser() user: AuthedUser) {
    return this.stopTimer.execute(user.memberId);
  }

  @Get("active") active(@CurrentUser() user: AuthedUser) {
    return this.getActive.execute(user.memberId);
  }
}
