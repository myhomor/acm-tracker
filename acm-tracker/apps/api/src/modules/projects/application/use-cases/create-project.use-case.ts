import { Inject, Injectable } from "@nestjs/common";
import type { Project } from "@acm/shared";
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from "../../domain/ports/project.repository.port";
import { CreateProjectDto } from "../../interfaces/http/dto/create-project.dto";

@Injectable()
export class CreateProjectUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repo: ProjectRepositoryPort) {}

  execute(dto: CreateProjectDto): Promise<Project> {
    return this.repo.create({
      name: dto.name,
      client: dto.client ?? null,
      contractAmount: dto.contractAmount ?? null,
      estimateHours: dto.estimateHours ?? null,
      ratePerHour: dto.ratePerHour ?? null,
    });
  }
}
