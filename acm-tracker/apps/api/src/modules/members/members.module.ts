import { Module } from "@nestjs/common";
import { MEMBER_REPOSITORY } from "./domain/ports/member.repository.port";
import { CreateMemberUseCase } from "./application/use-cases/create-member.use-case";
import { ListMembersUseCase } from "./application/use-cases/list-members.use-case";
import { UpdateMemberUseCase } from "./application/use-cases/update-member.use-case";
import { PrismaMemberRepository } from "./infrastructure/persistence/prisma-member.repository";
import { MembersController } from "./interfaces/http/members.controller";

@Module({
  controllers: [MembersController],
  providers: [
    CreateMemberUseCase,
    ListMembersUseCase,
    UpdateMemberUseCase,
    { provide: MEMBER_REPOSITORY, useClass: PrismaMemberRepository },
  ],
})
export class MembersModule {}
