import { IsBoolean } from "class-validator";

export class ToggleNotificationRuleDto {
  @IsBoolean() enabled!: boolean;
}
