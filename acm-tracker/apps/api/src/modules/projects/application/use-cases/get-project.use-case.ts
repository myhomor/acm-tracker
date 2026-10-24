import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  PROJECT_REPOSITORY,
  ProjectRepositoryPort,
  ProjectWithTasks,
} from "../../domain/ports/project.repository.port";

@Injectable()
export class GetProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepositoryPort) {}

  async execute(id: string): Promise<ProjectWithTasks> {
    const project = await this.repo.findById(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }
}
