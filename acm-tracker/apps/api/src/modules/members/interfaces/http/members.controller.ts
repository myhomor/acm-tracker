import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../../../auth/auth.guard";
import { CreateMemberUseCase } from "../../application/use-cases/create-member.use-case";
import { ListMembersUseCase } from "../../application/use-cases/list-members.use-case";
import { UpdateMemberUseCase } from "../../application/use-cases/update-member.use-case";
import { CreateMemberDto } from "./dto/create-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";

@UseGuards(AuthGuard)
@Controller("members")
export class MembersController {
  constructor(
    private readonly createMember: CreateMemberUseCase,
    private readonly listMembers: ListMembersUseCase,
    private readonly updateMember: UpdateMemberUseCase,
  ) {}

  @Post() create(@Body() dto: CreateMemberDto) {
    return this.createMember.execute(dto);
  }

  @Get() findAll() {
    return this.listMembers.execute();
  }

  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateMemberDto) {
    return this.updateMember.execute(id, dto);
  }
}
