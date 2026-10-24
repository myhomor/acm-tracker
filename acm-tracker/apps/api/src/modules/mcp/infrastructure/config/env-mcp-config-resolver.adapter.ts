import { Injectable } from "@nestjs/common";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { McpConfigResolverPort } from "../../domain/ports/mcp-config-resolver.port";

const DEFAULT_PORT = "5188";
const REPO_FALLBACK = join("packages", "mcp", "dist", "index.js");

@Injectable()
export class EnvMcpConfigResolverAdapter implements McpConfigResolverPort {
  resolveServerPath(): string | null {
    const bundled = process.env.ACM_MCP_ENTRY;
    if (bundled && existsSync(bundled)) return bundled;

    return this.findRepoEntry(process.cwd());
  }

  private findRepoEntry(start: string): string | null {
    let current = start;
    while (true) {
      const candidate = join(current, REPO_FALLBACK);
      if (existsSync(candidate)) return candidate;
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }

  resolveApiUrl(): string {
    const port = process.env.API_PORT ?? DEFAULT_PORT;
    return `http://localhost:${port}`;
  }
}
