import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { ensureDatabaseUrl, resolveDbBackend } from "../src/prisma/db-backend";

ensureDatabaseUrl();

const backend = resolveDbBackend();
const schema = backend === "sqlite"
  ? join(__dirname, "sqlite", "schema.prisma")
  : join(__dirname, "schema.prisma");

const prismaCli = join(dirname(require.resolve("prisma/package.json")), require("prisma/package.json").bin.prisma);

execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], { stdio: "inherit" });
