import { Inject, Injectable } from "@nestjs/common";
import { MCP_INGEST, McpIngestPort } from "../../domain/ports/mcp-ingest.port";
import { MCP_CONFIG_RESOLVER, McpConfigResolverPort } from "../../domain/ports/mcp-config-resolver.port";

export interface McpConfigResult {
  mcpServerPath: string | null;
  apiUrl: string;
  ownerEmail: string | null;
  claudeConfig: {
    mcpServers: {
      "acm-tracker": {
        command: "node";
        args: string[];
        env: { ACM_API_URL: string; ACM_OWNER_EMAIL: string };
      };
    };
  };
}

@Injectable()
export class GetMcpConfigUseCase {
  constructor(
    @Inject(MCP_INGEST) private readonly ingest: McpIngestPort,
    @Inject(MCP_CONFIG_RESOLVER) private readonly resolver: McpConfigResolverPort,
  ) {}

  async execute(): Promise<McpConfigResult> {
    const mcpServerPath = this.resolver.resolveServerPath();
    const apiUrl = this.resolver.resolveApiUrl();
    const ownerEmail = await this.ingest.getOwnerEmail();

    return {
      mcpServerPath,
      apiUrl,
      ownerEmail,
      claudeConfig: {
        mcpServers: {
          "acm-tracker": {
            command: "node",
            args: [mcpServerPath ?? ""],
            env: { ACM_API_URL: apiUrl, ACM_OWNER_EMAIL: ownerEmail ?? "" },
          },
        },
      },
    };
  }
}
