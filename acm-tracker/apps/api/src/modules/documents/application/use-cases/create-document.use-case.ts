import { Inject, Injectable } from "@nestjs/common";
import type { DocumentItem } from "@acm/shared";
import { DOCUMENT_REPOSITORY, DocumentRepositoryPort } from "../../domain/ports/document.repository.port";
import { CreateDocumentDto } from "../../interfaces/http/dto/create-document.dto";

@Injectable()
export class CreateDocumentUseCase {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepositoryPort) {}

  execute(dto: CreateDocumentDto, createdBy: string): Promise<DocumentItem> {
    return this.repo.create({
      projectId: dto.projectId ?? null,
      kind: dto.kind,
      title: dto.title,
      phase: dto.phase ?? null,
      url: dto.url ?? null,
      createdBy,
    });
  }
}
