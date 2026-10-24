import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CurrentUser } from "../../../../auth/current-user.decorator";
import type { AuthedUser } from "../../../../auth/auth-provider.interface";
import { CreateDocumentUseCase } from "../../application/use-cases/create-document.use-case";
import { ListDocumentsUseCase } from "../../application/use-cases/list-documents.use-case";
import { DeleteDocumentUseCase } from "../../application/use-cases/delete-document.use-case";
import { CreateDocumentDto } from "./dto/create-document.dto";

@UseGuards(AuthGuard)
@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly createDocument: CreateDocumentUseCase,
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
  ) {}

  @Post() create(@CurrentUser() user: AuthedUser, @Body() dto: CreateDocumentDto) {
    return this.createDocument.execute(dto, user.name);
  }

  @Get() findAll(@Query("projectId") projectId?: string) {
    return this.listDocuments.execute(projectId);
  }

  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.deleteDocument.execute(id);
  }
}
