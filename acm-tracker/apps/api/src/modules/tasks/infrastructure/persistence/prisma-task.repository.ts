import { Injectable } from "@nestjs/common";
import type { Task } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateTaskData,
  TaskRepositoryPort,
  UpdateTaskData,
} from "../../domain/ports/task.repository.port";
import { toDomainTask } from "./task.mapper";

@Injectable()
export class PrismaTaskRepository implements TaskRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTaskData): Promise<Task> {
    const row = await this.prisma.task.create({ data });
    return toDomainTask(row);
  }

  async findAll(projectId?: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomainTask);
  }

  async update(id: string, data: UpdateTaskData): Promise<Task> {
    const row = await this.prisma.task.update({ where: { id }, data });
    return toDomainTask(row);
  }
}
