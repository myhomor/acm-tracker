import { Injectable } from "@nestjs/common";
import type { DocumentItem } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateDocumentData,
  DocumentRepositoryPort,
} from "../../domain/ports/document.repository.port";
import { toDomainDocument } from "./document.mapper";

@Injectable()
export class PrismaDocumentRepository implements DocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDocumentData): Promise<DocumentItem> {
    const row = await this.prisma.document.create({ data });
    return toDomainDocument(row);
  }

  async findAll(projectId?: string): Promise<DocumentItem[]> {
    const rows = await this.prisma.document.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainDocument);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }
}
