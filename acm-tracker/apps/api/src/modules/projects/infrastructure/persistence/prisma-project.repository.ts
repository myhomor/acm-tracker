import { Injectable } from "@nestjs/common";
import type { Project } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateProjectData,
  ProjectRepositoryPort,
  ProjectWithTasks,
  UpdateProjectData,
} from "../../domain/ports/project.repository.port";
import { toDomainProject, toDomainTask } from "./project.mapper";

@Injectable()
export class PrismaProjectRepository implements ProjectRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProjectData): Promise<Project> {
    const row = await this.prisma.project.create({ data });
    return toDomainProject(row);
  }

  async findAll(): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toDomainProject);
  }

  async findById(id: string): Promise<ProjectWithTasks | null> {
    const row = await this.prisma.project.findUnique({ where: { id }, include: { tasks: true } });
    if (!row) return null;
    return { ...toDomainProject(row), tasks: row.tasks.map(toDomainTask) };
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    const row = await this.prisma.project.update({ where: { id }, data });
    return toDomainProject(row);
  }
}
