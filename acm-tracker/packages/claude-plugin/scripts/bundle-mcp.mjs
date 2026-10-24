import { rmSync, mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const mcpRoot = resolve(pluginRoot, "..", "mcp");
const outDir = resolve(pluginRoot, "mcp");

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { stdio: "inherit", cwd, shell: process.platform === "win32" });

run("pnpm", ["--filter", "@acm/mcp", "build"], repoRoot);

const dist = resolve(mcpRoot, "dist");
if (!existsSync(dist)) throw new Error("@acm/mcp dist not found; build failed");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(dist, outDir, { recursive: true });

const srcPkg = JSON.parse(readFileSync(resolve(mcpRoot, "package.json"), "utf8"));
const standalone = {
  name: "acm-tracker-mcp-bundled",
  version: srcPkg.version,
  private: true,
  type: "module",
  dependencies: srcPkg.dependencies,
};
writeFileSync(resolve(outDir, "package.json"), JSON.stringify(standalone, null, 2));

run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], outDir);

const PRUNE_EXT = new Set([".map", ".md", ".markdown"]);
const PRUNE_DTS = /\.d\.[cm]?ts$/;
const PRUNE_DIR = new Set(["__tests__", "test", "tests"]);
function prune(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (PRUNE_DIR.has(name)) rmSync(full, { recursive: true, force: true });
      else prune(full);
    } else if (PRUNE_EXT.has(extname(name)) || PRUNE_DTS.test(basename(name))) {
      unlinkSync(full);
    }
  }
}
prune(resolve(outDir, "node_modules"));

console.log("Bundled MCP into", outDir);
