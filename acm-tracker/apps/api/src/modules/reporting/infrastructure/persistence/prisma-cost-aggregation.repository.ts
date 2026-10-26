import { Injectable } from "@nestjs/common";
import type { PersonCost, TimeEntry, WeeklyCost } from "@acm/shared";
import { WAIT_ROLE, computeEntryCost, workKindOfRole } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CostAggregationPort,
  MarginSummary,
  ProjectCostRow,
  ProjectEstimateRow,
  TeamTodayRow,
  TodaySummary,
} from "../../domain/ports/cost-aggregation.port";
import type { DailyEntryRow } from "../../domain/daily-report";

const round2 = (n: number): number => Math.round(n * 100) / 100;

const isWaiting = (r: { member: { role: string } }): boolean => r.member.role === WAIT_ROLE;
const NOT_WAITING = { member: { role: { not: WAIT_ROLE } } };

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekLabel(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const week = Math.ceil((diffDays + start.getDay() + 1) / 7);
  return `S${week}`;
}

@Injectable()
export class PrismaCostAggregationRepository implements CostAggregationPort {
  constructor(private readonly prisma: PrismaService) {}

  async projectCost(projectId: string): Promise<ProjectCostRow> {
    const rows = await this.prisma.timeEntry.findMany({ where: { task: { projectId } }, include: { aiRuns: true, member: true } });
    let human = 0;
    let ai = 0;
    let minutes = 0;
    let waitMinutes = 0;
    for (const r of rows) {
      human += computeEntryCost(r as unknown as TimeEntry);
      ai += r.aiRuns.reduce((s, a) => s + a.costUsd, 0);
      if (isWaiting(r)) waitMinutes += r.minutes;
      else minutes += r.minutes;
    }
    return { human: round2(human), ai: round2(ai), minutes, waitMinutes };
  }

  async projectEstimate(projectId: string): Promise<ProjectEstimateRow> {
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { estimateHours: true, ratePerHour: true },
    });
    return { estimateHours: row?.estimateHours ?? null, ratePerHour: row?.ratePerHour ?? null };
  }

  async costByPerson(projectId?: string): Promise<PersonCost[]> {
    const members = await this.prisma.member.findMany({ orderBy: { createdAt: "asc" } });
    const result: PersonCost[] = [];
    for (const m of members) {
      const rows = await this.prisma.timeEntry.findMany({
        where: { memberId: m.id, ...(projectId ? { task: { projectId } } : {}) },
        include: { aiRuns: true },
      });
      let human = 0;
      let ai = 0;
      let minutes = 0;
      for (const r of rows) {
        human += computeEntryCost(r as unknown as TimeEntry);
        ai += r.aiRuns.reduce((s, a) => s + a.costUsd, 0);
        minutes += r.minutes;
      }
      result.push({ memberId: m.id, name: m.name, kind: workKindOfRole(m.role), minutes, human: round2(human), ai: round2(ai), total: round2(human + ai) });
    }
    return result;
  }

  async weeklyCost(weeks: number, projectId?: string): Promise<WeeklyCost[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: projectId ? { task: { projectId } } : {},
      orderBy: { startedAt: "asc" },
      include: { aiRuns: true },
    });
    const byWeek = new Map<string, { human: number; ai: number }>();
    for (const r of rows) {
      const acc = byWeek.get(weekLabel(r.startedAt)) ?? { human: 0, ai: 0 };
      acc.human += computeEntryCost(r as unknown as TimeEntry);
      acc.ai += r.aiRuns.reduce((s, a) => s + a.costUsd, 0);
      byWeek.set(weekLabel(r.startedAt), acc);
    }
    return [...byWeek.entries()]
      .slice(-weeks)
      .map(([week, c]) => ({ week, human: round2(c.human), ai: round2(c.ai) }));
  }

  async dailyEntries(from: Date, projectId?: string): Promise<DailyEntryRow[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { startedAt: { gte: from }, ...(projectId ? { task: { projectId } } : {}) },
      include: { aiRuns: true, member: true, task: { include: { project: true } } },
    });
    return rows.map((r) => ({
      day: localDay(r.startedAt),
      kind: workKindOfRole(r.member.role),
      minutes: r.minutes,
      timeCost: computeEntryCost(r as unknown as TimeEntry),
      aiCost: r.aiRuns.reduce((s, a) => s + a.costUsd, 0),
      taskId: r.taskId,
      taskCode: r.task.code,
      taskTitle: r.task.title,
      projectName: r.task.project.name,
    }));
  }

  async todaySummary(from: Date, to: Date, weekFrom: Date): Promise<TodaySummary> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { startedAt: { gte: from, lt: to } },
      include: { aiRuns: true, member: true },
    });
    let cost = 0;
    let tracked = 0;
    let billable = 0;
    let aiCost = 0;
    let waitMinutes = 0;
    for (const r of rows) {
      cost += computeEntryCost(r as unknown as TimeEntry);
      aiCost += r.aiRuns.reduce((s, a) => s + a.costUsd, 0);
      if (isWaiting(r)) {
        waitMinutes += r.minutes;
        continue;
      }
      tracked += r.minutes;
      if (r.billable) billable += r.minutes;
    }
    const week = await this.prisma.timeEntry.aggregate({
      _sum: { minutes: true },
      where: { startedAt: { gte: weekFrom, lt: to }, ...NOT_WAITING },
    });
    return {
      trackedMinutes: tracked,
      billableMinutes: billable,
      cost: round2(cost),
      aiCost: round2(aiCost),
      weekMinutes: week._sum.minutes ?? 0,
      waitMinutes,
    };
  }

  async marginSummary(): Promise<MarginSummary> {
    const projects = await this.prisma.project.findMany({ where: { ratePerHour: { not: null } } });
    let revenue = 0;
    let cost = 0;
    for (const p of projects) {
      const rows = await this.prisma.timeEntry.findMany({ where: { task: { projectId: p.id } }, include: { member: true } });
      let minutes = 0;
      for (const r of rows) {
        if (!isWaiting(r)) minutes += r.minutes;
        cost += computeEntryCost(r as unknown as TimeEntry);
      }
      revenue += (minutes / 60) * (p.ratePerHour as number);
    }
    return { revenue: round2(revenue), cost: round2(cost), margin: round2(revenue - cost), projectCount: projects.length };
  }

  async teamToday(from: Date, to: Date): Promise<TeamTodayRow[]> {
    const members = await this.prisma.member.findMany({ where: { role: { not: WAIT_ROLE } }, orderBy: { createdAt: "asc" } });
    const out: TeamTodayRow[] = [];
    for (const m of members) {
      const rows = await this.prisma.timeEntry.findMany({ where: { memberId: m.id, startedAt: { gte: from, lt: to } } });
      let cost = 0;
      let tracked = 0;
      for (const r of rows) {
        cost += computeEntryCost(r as unknown as TimeEntry);
        tracked += r.minutes;
      }
      const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      out.push({ memberId: m.id, name: m.name, initials, trackedMinutes: tracked, cost: round2(cost) });
    }
    return out;
  }
}
