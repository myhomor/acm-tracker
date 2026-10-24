import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const requireFrom = createRequire(import.meta.url);
const desktopRoot = join(here, "..");
const repoRoot = join(desktopRoot, "..", "..");
const apiRoot = join(repoRoot, "apps", "api");
const webDist = join(repoRoot, "apps", "web", "dist");
const sharedRoot = join(repoRoot, "packages", "shared");
const mcpRoot = join(repoRoot, "packages", "mcp");

const payload = join(desktopRoot, "src-tauri", "payload");
const payloadApi = join(payload, "api");
const payloadWeb = join(payload, "web-dist");
const payloadSidecar = join(payload, "sidecar");
const payloadMcp = join(payload, "mcp");

const isWin = process.platform === "win32";

assertBuilt(join(apiRoot, "dist", "src", "main.js"), "pnpm --filter @acm/api build");
assertBuilt(webDist, "pnpm --filter @acm/web build");
assertBuilt(join(apiRoot, "prisma", "sqlite", ".generated", "index.js"), "pnpm --filter @acm/api prisma:generate:sqlite");
assertBuilt(join(sharedRoot, "dist", "index.js"), "pnpm --filter @acm/shared build");
assertBuilt(join(mcpRoot, "dist", "index.js"), "pnpm --filter @acm/mcp build");

rmSync(payload, { recursive: true, force: true });
mkdirSync(payloadApi, { recursive: true });

cpSync(join(apiRoot, "dist"), join(payloadApi, "dist"), { recursive: true });
cpSync(join(apiRoot, "prisma"), join(payloadApi, "prisma"), { recursive: true });
writeStandalonePackageJson(apiRoot, payloadApi, ["@acm/shared"]);

npmInstallProd(payloadApi);
linkWorkspaceShared();
regeneratePrismaClientsInPayload();

mkdirSync(payloadMcp, { recursive: true });
cpSync(join(mcpRoot, "dist"), join(payloadMcp, "dist"), { recursive: true });
writeStandalonePackageJson(mcpRoot, payloadMcp, []);
npmInstallProd(payloadMcp);

pruneTypeDeclarations(payloadApi);
pruneTypeDeclarations(payloadMcp);

cpSync(webDist, payloadWeb, { recursive: true });
cpSync(join(desktopRoot, "sidecar"), payloadSidecar, { recursive: true });

console.log(`Payload assembled at ${payload}`);

function npmInstallProd(cwd) {
  execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts"], {
    cwd,
    stdio: "inherit",
    shell: isWin,
  });
}

function assertBuilt(path, hint) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run: ${hint}`);
  }
}

function writeStandalonePackageJson(srcRoot, destRoot, dropDeps) {
  const pkg = JSON.parse(readFileSync(join(srcRoot, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies };
  for (const d of dropDeps) delete deps[d];
  const standalone = { name: pkg.name, version: pkg.version, private: true, type: pkg.type, dependencies: deps };
  writeFileSync(join(destRoot, "package.json"), JSON.stringify(standalone, null, 2));
}

function linkWorkspaceShared() {
  const dest = join(payloadApi, "node_modules", "@acm", "shared");
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(sharedRoot, "dist"), join(dest, "dist"), { recursive: true });
  cpSync(join(sharedRoot, "package.json"), join(dest, "package.json"));
}

function pruneTypeDeclarations(root) {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      pruneTypeDeclarations(full);
    } else if (entry.endsWith(".d.ts") || entry.endsWith(".d.ts.map") || entry.endsWith(".map")) {
      rmSync(full);
    }
  }
}

function regeneratePrismaClientsInPayload() {
  const prismaBin = requireFrom.resolve("prisma/package.json", { paths: [payloadApi] });
  const prismaCli = join(dirname(prismaBin), JSON.parse(readFileSync(prismaBin, "utf8")).bin.prisma);
  for (const schema of ["prisma/schema.prisma", "prisma/sqlite/schema.prisma"]) {
    execFileSync(process.execPath, [prismaCli, "generate", "--schema", schema], {
      cwd: payloadApi,
      stdio: "inherit",
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    });
  }
}
