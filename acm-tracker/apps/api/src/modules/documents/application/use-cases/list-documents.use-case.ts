import { Inject, Injectable } from "@nestjs/common";
import type { DocumentItem } from "@acm/shared";
import { DOCUMENT_REPOSITORY, DocumentRepositoryPort } from "../../domain/ports/document.repository.port";

@Injectable()
export class ListDocumentsUseCase {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepositoryPort) {}

  execute(projectId?: string): Promise<DocumentItem[]> {
    return this.repo.findAll(projectId);
  }
}
