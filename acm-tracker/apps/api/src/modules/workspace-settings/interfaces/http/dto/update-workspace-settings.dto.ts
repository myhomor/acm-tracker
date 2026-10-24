import { IsNumber, IsOptional, Min } from "class-validator";

export class UpdateWorkspaceSettingsDto {
  @IsNumber() @Min(0) @IsOptional() dailyCostTarget?: number;
}
