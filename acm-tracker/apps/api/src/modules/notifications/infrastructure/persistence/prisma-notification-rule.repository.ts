import { Injectable } from "@nestjs/common";
import type { NotificationRule } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateNotificationRuleData,
  NotificationRuleRepositoryPort,
} from "../../domain/ports/notification-rule.repository.port";
import { toDomainNotificationRule } from "./notification-rule.mapper";

@Injectable()
export class PrismaNotificationRuleRepository implements NotificationRuleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationRuleData): Promise<NotificationRule> {
    const row = await this.prisma.notificationRule.create({ data });
    return toDomainNotificationRule(row);
  }

  async findAll(): Promise<NotificationRule[]> {
    const rows = await this.prisma.notificationRule.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomainNotificationRule);
  }

  async setEnabled(id: string, enabled: boolean): Promise<NotificationRule> {
    const row = await this.prisma.notificationRule.update({ where: { id }, data: { enabled } });
    return toDomainNotificationRule(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notificationRule.delete({ where: { id } });
  }
}
