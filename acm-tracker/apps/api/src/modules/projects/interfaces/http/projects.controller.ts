import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateProjectUseCase } from "../../application/use-cases/create-project.use-case";
import { ListProjectsUseCase } from "../../application/use-cases/list-projects.use-case";
import { GetProjectUseCase } from "../../application/use-cases/get-project.use-case";
import { UpdateProjectUseCase } from "../../application/use-cases/update-project.use-case";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
    private readonly getProject: GetProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
  ) {}

  @Post() create(@Body() dto: CreateProjectDto) {
    return this.createProject.execute(dto);
  }

  @Get() findAll() {
    return this.listProjects.execute();
  }

  @Get(":id") findOne(@Param("id") id: string) {
    return this.getProject.execute(id);
  }

  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.updateProject.execute(id, dto);
  }
}
