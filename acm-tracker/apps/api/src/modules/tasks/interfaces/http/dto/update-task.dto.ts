import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CreateTaskDto } from "./create-task.dto";

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional() @IsIn(["todo", "in_progress", "review", "waiting", "hold", "done"]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
}
