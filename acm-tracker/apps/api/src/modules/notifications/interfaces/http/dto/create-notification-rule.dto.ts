import { IsString } from "class-validator";

export class CreateNotificationRuleDto {
  @IsString() event!: string;
  @IsString() condition!: string;
  @IsString() channel!: string;
}
