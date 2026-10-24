import { IsIn, IsOptional, IsString } from "class-validator";

export class CreateDocumentDto {
  @IsString() @IsOptional() projectId?: string;
  @IsIn(["page", "file", "link"]) kind!: "page" | "file" | "link";
  @IsString() title!: string;
  @IsString() @IsOptional() phase?: string;
  @IsString() @IsOptional() url?: string;
}
