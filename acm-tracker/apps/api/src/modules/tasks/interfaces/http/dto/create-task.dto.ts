import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateTaskDto {
  @IsString() projectId!: string;
  @IsString() code!: string;
  @IsString() title!: string;
  @IsString() @IsOptional() phase?: string;
  @IsInt() @Min(0) @IsOptional() estimateMinutes?: number;
}
