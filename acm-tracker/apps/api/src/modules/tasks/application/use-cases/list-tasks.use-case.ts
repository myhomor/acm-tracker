import { Inject, Injectable } from "@nestjs/common";
import type { Task } from "@acm/shared";
import { TASK_REPOSITORY, TaskRepositoryPort } from "../../domain/ports/task.repository.port";

@Injectable()
export class ListTasksUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly repo: TaskRepositoryPort) {}

  execute(projectId?: string): Promise<Task[]> {
    return this.repo.findAll(projectId);
  }
}
