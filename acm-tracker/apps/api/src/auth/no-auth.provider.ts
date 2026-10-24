import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthProvider, AuthedUser } from "./auth-provider.interface";

@Injectable()
export class NoAuthProvider implements AuthProvider {
  readonly enforces = false;
  constructor(private prisma: PrismaService) {}

  async getCurrentUser(_req?: unknown): Promise<AuthedUser> {
    const owner = await this.prisma.member.findFirst({ orderBy: { createdAt: "asc" } });
    if (!owner) throw new UnauthorizedException("No local owner seeded. Run the seed.");
    return { memberId: owner.id, email: owner.email, name: owner.name };
  }
}
