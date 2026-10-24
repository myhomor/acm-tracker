import { IsNumber, IsString, Min } from "class-validator";

export class CreateModelPriceDto {
  @IsString() provider!: string;
  @IsString() model!: string;
  @IsNumber() @Min(0) inputPer1M!: number;
  @IsNumber() @Min(0) outputPer1M!: number;
}
