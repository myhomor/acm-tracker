import { Inject, Injectable } from "@nestjs/common";
import type { Project } from "@acm/shared";
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from "../../domain/ports/project.repository.port";
import { UpdateProjectDto } from "../../interfaces/http/dto/update-project.dto";

@Injectable()
export class UpdateProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepositoryPort) {}

  execute(id: string, dto: UpdateProjectDto): Promise<Project> {
    return this.repo.update(id, dto);
  }
}
