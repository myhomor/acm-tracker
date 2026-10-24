import type { Project as PrismaProject, Task as PrismaTask } from "@prisma/client";
import type { Project, Task } from "@acm/shared";

export function toDomainTask(row: PrismaTask): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    title: row.title,
    phase: row.phase,
    summary: row.summary,
    status: row.status as Task["status"],
    estimateMinutes: row.estimateMinutes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDomainProject(row: PrismaProject): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    contractAmount: row.contractAmount,
    estimateHours: row.estimateHours,
    ratePerHour: row.ratePerHour,
    status: row.status as Project["status"],
    createdAt: row.createdAt.toISOString(),
  };
}
