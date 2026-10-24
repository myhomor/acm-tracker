import { Inject, Injectable } from "@nestjs/common";
import { DOCUMENT_REPOSITORY, DocumentRepositoryPort } from "../../domain/ports/document.repository.port";

@Injectable()
export class DeleteDocumentUseCase {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepositoryPort) {}

  execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
