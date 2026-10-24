import type { TimeEntry as PrismaTimeEntry } from "@prisma/client";
import type { TimeEntry } from "@acm/shared";

export function toDomainTimeEntry(row: PrismaTimeEntry): TimeEntry {
  return {
    id: row.id,
    taskId: row.taskId,
    memberId: row.memberId,
    origin: row.origin as TimeEntry["origin"],
    minutes: row.minutes,
    billable: row.billable,
    ratePerHourSnapshot: row.ratePerHourSnapshot,
    note: row.note,
    startedAt: row.startedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
