import { Inject, Injectable } from "@nestjs/common";
import type { NotificationRule } from "@acm/shared";
import { NOTIFICATION_RULE_REPOSITORY, NotificationRuleRepositoryPort } from "../../domain/ports/notification-rule.repository.port";
import { CreateNotificationRuleDto } from "../../interfaces/http/dto/create-notification-rule.dto";

@Injectable()
export class CreateNotificationRuleUseCase {
  constructor(@Inject(NOTIFICATION_RULE_REPOSITORY) private readonly repo: NotificationRuleRepositoryPort) {}

  execute(dto: CreateNotificationRuleDto): Promise<NotificationRule> {
    return this.repo.create(dto);
  }
}
