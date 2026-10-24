import { Inject, Injectable } from "@nestjs/common";
import type { Task } from "@acm/shared";
import { TASK_REPOSITORY, TaskRepositoryPort } from "../../domain/ports/task.repository.port";
import { UpdateTaskDto } from "../../interfaces/http/dto/update-task.dto";

@Injectable()
export class UpdateTaskUseCase {
  constructor(@Inject(TASK_REPOSITORY) private readonly repo: TaskRepositoryPort) {}

  execute(id: string, dto: UpdateTaskDto): Promise<Task> {
    return this.repo.update(id, dto);
  }
}
