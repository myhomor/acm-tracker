import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateTaskUseCase } from "../../application/use-cases/create-task.use-case";
import { ListTasksUseCase } from "../../application/use-cases/list-tasks.use-case";
import { UpdateTaskUseCase } from "../../application/use-cases/update-task.use-case";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@UseGuards(AuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(
    private readonly createTask: CreateTaskUseCase,
    private readonly listTasks: ListTasksUseCase,
    private readonly updateTask: UpdateTaskUseCase,
  ) {}

  @Post() create(@Body() dto: CreateTaskDto) {
    return this.createTask.execute(dto);
  }

  @Get() findAll(@Query("projectId") projectId?: string) {
    return this.listTasks.execute(projectId);
  }

  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.updateTask.execute(id, dto);
  }
}
