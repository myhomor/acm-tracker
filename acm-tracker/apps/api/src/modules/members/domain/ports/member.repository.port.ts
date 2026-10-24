import type { Member } from "@acm/shared";

export const MEMBER_REPOSITORY = Symbol("MEMBER_REPOSITORY");

export interface CreateMemberData {
  name: string;
  email: string;
  role: string;
  ratePerHour: number;
}

export interface UpdateMemberData {
  name?: string;
  email?: string;
  role?: string;
  ratePerHour?: number;
}

export interface MemberRepositoryPort {
  create(data: CreateMemberData): Promise<Member>;
  findAll(): Promise<Member[]>;
  update(id: string, data: UpdateMemberData): Promise<Member>;
}
