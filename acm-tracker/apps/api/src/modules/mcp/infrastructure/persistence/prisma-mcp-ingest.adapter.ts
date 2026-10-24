import { Injectable } from "@nestjs/common";
import type { ModelPrice } from "@acm/shared";
import { localHourMinute } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import { McpIngestPort, McpReportView, RecordWorkInput } from "../../domain/ports/mcp-ingest.port";

@Injectable()
export class PrismaMcpIngestAdapter implements McpIngestPort {
  constructor(private readonly prisma: PrismaService) {}

  async getModelPrices(): Promise<ModelPrice[]> {
    const rows = await this.prisma.modelPrice.findMany();
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      inputPer1M: r.inputPer1M,
      outputPer1M: r.outputPer1M,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getMemberRateByEmail(email: string): Promise<{ id: string; ratePerHour: number } | null> {
    const member = await this.prisma.member.findUnique({ where: { email } });
    return member ? { id: member.id, ratePerHour: member.ratePerHour } : null;
  }

  async getOwnerEmail(): Promise<string | null> {
    const owner = await this.prisma.member.findFirst({ orderBy: { createdAt: "asc" } });
    return owner?.email ?? null;
  }

  async recordWork(input: RecordWorkInput): Promise<void> {
    await this.prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        memberId: input.memberId,
        origin: "mcp",
        minutes: input.minutes,
        billable: true,
        ratePerHourSnapshot: input.ratePerHourSnapshot,
        note: input.note,
        startedAt: new Date(),
        aiRuns: {
          create: input.aiRuns.map((r) => ({
            agent: r.agent,
            model: r.model,
            tokensIn: r.tokensIn,
            tokensOut: r.tokensOut,
            costUsd: r.costUsd,
          })),
        },
      },
    });
  }

  async recentReports(limit: number): Promise<McpReportView[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { origin: "mcp" },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { task: true, member: true, aiRuns: true },
    });
    return rows.map((r) => {
      const aiCost = Math.round(r.aiRuns.reduce((s, a) => s + a.costUsd, 0) * 100) / 100;
      const aiSummary = r.aiRuns.length > 0
        ? `${r.aiRuns.map((a) => a.model).join(", ")} → $${aiCost}`
        : "sin IA";
      return {
        id: r.id,
        time: localHourMinute(r.startedAt),
        agent: r.aiRuns[0]?.agent ?? null,
        person: r.member.name,
        task: `${r.task.code} · ${r.task.title}`,
        minutes: r.minutes,
        cost: Math.round((r.minutes / 60) * r.ratePerHourSnapshot * 100) / 100,
        aiSummary,
      };
    });
  }
}
