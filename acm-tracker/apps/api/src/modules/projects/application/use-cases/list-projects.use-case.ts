import { Inject, Injectable } from "@nestjs/common";
import type { Project } from "@acm/shared";
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from "../../domain/ports/project.repository.port";

@Injectable()
export class ListProjectsUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepositoryPort) {}

  execute(): Promise<Project[]> {
    return this.repo.findAll();
  }
}
