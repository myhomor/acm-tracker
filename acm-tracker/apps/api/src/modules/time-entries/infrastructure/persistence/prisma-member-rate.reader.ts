import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { MemberRateReaderPort } from "../../domain/ports/member-rate.port";

@Injectable()
export class PrismaMemberRateReader implements MemberRateReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async getRatePerHour(memberId: string): Promise<number> {
    const member = await this.prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    return member.ratePerHour;
  }
}
