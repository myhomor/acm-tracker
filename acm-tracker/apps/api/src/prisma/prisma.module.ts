import { Global, Module } from "@nestjs/common";
import { PrismaService, createPrismaClient } from "./prisma.service";

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (): Promise<PrismaService> => {
        const client = createPrismaClient();
        await client.$connect();
        return client;
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
