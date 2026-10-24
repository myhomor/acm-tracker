import { Inject, Injectable } from "@nestjs/common";
import type { Member } from "@acm/shared";
import { MEMBER_REPOSITORY, MemberRepositoryPort } from "../../domain/ports/member.repository.port";

@Injectable()
export class ListMembersUseCase {
  constructor(@Inject(MEMBER_REPOSITORY) private readonly repo: MemberRepositoryPort) {}

  execute(): Promise<Member[]> {
    return this.repo.findAll();
  }
}
