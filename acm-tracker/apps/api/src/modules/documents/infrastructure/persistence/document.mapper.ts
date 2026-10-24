import type { Document as PrismaDocument } from "@prisma/client";
import type { DocumentItem, DocumentKind } from "@acm/shared";

export function toDomainDocument(row: PrismaDocument): DocumentItem {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as DocumentKind,
    title: row.title,
    phase: row.phase,
    url: row.url,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
