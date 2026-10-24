import { Module } from "@nestjs/common";
import { MCP_INGEST } from "./domain/ports/mcp-ingest.port";
import { MCP_CONFIG_RESOLVER } from "./domain/ports/mcp-config-resolver.port";
import { ReportWorkUseCase } from "./application/use-cases/report-work.use-case";
import { RecentReportsUseCase } from "./application/use-cases/recent-reports.use-case";
import { GetMcpConfigUseCase } from "./application/use-cases/get-mcp-config.use-case";
import { PrismaMcpIngestAdapter } from "./infrastructure/persistence/prisma-mcp-ingest.adapter";
import { EnvMcpConfigResolverAdapter } from "./infrastructure/config/env-mcp-config-resolver.adapter";
import { McpController } from "./interfaces/http/mcp.controller";

@Module({
  controllers: [McpController],
  providers: [
    ReportWorkUseCase,
    RecentReportsUseCase,
    GetMcpConfigUseCase,
    { provide: MCP_INGEST, useClass: PrismaMcpIngestAdapter },
    { provide: MCP_CONFIG_RESOLVER, useClass: EnvMcpConfigResolverAdapter },
  ],
})
export class McpModule {}
