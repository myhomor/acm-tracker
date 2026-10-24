import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateProjectDto {
  @IsString() name!: string;
  @IsString() @IsOptional() client?: string;
  @IsNumber() @IsOptional() contractAmount?: number;
  @IsNumber() @Min(0) @IsOptional() estimateHours?: number;
  @IsNumber() @Min(0) @IsOptional() ratePerHour?: number;
}
