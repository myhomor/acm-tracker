import { IsEmail, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateMemberDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsOptional() role?: string;
  @IsNumber() @Min(0) ratePerHour!: number;
}
