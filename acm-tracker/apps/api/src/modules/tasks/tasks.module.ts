import { Module } from "@nestjs/common";
import { TASK_REPOSITORY } from "./domain/ports/task.repository.port";
import { CreateTaskUseCase } from "./application/use-cases/create-task.use-case";
import { ListTasksUseCase } from "./application/use-cases/list-tasks.use-case";
import { UpdateTaskUseCase } from "./application/use-cases/update-task.use-case";
import { PrismaTaskRepository } from "./infrastructure/persistence/prisma-task.repository";
import { TasksController } from "./interfaces/http/tasks.controller";

@Module({
  controllers: [TasksController],
  providers: [
    CreateTaskUseCase,
    ListTasksUseCase,
    UpdateTaskUseCase,
    { provide: TASK_REPOSITORY, useClass: PrismaTaskRepository },
  ],
})
export class TasksModule {}
