import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl, resolveDbBackend } from "./db-backend";

export abstract class PrismaService extends PrismaClient {}

function loadSqliteClient(): typeof PrismaClient {
  const candidates = [
    join(__dirname, "..", "..", "prisma", "sqlite", ".generated"),
    join(__dirname, "..", "..", "..", "prisma", "sqlite", ".generated"),
  ];
  const generated = candidates.find((path) => existsSync(path));
  if (!generated) {
    throw new Error("SQLite Prisma client not generated. Run: pnpm --filter @acm/api prisma:generate:sqlite");
  }
  return require(generated).PrismaClient;
}

export function createPrismaClient(): PrismaService {
  ensureDatabaseUrl();
  if (resolveDbBackend() === "sqlite") {
    const SqliteClient = loadSqliteClient();
    return new SqliteClient() as PrismaService;
  }
  return new PrismaClient() as PrismaService;
}
