import { Inject, Injectable } from "@nestjs/common";
import type { Member } from "@acm/shared";
import { MEMBER_REPOSITORY, MemberRepositoryPort } from "../../domain/ports/member.repository.port";
import { UpdateMemberDto } from "../../interfaces/http/dto/update-member.dto";

@Injectable()
export class UpdateMemberUseCase {
  constructor(@Inject(MEMBER_REPOSITORY) private readonly repo: MemberRepositoryPort) {}

  execute(id: string, dto: UpdateMemberDto): Promise<Member> {
    return this.repo.update(id, dto);
  }
}
