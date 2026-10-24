import { Module } from "@nestjs/common";
import { NOTIFICATION_RULE_REPOSITORY } from "./domain/ports/notification-rule.repository.port";
import { CreateNotificationRuleUseCase } from "./application/use-cases/create-notification-rule.use-case";
import { ListNotificationRulesUseCase } from "./application/use-cases/list-notification-rules.use-case";
import { ToggleNotificationRuleUseCase } from "./application/use-cases/toggle-notification-rule.use-case";
import { DeleteNotificationRuleUseCase } from "./application/use-cases/delete-notification-rule.use-case";
import { PrismaNotificationRuleRepository } from "./infrastructure/persistence/prisma-notification-rule.repository";
import { NotificationsController } from "./interfaces/http/notifications.controller";

@Module({
  controllers: [NotificationsController],
  providers: [
    CreateNotificationRuleUseCase,
    ListNotificationRulesUseCase,
    ToggleNotificationRuleUseCase,
    DeleteNotificationRuleUseCase,
    { provide: NOTIFICATION_RULE_REPOSITORY, useClass: PrismaNotificationRuleRepository },
  ],
})
export class NotificationsModule {}
