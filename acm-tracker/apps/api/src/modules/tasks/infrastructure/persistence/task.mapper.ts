import type { Task as PrismaTask } from "@prisma/client";
import type { Task } from "@acm/shared";

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
