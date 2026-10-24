import type { NotificationRule } from "@acm/shared";

export const NOTIFICATION_RULE_REPOSITORY = Symbol("NOTIFICATION_RULE_REPOSITORY");

export interface CreateNotificationRuleData {
  event: string;
  condition: string;
  channel: string;
}

export interface NotificationRuleRepositoryPort {
  create(data: CreateNotificationRuleData): Promise<NotificationRule>;
  findAll(): Promise<NotificationRule[]>;
  setEnabled(id: string, enabled: boolean): Promise<NotificationRule>;
  delete(id: string): Promise<void>;
}
