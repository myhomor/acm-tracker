import { IsString } from "class-validator";

export class StartTimerDto {
  @IsString() taskId!: string;
}
