import { CreateMemberUseCase } from "./create-member.use-case";
import type { Member } from "@acm/shared";
import {
  CreateMemberData,
  MemberRepositoryPort,
  UpdateMemberData,
} from "../../domain/ports/member.repository.port";

class FakeMemberRepo implements MemberRepositoryPort {
  public lastCreate?: CreateMemberData;
  async create(data: CreateMemberData): Promise<Member> {
    this.lastCreate = data;
    return { id: "m1", authProviderUserId: null, createdAt: "now", ...data };
  }
  async findAll(): Promise<Member[]> {
    return [];
  }
  async update(_id: string, _data: UpdateMemberData): Promise<Member> {
    throw new Error("not used");
  }
}

describe("CreateMemberUseCase", () => {
  it("creates a member defaulting role to 'member'", async () => {
    const repo = new FakeMemberRepo();
    const useCase = new CreateMemberUseCase(repo);
    await useCase.execute({ name: "A", email: "a@x.io", ratePerHour: 30 });
    expect(repo.lastCreate).toEqual({ name: "A", email: "a@x.io", role: "member", ratePerHour: 30 });
  });

  it("keeps an explicit role", async () => {
    const repo = new FakeMemberRepo();
    const useCase = new CreateMemberUseCase(repo);
    await useCase.execute({ name: "B", email: "b@x.io", role: "owner", ratePerHour: 45 });
    expect(repo.lastCreate?.role).toBe("owner");
  });
});
