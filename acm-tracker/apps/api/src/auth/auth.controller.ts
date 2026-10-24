import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { IsEmail } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

class LoginDto {
  @IsEmail() email!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("login")
  async login(@Body() dto: LoginDto) {
    const member = await this.prisma.member.findUnique({ where: { email: dto.email } });
    if (!member) throw new UnauthorizedException("No existe un miembro con ese correo");
    return { memberId: member.id, name: member.name, email: member.email, role: member.role };
  }

  @Post("me")
  async me() {
    const owner = await this.prisma.member.findFirst({ orderBy: { createdAt: "asc" } });
    if (!owner) throw new UnauthorizedException("No hay owner local");
    return { memberId: owner.id, name: owner.name, email: owner.email, role: owner.role };
  }
}
