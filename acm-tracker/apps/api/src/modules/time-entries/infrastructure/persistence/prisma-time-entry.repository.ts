import { Injectable } from "@nestjs/common";
import type { TimeEntry } from "@acm/shared";
import { WAIT_ROLE, computeEntryCost, localHourMinute, workKindOfRole } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateTimeEntryData,
  ProjectEntryView,
  TimeEntryRepositoryPort,
  TodayEntryView,
} from "../../domain/ports/time-entry.repository.port";
import { toDomainTimeEntry } from "./time-entry.mapper";

@Injectable()
export class PrismaTimeEntryRepository implements TimeEntryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTimeEntryData): Promise<TimeEntry> {
    const row = await this.prisma.timeEntry.create({ data: { ...data, origin: data.origin ?? "manual" } });
    return toDomainTimeEntry(row);
  }

  async findByTask(taskId: string): Promise<TimeEntry[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { taskId },
      orderBy: { startedAt: "desc" },
    });
    return rows.map(toDomainTimeEntry);
  }

  async waitingMemberIds(): Promise<string[]> {
    const rows = await this.prisma.member.findMany({ where: { role: WAIT_ROLE }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async findByProject(projectId: string): Promise<ProjectEntryView[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { task: { projectId } },
      orderBy: { startedAt: "desc" },
      include: { task: true, member: true },
    });
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      origin: r.origin,
      taskId: r.taskId,
      taskCode: r.task.code,
      taskTitle: r.task.title,
      memberId: r.memberId,
      memberName: r.member.name,
      note: r.note,
      minutes: r.minutes,
      cost: computeEntryCost(r as unknown as TimeEntry),
    }));
  }

  async findToday(from: Date, to: Date): Promise<TodayEntryView[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { startedAt: { gte: from, lt: to } },
      orderBy: { startedAt: "desc" },
      include: { task: true, member: true, aiRuns: true },
    });
    return rows.map((r) => ({
      id: r.id,
      time: localHourMinute(r.startedAt),
      origin: r.origin,
      taskCode: r.task.code,
      taskTitle: r.task.title,
      memberName: r.member.name,
      kind: workKindOfRole(r.member.role),
      note: r.note,
      minutes: r.minutes,
      cost: computeEntryCost(r as unknown as TimeEntry),
      aiCost: Math.round(r.aiRuns.reduce((s, a) => s + a.costUsd, 0) * 100) / 100,
    }));
  }
}
