const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const { dirname, join } = require("node:path");

const apiRoot = process.env.ACM_API_ROOT;
const prismaSchema = process.env.ACM_PRISMA_SCHEMA;
if (!apiRoot || !prismaSchema) {
  console.error("ACM_API_ROOT and ACM_PRISMA_SCHEMA are required.");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL ?? "";
if (dbUrl.startsWith("file:")) mkdirSync(dirname(dbUrl.slice("file:".length)), { recursive: true });
if (process.env.UPLOADS_DIR) mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

function exitWhenParentDies(parentPid) {
  setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 2000).unref();
}

const parentPid = Number(process.env.ACM_PARENT_PID);
if (Number.isInteger(parentPid) && parentPid > 0) exitWhenParentDies(parentPid);

function resolvePrismaCli() {
  const pkg = require.resolve("prisma/package.json", { paths: [apiRoot] });
  return join(dirname(pkg), require(pkg).bin.prisma);
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: apiRoot, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`Bootstrap step failed: ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

run([resolvePrismaCli(), "migrate", "deploy", "--schema", prismaSchema]);
run([join(apiRoot, "dist", "prisma", "seed.js")]);

const mainEntry = join(apiRoot, "dist", "src", "main.js");
if (!existsSync(mainEntry)) {
  console.error(`API entry not found: ${mainEntry}`);
  process.exit(1);
}
require(mainEntry);
