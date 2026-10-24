import { GetMcpConfigUseCase } from "./get-mcp-config.use-case";
import { McpConfigResolverPort } from "../../domain/ports/mcp-config-resolver.port";
import { McpIngestPort } from "../../domain/ports/mcp-ingest.port";

class FakeResolver implements McpConfigResolverPort {
  constructor(private readonly path: string | null, private readonly url: string) {}
  resolveServerPath(): string | null {
    return this.path;
  }
  resolveApiUrl(): string {
    return this.url;
  }
}

class FakeIngest implements McpIngestPort {
  constructor(private readonly ownerEmail: string | null) {}
  async getModelPrices(): Promise<never> {
    throw new Error("not used");
  }
  async getMemberRateByEmail(): Promise<never> {
    throw new Error("not used");
  }
  async getOwnerEmail(): Promise<string | null> {
    return this.ownerEmail;
  }
  async recordWork(): Promise<void> {
    throw new Error("not used");
  }
  async recentReports(): Promise<never> {
    throw new Error("not used");
  }
}

describe("GetMcpConfigUseCase", () => {
  it("builds the Claude Code config with the resolved path, url and owner", async () => {
    const useCase = new GetMcpConfigUseCase(
      new FakeIngest("owner@acm.local"),
      new FakeResolver("/payload/mcp/dist/index.js", "http://localhost:5188"),
    );

    const result = await useCase.execute();

    expect(result).toEqual({
      mcpServerPath: "/payload/mcp/dist/index.js",
      apiUrl: "http://localhost:5188",
      ownerEmail: "owner@acm.local",
      claudeConfig: {
        mcpServers: {
          "acm-tracker": {
            command: "node",
            args: ["/payload/mcp/dist/index.js"],
            env: { ACM_API_URL: "http://localhost:5188", ACM_OWNER_EMAIL: "owner@acm.local" },
          },
        },
      },
    });
  });

  it("falls back to empty strings when path and owner are missing", async () => {
    const useCase = new GetMcpConfigUseCase(
      new FakeIngest(null),
      new FakeResolver(null, "http://localhost:5188"),
    );

    const result = await useCase.execute();

    expect(result.mcpServerPath).toBeNull();
    expect(result.ownerEmail).toBeNull();
    expect(result.claudeConfig.mcpServers["acm-tracker"].args).toEqual([""]);
    expect(result.claudeConfig.mcpServers["acm-tracker"].env.ACM_OWNER_EMAIL).toBe("");
  });
});
