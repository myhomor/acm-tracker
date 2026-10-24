import type { DocumentItem, DocumentKind } from "@acm/shared";

export const DOCUMENT_REPOSITORY = Symbol("DOCUMENT_REPOSITORY");

export interface CreateDocumentData {
  projectId: string | null;
  kind: DocumentKind;
  title: string;
  phase: string | null;
  url: string | null;
  createdBy: string | null;
}

export interface DocumentRepositoryPort {
  create(data: CreateDocumentData): Promise<DocumentItem>;
  findAll(projectId?: string): Promise<DocumentItem[]>;
  delete(id: string): Promise<void>;
}
