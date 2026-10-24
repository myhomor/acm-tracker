import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Min } from "class-validator";

export class CreateTimeEntryDto {
  @IsString() taskId!: string;
  @IsInt() @Min(1) minutes!: number;
  @IsBoolean() @IsOptional() billable?: boolean;
  @IsString() @IsOptional() note?: string;
  @IsISO8601() @IsOptional() startedAt?: string;
}
