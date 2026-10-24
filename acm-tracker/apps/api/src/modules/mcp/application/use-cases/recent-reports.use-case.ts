import { Inject, Injectable } from "@nestjs/common";
import { MCP_INGEST, McpIngestPort, McpReportView } from "../../domain/ports/mcp-ingest.port";

@Injectable()
export class RecentReportsUseCase {
  constructor(@Inject(MCP_INGEST) private readonly ingest: McpIngestPort) {}

  execute(limit = 20): Promise<McpReportView[]> {
    return this.ingest.recentReports(limit);
  }
}
