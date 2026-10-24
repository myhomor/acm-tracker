import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateNotificationRuleUseCase } from "../../application/use-cases/create-notification-rule.use-case";
import { ListNotificationRulesUseCase } from "../../application/use-cases/list-notification-rules.use-case";
import { ToggleNotificationRuleUseCase } from "../../application/use-cases/toggle-notification-rule.use-case";
import { DeleteNotificationRuleUseCase } from "../../application/use-cases/delete-notification-rule.use-case";
import { CreateNotificationRuleDto } from "./dto/create-notification-rule.dto";
import { ToggleNotificationRuleDto } from "./dto/toggle-notification-rule.dto";

@UseGuards(AuthGuard)
@Controller("notification-rules")
export class NotificationsController {
  constructor(
    private readonly createRule: CreateNotificationRuleUseCase,
    private readonly listRules: ListNotificationRulesUseCase,
    private readonly toggleRule: ToggleNotificationRuleUseCase,
    private readonly deleteRule: DeleteNotificationRuleUseCase,
  ) {}

  @Post() create(@Body() dto: CreateNotificationRuleDto) {
    return this.createRule.execute(dto);
  }

  @Get() findAll() {
    return this.listRules.execute();
  }

  @Patch(":id") toggle(@Param("id") id: string, @Body() dto: ToggleNotificationRuleDto) {
    return this.toggleRule.execute(id, dto.enabled);
  }

  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.deleteRule.execute(id);
  }
}
