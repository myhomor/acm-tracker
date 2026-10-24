import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_RULE_REPOSITORY, NotificationRuleRepositoryPort } from "../../domain/ports/notification-rule.repository.port";

@Injectable()
export class DeleteNotificationRuleUseCase {
  constructor(@Inject(NOTIFICATION_RULE_REPOSITORY) private readonly repo: NotificationRuleRepositoryPort) {}

  execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
