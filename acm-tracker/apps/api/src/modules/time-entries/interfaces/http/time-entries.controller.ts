import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { localDayBounds } from "@acm/shared";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CurrentUser } from "../../../../auth/current-user.decorator";
import type { AuthedUser } from "../../../../auth/auth-provider.interface";
import { CreateManualEntryUseCase } from "../../application/use-cases/create-manual-entry.use-case";
import { ListTaskEntriesUseCase } from "../../application/use-cases/list-task-entries.use-case";
import { ListProjectEntriesUseCase } from "../../application/use-cases/list-project-entries.use-case";
import { ListTodayEntriesUseCase } from "../../application/use-cases/list-today-entries.use-case";
import { TaskCostUseCase } from "../../application/use-cases/task-cost.use-case";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";

function dayBounds(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 86_400_000);
  return { from, to };
}

@UseGuards(AuthGuard)
@Controller("time-entries")
export class TimeEntriesController {
  constructor(
    private readonly createManual: CreateManualEntryUseCase,
    private readonly listForTask: ListTaskEntriesUseCase,
    private readonly listForProject: ListProjectEntriesUseCase,
    private readonly listToday: ListTodayEntriesUseCase,
    private readonly taskCost: TaskCostUseCase,
  ) {}

  @Post() create(@CurrentUser() user: AuthedUser, @Body() dto: CreateTimeEntryDto) {
    return this.createManual.execute(user.memberId, dto);
  }

  @Get("today") today() {
    const { from, to } = dayBounds();
    return this.listToday.execute(from, to);
  }

  @Get("day") day(@Query("date") date = "") {
    const bounds = localDayBounds(date);
    if (!bounds) throw new BadRequestException("date must be YYYY-MM-DD");
    return this.listToday.execute(bounds.from, bounds.to);
  }

  @Get("task/:taskId") forTask(@Param("taskId") taskId: string) {
    return this.listForTask.execute(taskId);
  }

  @Get("project/:projectId") forProject(@Param("projectId") projectId: string) {
    return this.listForProject.execute(projectId);
  }

  @Get("task/:taskId/cost") cost(@Param("taskId") taskId: string) {
    return this.taskCost.execute(taskId);
  }
}
