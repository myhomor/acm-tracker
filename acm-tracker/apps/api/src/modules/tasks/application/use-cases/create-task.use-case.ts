import { Inject, Injectable } from "@nestjs/common";
import type { Task } from "@acm/shared";
import { TASK_REPOSITORY, TaskRepositoryPort } from "../../domain/ports/task.repository.port";
import { CreateTaskDto } from "../../interfaces/http/dto/create-task.dto";

@Injectable()
export class CreateTaskUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly repo: TaskRepositoryPort) {}

  execute(dto: CreateTaskDto): Promise<Task> {
    return this.repo.create({
      projectId: dto.projectId,
      code: dto.code,
      title: dto.title,
      phase: dto.phase ?? null,
      estimateMinutes: dto.estimateMinutes ?? null,
    });
  }
}
