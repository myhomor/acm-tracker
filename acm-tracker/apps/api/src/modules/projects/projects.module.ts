import { Module } from "@nestjs/common";
import { PROJECT_REPOSITORY } from "./domain/ports/project.repository.port";
import { CreateProjectUseCase } from "./application/use-cases/create-project.use-case";
import { ListProjectsUseCase } from "./application/use-cases/list-projects.use-case";
import { GetProjectUseCase } from "./application/use-cases/get-project.use-case";
import { UpdateProjectUseCase } from "./application/use-cases/update-project.use-case";
import { PrismaProjectRepository } from "./infrastructure/persistence/prisma-project.repository";
import { ProjectsController } from "./interfaces/http/projects.controller";

@Module({
  controllers: [ProjectsController],
  providers: [
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    UpdateProjectUseCase,
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
  ],
})
export class ProjectsModule {}
