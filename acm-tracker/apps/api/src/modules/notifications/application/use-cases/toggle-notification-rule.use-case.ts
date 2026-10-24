import { Inject, Injectable } from "@nestjs/common";
import type { NotificationRule } from "@acm/shared";
import { NOTIFICATION_RULE_REPOSITORY, NotificationRuleRepositoryPort } from "../../domain/ports/notification-rule.repository.port";

@Injectable()
export class ToggleNotificationRuleUseCase {
  constructor(@Inject(NOTIFICATION_RULE_REPOSITORY) private readonly repo: NotificationRuleRepositoryPort) {}

  execute(id: string, enabled: boolean): Promise<NotificationRule> {
    return this.repo.setEnabled(id, enabled);
  }
}
