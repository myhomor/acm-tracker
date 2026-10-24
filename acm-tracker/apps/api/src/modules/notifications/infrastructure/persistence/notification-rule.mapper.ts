import type { NotificationRule as PrismaNotificationRule } from "@prisma/client";
import type { NotificationRule } from "@acm/shared";

export function toDomainNotificationRule(row: PrismaNotificationRule): NotificationRule {
  return {
    id: row.id,
    event: row.event,
    condition: row.condition,
    channel: row.channel,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}
