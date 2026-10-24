import { Inject, Injectable } from "@nestjs/common";
import type { Member } from "@acm/shared";
import { MEMBER_REPOSITORY, MemberRepositoryPort } from "../../domain/ports/member.repository.port";
import { CreateMemberDto } from "../../interfaces/http/dto/create-member.dto";

@Injectable()
export class CreateMemberUseCase {
  constructor(@Inject(MEMBER_REPOSITORY) private readonly repo: MemberRepositoryPort) {}

  execute(dto: CreateMemberDto): Promise<Member> {
    return this.repo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role ?? "member",
      ratePerHour: dto.ratePerHour,
    });
  }
}
