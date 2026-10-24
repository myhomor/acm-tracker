import { Injectable } from "@nestjs/common";
import type { Member } from "@acm/shared";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  CreateMemberData,
  MemberRepositoryPort,
  UpdateMemberData,
} from "../../domain/ports/member.repository.port";
import { toDomainMember } from "./member.mapper";

@Injectable()
export class PrismaMemberRepository implements MemberRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMemberData): Promise<Member> {
    const row = await this.prisma.member.create({ data });
    return toDomainMember(row);
  }

  async findAll(): Promise<Member[]> {
    const rows = await this.prisma.member.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomainMember);
  }

  async update(id: string, data: UpdateMemberData): Promise<Member> {
    const row = await this.prisma.member.update({ where: { id }, data });
    return toDomainMember(row);
  }
}
