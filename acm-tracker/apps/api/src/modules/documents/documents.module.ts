import { Module } from "@nestjs/common";
import { DOCUMENT_REPOSITORY } from "./domain/ports/document.repository.port";
import { CreateDocumentUseCase } from "./application/use-cases/create-document.use-case";
import { ListDocumentsUseCase } from "./application/use-cases/list-documents.use-case";
import { DeleteDocumentUseCase } from "./application/use-cases/delete-document.use-case";
import { PrismaDocumentRepository } from "./infrastructure/persistence/prisma-document.repository";
import { DocumentsController } from "./interfaces/http/documents.controller";

@Module({
  controllers: [DocumentsController],
  providers: [
    CreateDocumentUseCase,
    ListDocumentsUseCase,
    DeleteDocumentUseCase,
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
  ],
})
export class DocumentsModule {}
