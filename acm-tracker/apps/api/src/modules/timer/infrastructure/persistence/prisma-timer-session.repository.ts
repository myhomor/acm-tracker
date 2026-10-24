import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { ActiveTimerView, TimerSessionPort } from "../../domain/ports/timer-session.port";

@Injectable()
export class PrismaTimerSessionRepository implements TimerSessionPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(memberId: string): Promise<ActiveTimerView | null> {
    const row = await this.prisma.timerSession.findUnique({
      where: { memberId },
      include: { task: { include: { project: true } }, member: true },
    });
    if (!row) return null;
    return {
      taskId: row.taskId,
      taskCode: row.task.code,
      taskTitle: row.task.title,
      projectName: row.task.project.name,
      ratePerHour: row.member.ratePerHour,
      startedAt: row.startedAt.toISOString(),
    };
  }

  async create(memberId: string, taskId: string): Promise<void> {
    await this.prisma.timerSession.create({ data: { memberId, taskId } });
  }

  async clear(memberId: string): Promise<number> {
    const result = await this.prisma.timerSession.deleteMany({ where: { memberId } });
    return result.count;
  }

  async taskExists(taskId: string): Promise<boolean> {
    const row = await this.prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    return Boolean(row);
  }
}
