import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class AiRunDto {
  @IsString() model!: string;
  @IsString() @IsOptional() agent?: string;
  @IsInt() @Min(0) tokensIn!: number;
  @IsInt() @Min(0) tokensOut!: number;
}

export class ReportWorkDto {
  @IsString() taskId!: string;
  @IsString() memberEmail!: string;
  @IsInt() @Min(0) minutes!: number;
  @IsString() @IsOptional() output?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AiRunDto) @IsOptional() aiRuns?: AiRunDto[];
}

export { AiRunDto };
