export const MCP_CONFIG_RESOLVER = Symbol("MCP_CONFIG_RESOLVER");

export interface McpConfigResolverPort {
  resolveServerPath(): string | null;
  resolveApiUrl(): string;
}
