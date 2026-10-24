export type DbBackend = "sqlite" | "postgres";

const DEFAULT_SQLITE_URL = "file:./acm.db";

export function resolveDbBackend(env: NodeJS.ProcessEnv = process.env): DbBackend {
  const value = (env.DB_BACKEND ?? "sqlite").toLowerCase();
  if (value === "postgres" || value === "postgresql") return "postgres";
  if (value === "sqlite") return "sqlite";
  throw new Error(`Unsupported DB_BACKEND "${env.DB_BACKEND}". Use "sqlite" or "postgres".`);
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const backend = resolveDbBackend(env);
  const url = env.DATABASE_URL;
  if (backend === "sqlite") {
    return url && url.startsWith("file:") ? url : DEFAULT_SQLITE_URL;
  }
  if (!url) throw new Error('DB_BACKEND=postgres requires DATABASE_URL (postgresql://...).');
  return url;
}

export function ensureDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = resolveDatabaseUrl(env);
  env.DATABASE_URL = url;
  return url;
}
